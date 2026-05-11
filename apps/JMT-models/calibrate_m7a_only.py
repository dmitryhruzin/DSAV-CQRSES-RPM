#!/usr/bin/env python3
"""
Iterative empirical calibration of ONLY M7a gp3 mCQRS and M7a gp3 Classical
to match the measured pino POST responseTime from the Load benchmark.

Algorithm per model:
  1. Run JMT, observe POST RT (Create class).
  2. Compute ratio = measured / observed.
  3. If |ratio − 1| < 0.05 → converged, done.
  4. Otherwise scale all demands by a factor f:
     - if ratio > 1 (need higher RT, more demand) → f = sqrt(ratio)  (gentle
       because increasing demands also raises ρ, and RT explodes super-
       linearly near saturation; over-stepping easily pushes ρ past 1).
     - if ratio < 1 → f = ratio (linear scaling is fine going down).
  5. Patch all ServiceStrategy lambdas in the .jsimg (divide by f).
  6. Repeat from 1 up to N_ITER times.

Only M7a is touched. M7i and M7g .jsimg files are left as-is.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional, Tuple


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from predict_io2_jmt import (  # type: ignore[import-not-found]
    STATION_UA,
    find_station_node,
    iter_server_strategies,
)
from build_index_predicted_from_jmt import sim_results  # type: ignore[import-not-found]
from calibrate_to_measured_rt import measured_post_rt  # type: ignore[import-not-found]


MODELS = HERE / "calibrated_models"
WORK = HERE / "m7a_calibration_runs"
INDEX = HERE / "index.md"
JMT_JAR = "/Applications/Java Modelling Tools/JMT.jar"

TARGETS = [
    ("M7a", "gp3", "mCQRS",          "mCQRS"),
    ("M7a", "gp3", "Classical_CQRS", "Classical CQRS"),
]

N_ITER = 3
TOLERANCE = 0.05  # 5% match

OFFERED = {"Query": 100.0, "CreateCommand": 100.0, "UpdateCommand": 150.0, "ReachConsistency": 250.0}
UA_TO_CANON = {
    "Запити": "Query",
    "Команди створення": "CreateCommand",
    "Команди оновлення": "UpdateCommand",
    "Процеси досягнення узгодженості": "ReachConsistency",
}


def scale_all_demands(jsimg: Path, f: float) -> None:
    tree = ET.parse(jsimg)
    root = tree.getroot()
    for st_ua in STATION_UA.values():
        node = find_station_node(root, st_ua)
        if node is None:
            continue
        for cls_ua, val in iter_server_strategies(node):
            val.text = f"{float(val.text) / f:.10f}"
    tree.write(jsimg, encoding="utf-8", xml_declaration=True)


def analytical_create_rt_ms(jsimg: Path, f: float = 1.0) -> float:
    """Analytical multi-class M/M/1 FCFS Response Time for CreateCommand class,
    summed across all visited stations, assuming all demands are scaled by f.

    Per-station: ρ_s = Σ_c λ_c × D_c_s ; E[S]_s = ρ_s / λ_total_s ;
    W_s = ρ_s × E[S]_s / (1 − ρ_s) ;  RT_c_s = D_c_s + W_s.
    """
    from predict_io2_jmt import extract_lambdas  # local import to avoid cycles
    lambdas = extract_lambdas(jsimg)
    # Build {station: {class_canon: D_ms}}
    by_station: dict = {}
    for (st, cls_ua), lam in lambdas.items():
        if lam <= 0:
            continue
        c = UA_TO_CANON.get(cls_ua)
        if c:
            by_station.setdefault(st, {})[c] = 1000.0 / lam

    total_rt = 0.0
    for st, demands_by_class in by_station.items():
        if "CreateCommand" not in demands_by_class:
            continue
        D_c_create = f * demands_by_class["CreateCommand"]
        # ρ at this station
        rho = sum(OFFERED[c] * (f * d / 1000.0) for c, d in demands_by_class.items())
        if rho >= 0.999:
            return float("inf")
        lambda_total = sum(OFFERED[c] for c in demands_by_class)
        E_S = rho / lambda_total * 1000.0  # in ms (rho is dimensionless, λ in j/s → E[S] = sec → × 1000 ms)
        W = rho * E_S / (1.0 - rho)
        total_rt += D_c_create + W
    return total_rt


def find_f_for_target(jsimg: Path, target_rt_ms: float) -> float:
    """Bisect for f such that analytical multi-class M/M/1 POST RT equals target."""
    f_lo, f_hi = 0.001, 10.0
    for _ in range(60):
        f_mid = (f_lo + f_hi) / 2.0
        rt = analytical_create_rt_ms(jsimg, f_mid)
        if rt < target_rt_ms:
            f_lo = f_mid
        else:
            f_hi = f_mid
        if (f_hi - f_lo) / max(f_mid, 1e-6) < 1e-4:
            break
    return (f_lo + f_hi) / 2.0


def prepare_for_sim(src: Path, dst: Path, max_samples: int = 100000) -> None:
    """Copy src to dst with results stripped and maxSamples lowered."""
    tree = ET.parse(src)
    root = tree.getroot()
    for sim in root:
        if sim.tag.endswith("sim") or sim.tag == "sim":
            sim.set("maxSamples", str(max_samples))
            sim.set("disableStatisticStop", "false")
    for child in list(root):
        if child.tag.endswith("results") or child.tag == "results":
            root.remove(child)
    dst.parent.mkdir(parents=True, exist_ok=True)
    tree.write(dst, encoding="utf-8", xml_declaration=True)


def run_jmt(jsimg: Path, max_sim_time: int = 120) -> Optional[float]:
    """Run JMT once, return CreateCommand RT in ms."""
    work_file = WORK / jsimg.name
    prepare_for_sim(jsimg, work_file)
    cmd = [
        "java", "-Xmx4g", "-cp", JMT_JAR,
        "jmt.commandline.Jmt", "sim", str(work_file), "-maxtime", str(max_sim_time),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=max_sim_time * 4 + 60)
    result = WORK / (jsimg.name + "-result.jsim")
    if not result.exists() or result.stat().st_size == 0:
        return None
    sim = sim_results(result)
    return sim["per_class"].get("CreateCommand", {}).get("rt_ms")


def calibrate_one(jsimg: Path, measured_rt_ms: float, label: str) -> None:
    """Calibrate by:
       1. ANALYTICAL pre-scaling: bisect on multi-class M/M/1 formula to get
          a good first guess at the right scaling factor f₀.
       2. EMPIRICAL refinement: run JMT, observe RT, multiply current scaling
          by ratio (with damping if near saturation). At most N_ITER passes.
    """
    print(f"\n=== {label} (measured POST = {measured_rt_ms:.2f} ms) ===")

    # Step 1: analytical bisection
    rt_at_f1 = analytical_create_rt_ms(jsimg, f=1.0)
    print(f"  baseline analytical RT (f=1) = {rt_at_f1:.2f} ms")
    f0 = find_f_for_target(jsimg, measured_rt_ms)
    rt_at_f0 = analytical_create_rt_ms(jsimg, f=f0)
    print(f"  analytical f₀ = {f0:.4f}  →  analytical RT = {rt_at_f0:.2f} ms")
    scale_all_demands(jsimg, f0)

    # Step 2: empirical refinement via JMT
    for i in range(1, N_ITER + 1):
        jmt_rt = run_jmt(jsimg)
        if jmt_rt is None or jmt_rt <= 0:
            print(f"  iter {i}: JMT failed")
            return
        ratio = measured_rt_ms / jmt_rt
        msg = f"  iter {i}: JMT POST = {jmt_rt:7.2f} ms,  measured/JMT = {ratio:.4f}"
        if abs(ratio - 1.0) < TOLERANCE:
            print(msg + "  → converged")
            return
        # Damped scaling — ratio^0.5 prevents over/undershoot near saturation.
        f = ratio ** 0.5
        scale_all_demands(jsimg, f)
        print(msg + f"  → damped scale f={f:.4f}")
    print(f"  did not fully converge after {N_ITER} iters (ratio={ratio:.4f}, accepting current state)")


def main() -> int:
    text = INDEX.read_text(encoding="utf-8")
    WORK.mkdir(parents=True, exist_ok=True)
    for hw, disk, var_full, var_label in TARGETS:
        jsimg = MODELS / f"{hw}_{disk}_{var_full}.jsimg"
        if not jsimg.exists():
            print(f"[skip] missing {jsimg.name}")
            continue
        meas = measured_post_rt(text, hw, disk, var_label)
        if meas is None:
            print(f"[skip] no measured RT for {hw}.{disk}.{var_label}")
            continue
        calibrate_one(jsimg, meas, f"{hw}_{disk}_{var_full}")
    # Clean up scratch dir
    shutil.rmtree(WORK, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
