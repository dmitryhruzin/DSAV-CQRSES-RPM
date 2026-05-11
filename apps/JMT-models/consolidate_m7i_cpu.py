#!/usr/bin/env python3
"""
Consolidate M7i CPU (AppService) demands between gp3 and io2 measurements.

Both M7i.large gp3 and M7i.large io2 use the SAME Intel CPU — the only
difference is the disk. So their AppService (CPU) service demand should
be the same. But the calibration pipeline (`generate_calibrated_jmt_models.py`)
derives AppService as `command.execute - DB_ops`, and `command.execute` is
a wall-clock metric that includes residual async-I/O wait. The faster io2
disk leaks less I/O latency into command.execute → after DB subtraction the
io2 AppService demand looks ~20 % smaller. That's a measurement artifact,
not a real CPU difference.

This script averages the two AppService demands per (class) and writes the
consensus value back into both M7i_gp3_<var>.jsimg and M7i_io2_<var>.jsimg.
Disk-station demands (EventStore, SnapshotDB, ProjectionDB) are left alone —
the gp3↔io2 difference there is the real disk effect.

Run AFTER generate_calibrated_jmt_models.py (and after recalibrate_m7g if
applicable), BEFORE predict_io2_jmt.py so that K_λ derived from the M7i
pair has K(AppService) = 1 and K(disk) = real disk speedup.
"""

from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from predict_io2_jmt import (  # type: ignore[import-not-found]
    STATION_UA,
    find_station_node,
    iter_server_strategies,
)


MODELS_DIR = HERE / "calibrated_models"

VARIATIONS = ("mCQRS", "Classical_CQRS")
APP_SERVICE_UA = STATION_UA["AppService"]


def appservice_lambdas(jsimg: Path) -> Dict[str, float]:
    """{class_ua: lambda} for AppService station only."""
    tree = ET.parse(jsimg)
    root = tree.getroot()
    node = find_station_node(root, APP_SERVICE_UA)
    if node is None:
        return {}
    out: Dict[str, float] = {}
    for cls_ua, val in iter_server_strategies(node):
        try:
            out[cls_ua] = float(val.text)
        except (TypeError, ValueError):
            pass
    return out


def patch_appservice(jsimg: Path, new_lambdas: Dict[str, float]) -> int:
    tree = ET.parse(jsimg)
    root = tree.getroot()
    node = find_station_node(root, APP_SERVICE_UA)
    if node is None:
        return 0
    n = 0
    for cls_ua, val in iter_server_strategies(node):
        if cls_ua in new_lambdas:
            val.text = f"{new_lambdas[cls_ua]:.10f}"
            n += 1
    tree.write(jsimg, encoding="utf-8", xml_declaration=True)
    return n


def consensus_lambda(lam_gp3: float, lam_io2: float) -> float:
    """Average in service-demand (ms) space, then convert back to lambda.
    Equivalent to harmonic mean of lambdas, which is the unbiased average
    of mean service times across the two measurements."""
    if lam_gp3 <= 0 or lam_io2 <= 0:
        return max(lam_gp3, lam_io2)
    d_gp3 = 1.0 / lam_gp3
    d_io2 = 1.0 / lam_io2
    d_avg = (d_gp3 + d_io2) / 2.0
    return 1.0 / d_avg


def main() -> int:
    print("=== Consolidating M7i AppService demands (gp3 ⊕ io2 → mean) ===\n")
    for var in VARIATIONS:
        gp3_path = MODELS_DIR / f"M7i_gp3_{var}.jsimg"
        io2_path = MODELS_DIR / f"M7i_io2_{var}.jsimg"
        if not gp3_path.exists() or not io2_path.exists():
            print(f"[skip] missing M7i pair for {var}")
            continue

        lams_gp3 = appservice_lambdas(gp3_path)
        lams_io2 = appservice_lambdas(io2_path)

        print(f"--- {var} ---")
        print(f"  {'class':<35} {'gp3_demand':>11} {'io2_demand':>11} → {'avg_demand':>11}")
        consensus: Dict[str, float] = {}
        for cls in sorted(set(lams_gp3) & set(lams_io2)):
            lam_g, lam_i = lams_gp3[cls], lams_io2[cls]
            new_lam = consensus_lambda(lam_g, lam_i)
            d_g, d_i, d_n = 1000.0 / lam_g, 1000.0 / lam_i, 1000.0 / new_lam
            print(f"  {cls:<35} {d_g:>9.4f}ms {d_i:>9.4f}ms → {d_n:>9.4f}ms")
            consensus[cls] = new_lam

        n_g = patch_appservice(gp3_path, consensus)
        n_i = patch_appservice(io2_path, consensus)
        print(f"  patched {gp3_path.name}: {n_g} AppService entries")
        print(f"  patched {io2_path.name}: {n_i} AppService entries\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
