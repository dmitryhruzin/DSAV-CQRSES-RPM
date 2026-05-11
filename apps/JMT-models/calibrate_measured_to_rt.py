#!/usr/bin/env python3
"""
Calibrate AppService demands of each measured platform to match its measured
POST pino responseTime under offered 100/100/150 load.

For each (hw, disk, variation) in the measured set (M7i × 2 disks × 2 vars +
M7a × 1 disk × 2 vars  — M7g intentionally skipped):

1. ANALYTICAL pre-scaling.
   Use the multi-class M/M/1 FCFS formula
       RT_c_at_s = D_c_s + ρ_s · E[S]_s / (1 − ρ_s)
   summed across stations visited by CreateCommand. Disk-station demands and
   their ρ are held CONSTANT; only AppService demands are scaled by f.
   Bisect f such that the analytical total RT equals the measured POST RT.

2. EMPIRICAL refinement.
   Run JMT, observe POST RT, scale AppService demands by ratio^0.5 (damped).
   Repeat up to N_ITER times to within tolerance.

Disk demands are NOT touched — this preserves the M7i pair's K_disk that
predict_io2_jmt.py uses for the M7g io2 prediction. Affecting only AppService
also keeps the prediction methodology consistent (CPU demand is what we
calibrate; disk demand is what we measure).
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Optional


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from predict_io2_jmt import (  # type: ignore[import-not-found]
    STATION_UA,
    find_station_node,
    iter_server_strategies,
    extract_lambdas,
)
from build_index_predicted_from_jmt import sim_results  # type: ignore[import-not-found]
from calibrate_to_measured_rt import measured_post_rt  # type: ignore[import-not-found]


MODELS = HERE / "calibrated_models"
WORK = HERE / "_calib_runs"
INDEX = HERE / "index.md"
JMT_JAR = "/Applications/Java Modelling Tools/JMT.jar"

# Measured platforms that get AppService-calibrated to measured POST RT.
# M7g intentionally excluded — kept at middle-load.
# M7a gp3 Classical also excluded — its baseline Sequential-median model
# already gives RT close to measured (3.99 vs 3.05 ms, only 31% off);
# calibrating it further pushes Max Tput above 1500 j/s which is implausibly
# high for the small Classical handler. Keeping baseline gives a more
# conservative X_max ≈ 1057 with the small (acceptable) RT error.
TARGETS = [
    ("M7i", "gp3", "mCQRS",          "mCQRS"),
    ("M7i", "io2", "mCQRS",          "mCQRS"),
    ("M7a", "gp3", "mCQRS",          "mCQRS"),
    ("M7i", "gp3", "Classical_CQRS", "Classical CQRS"),
    ("M7i", "io2", "Classical_CQRS", "Classical CQRS"),
    # ("M7a", "gp3", "Classical_CQRS", "Classical CQRS"),  ← skipped, see note
]

N_ITER = 0  # empirical refinement disabled; analytical bisection is stable, JMT noise destabilizes refinement
TOLERANCE = 0.05

OFFERED = {"Query": 100.0, "CreateCommand": 100.0, "UpdateCommand": 150.0, "ReachConsistency": 250.0}
UA_TO_CANON = {
    "Запити": "Query",
    "Команди створення": "CreateCommand",
    "Команди оновлення": "UpdateCommand",
    "Процеси досягнення узгодженості": "ReachConsistency",
}
APP_SERVICE_UA = STATION_UA["AppService"]


def scale_appservice_only(jsimg: Path, f: float) -> None:
    tree = ET.parse(jsimg)
    root = tree.getroot()
    node = find_station_node(root, APP_SERVICE_UA)
    if node is None:
        return
    for cls_ua, val in iter_server_strategies(node):
        val.text = f"{float(val.text) / f:.10f}"
    tree.write(jsimg, encoding="utf-8", xml_declaration=True)


def analytical_create_rt(jsimg: Path, f_app: float) -> float:
    """Multi-class M/M/1 FCFS RT for CreateCommand, summed over visited
    stations. AppService demands are scaled by f_app; disk demands unchanged."""
    lambdas = extract_lambdas(jsimg)
    by_station: Dict[str, Dict[str, float]] = {}
    for (st, cls_ua), lam in lambdas.items():
        if lam <= 0:
            continue
        c = UA_TO_CANON.get(cls_ua)
        if c:
            by_station.setdefault(st, {})[c] = 1000.0 / lam  # ms

    total = 0.0
    for st, demands in by_station.items():
        if "CreateCommand" not in demands:
            continue
        scale = f_app if st == APP_SERVICE_UA else 1.0
        D_create = scale * demands["CreateCommand"]
        rho = sum(OFFERED[c] * (scale * d / 1000.0) for c, d in demands.items())
        if rho >= 0.999:
            return float("inf")
        lambda_total = sum(OFFERED[c] for c in demands)
        E_S = (rho / lambda_total) * 1000.0  # ms
        W = rho * E_S / (1.0 - rho)
        total += D_create + W
    return total


def find_f_for_target(jsimg: Path, target_rt: float) -> float:
    f_lo, f_hi = 0.001, 10.0
    for _ in range(60):
        mid = (f_lo + f_hi) / 2.0
        rt = analytical_create_rt(jsimg, mid)
        if rt < target_rt:
            f_lo = mid
        else:
            f_hi = mid
        if (f_hi - f_lo) / max(mid, 1e-6) < 1e-4:
            break
    return (f_lo + f_hi) / 2.0


def prepare_for_sim(src: Path, dst: Path, max_samples: int = 100000) -> None:
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
    work_file = WORK / jsimg.name
    prepare_for_sim(jsimg, work_file)
    cmd = [
        "java", "-Xmx4g", "-cp", JMT_JAR,
        "jmt.commandline.Jmt", "sim", str(work_file), "-maxtime", str(max_sim_time),
    ]
    subprocess.run(cmd, capture_output=True, text=True, timeout=max_sim_time * 4 + 60)
    result = WORK / (jsimg.name + "-result.jsim")
    if not result.exists() or result.stat().st_size == 0:
        return None
    sim = sim_results(result)
    return sim["per_class"].get("CreateCommand", {}).get("rt_ms")


def calibrate_one(jsimg: Path, measured_rt: float, label: str) -> None:
    print(f"\n=== {label} (measured POST = {measured_rt:.2f} ms) ===")
    rt0 = analytical_create_rt(jsimg, 1.0)
    print(f"  baseline analytical RT (f=1) = {rt0:.2f} ms")
    f0 = find_f_for_target(jsimg, measured_rt)
    rt_at_f0 = analytical_create_rt(jsimg, f0)
    print(f"  analytical f₀ = {f0:.4f}  →  analytical RT = {rt_at_f0:.2f} ms (AppService-only)")
    scale_appservice_only(jsimg, f0)

    if N_ITER == 0:
        return

    ratio = 1.0
    for i in range(1, N_ITER + 1):
        jmt = run_jmt(jsimg)
        if jmt is None or jmt <= 0:
            print(f"  iter {i}: JMT failed")
            return
        ratio = measured_rt / jmt
        msg = f"  iter {i}: JMT POST = {jmt:7.2f} ms,  measured/JMT = {ratio:.4f}"
        if abs(ratio - 1.0) < TOLERANCE:
            print(msg + "  → converged")
            return
        f = ratio ** 0.5
        scale_appservice_only(jsimg, f)
        print(msg + f"  → damped scale f={f:.4f}")
    print(f"  did not fully converge after {N_ITER} iters (ratio={ratio:.4f})")


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
    shutil.rmtree(WORK, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
