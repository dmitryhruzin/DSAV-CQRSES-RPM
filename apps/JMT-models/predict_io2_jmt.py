#!/usr/bin/env python3
"""
Predict M7a/M7g io2 JMT models from gp3 calibrated models using the M7i io2/gp3
ratio applied to every (class, station) ServiceStrategy demand.

Per (class, station):
    K_lambda = lambda^M7i,io2 / lambda^M7i,gp3
    new_lambda = lambda^target,gp3 × K_lambda
    (equivalent to: predicted_demand = target_gp3_demand × demand_ratio,
     where demand_ratio = M7i_io2_demand / M7i_gp3_demand = 1 / K_lambda)

K is applied to every (class, station) demand, not only to disk stations:
the M7i pair measurements show that AppService demand also changes between
gp3 and io2 (less time blocked on disk → faster overall command time).

After generation, runs JMT on all 12 models (M7i + M7a/M7g gp3 measured +
M7a/M7g io2 predicted) under 100/100/150 load and prints throughput,
response time, and full processing time per class.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Tuple


HERE = Path(__file__).resolve().parent
SRC_DIR = HERE / "calibrated_models"
OUT_DIR = HERE / "predicted_io2_models"
RUN_DIR = HERE / "predicted_io2_runs"

JMT_JAR = "/Applications/Java Modelling Tools/JMT.jar"

STATION_UA = {
    "AppService": "Сервер",
    "EventStore": "Сховище подій",
    "SnapshotDB": "База даних знімків",
    "ProjectionDB": "База даних проєкцій",
}

CLASS_UA = {
    "Query": "Запити",
    "CreateCommand": "Команди створення",
    "UpdateCommand": "Команди оновлення",
    "ReachConsistency": "Процеси досягнення узгодженості",
}

VARIATIONS = ["mCQRS", "Classical_CQRS"]
GP3_TARGETS = ["M7a_gp3", "M7g_gp3"]


# ─── XML helpers ────────────────────────────────────────────────────────────

def local_name(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def find_station_node(root: ET.Element, station_name: str):
    for node in root.iter():
        if local_name(node.tag) != "node":
            continue
        if node.attrib.get("name") != station_name:
            continue
        for child in list(node):
            if local_name(child.tag) == "section":
                return node
    return None


def iter_server_strategies(node: ET.Element):
    """Yield (class_name, lambda_value_node) for the Server section."""
    for section in node.iter():
        if local_name(section.tag) != "section":
            continue
        if section.attrib.get("className") != "Server":
            continue
        for param in section:
            if local_name(param.tag) != "parameter":
                continue
            if param.attrib.get("name") != "ServiceStrategy":
                continue
            children = list(param)
            cur_class = None
            for child in children:
                if local_name(child.tag) == "refClass":
                    cur_class = (child.text or "").strip()
                elif cur_class is not None:
                    if "Disabled" in child.attrib.get("classPath", ""):
                        cur_class = None
                        continue
                    found = False
                    for sp in child.iter():
                        if sp.attrib.get("name") == "lambda":
                            val = sp.find("value")
                            if val is not None:
                                yield (cur_class, val)
                                found = True
                                break
                    cur_class = None


def extract_lambdas(jsimg_path: Path) -> Dict[Tuple[str, str], float]:
    """Return {(station_ua, class_ua): lambda} from Server stations only."""
    tree = ET.parse(jsimg_path)
    root = tree.getroot()
    out: Dict[Tuple[str, str], float] = {}
    for st_ua in STATION_UA.values():
        node = find_station_node(root, st_ua)
        if node is None:
            continue
        for cls_ua, val in iter_server_strategies(node):
            try:
                out[(st_ua, cls_ua)] = float(val.text)
            except (ValueError, TypeError):
                pass
    return out


def apply_K_lambdas(
    src_path: Path,
    out_path: Path,
    m7i_gp3: Dict[Tuple[str, str], float],
    m7i_io2: Dict[Tuple[str, str], float],
) -> List[Tuple[str, str, float, float, float]]:
    """Apply K = m7i_io2/m7i_gp3 to disk-station lambdas in src_path.

    Per the picture's formula, K is defined ONLY for disk operations
    (Сховище подій, База даних знімків, База даних проєкцій). The AppService
    station (Сервер) is CPU — the M7i.large CPU is identical between gp3
    and io2 hardware, so its service demand should NOT scale with disk type.
    Applying K there incorrectly captures residual I/O latency leaking
    through wall-clock command.execute and yields phantom 'CPU speedup'.

    Save the resulting model to out_path. Returns trace rows
    (station, class, K, lambda_before, lambda_after).
    """
    tree = ET.parse(src_path)
    root = tree.getroot()
    trace: List[Tuple[str, str, float, float, float]] = []

    APP_SERVICE_UA = STATION_UA["AppService"]

    for st_ua in STATION_UA.values():
        node = find_station_node(root, st_ua)
        if node is None:
            continue
        for cls_ua, val in iter_server_strategies(node):
            if st_ua == APP_SERVICE_UA:
                # CPU — do not scale by disk-derived K.
                continue
            lam_gp3 = m7i_gp3.get((st_ua, cls_ua))
            lam_io2 = m7i_io2.get((st_ua, cls_ua))
            if lam_gp3 is None or lam_io2 is None or lam_gp3 == 0:
                continue
            K = lam_io2 / lam_gp3
            cur = float(val.text)
            new = cur * K
            val.text = f"{new:.10f}"
            trace.append((st_ua, cls_ua, K, cur, new))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    tree.write(out_path, encoding="utf-8", xml_declaration=True)
    return trace


# ─── orchestration ──────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src-dir", default=str(SRC_DIR))
    parser.add_argument("--out-dir", default=str(OUT_DIR))
    parser.add_argument("--run-dir", default=str(RUN_DIR))
    parser.add_argument("--no-run", action="store_true",
                        help="Generate predicted models but skip JMT.")
    parser.add_argument("--max-samples", type=int, default=100000)
    parser.add_argument("--max-sim-time", type=int, default=120)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    src = Path(args.src_dir)
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    print(f"== Step 1 — generate predicted io2 models from {src.name} ==\n")

    all_traces: Dict[Tuple[str, str], List] = {}

    for variation in VARIATIONS:
        m7i_gp3_path = src / f"M7i_gp3_{variation}.jsimg"
        m7i_io2_path = src / f"M7i_io2_{variation}.jsimg"
        if not m7i_gp3_path.exists() or not m7i_io2_path.exists():
            print(f"  [skip] missing M7i pair for {variation}")
            continue

        m7i_gp3 = extract_lambdas(m7i_gp3_path)
        m7i_io2 = extract_lambdas(m7i_io2_path)

        print(f"--- {variation} ---")
        print(f"K_lambda = M7i.io2 / M7i.gp3 (per station × class):")
        print(f"{'station':<22} {'class':<35} {'lambda_gp3':>12} {'lambda_io2':>12} {'K_λ':>8} {'K_demand':>10}")
        for k in sorted(m7i_gp3):
            if k not in m7i_io2:
                continue
            st, cls = k
            l_gp3 = m7i_gp3[k]
            l_io2 = m7i_io2[k]
            K = l_io2 / l_gp3 if l_gp3 else float("nan")
            K_d = 1.0 / K if K else float("nan")
            print(f"  {st:<22} {cls:<35} {l_gp3:>12.4f} {l_io2:>12.4f} {K:>8.4f} {K_d:>10.4f}")
        print()

        for hw in GP3_TARGETS:
            target_io2 = hw.replace("gp3", "io2")
            src_path = src / f"{hw}_{variation}.jsimg"
            out_path = out / f"{target_io2}_{variation}.jsimg"
            trace = apply_K_lambdas(src_path, out_path, m7i_gp3, m7i_io2)
            print(f"  predicted: {src_path.name}  ->  {out_path.name}  ({len(trace)} demands scaled)")
            all_traces[(target_io2, variation)] = trace
        print()

    print(f"Output dir {out} has {len(list(out.glob('*.jsimg')))} predicted models.")

    if args.no_run:
        return 0

    print("\n== Step 2 — run JMT on all 12 models (8 calibrated + 4 predicted) ==")
    run_dir = Path(args.run_dir)
    cmd = [
        sys.executable,
        str(HERE / "run_simulations.py"),
        "--input-dir", str(src), str(out),
        "--work-dir", str(run_dir),
        "--summary-md", str(run_dir / "summary.md"),
        "--summary-csv", str(run_dir / "summary.csv"),
        "--workers", str(args.workers),
        "--max-samples", str(args.max_samples),
        "--max-sim-time", str(args.max_sim_time),
    ]
    print(f"$ {' '.join(cmd)}")
    rc = subprocess.run(cmd).returncode
    if rc != 0:
        print(f"run_simulations.py failed (rc={rc})")
        return rc

    return 0


if __name__ == "__main__":
    sys.exit(main())
