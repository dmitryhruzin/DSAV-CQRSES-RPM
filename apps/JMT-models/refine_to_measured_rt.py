#!/usr/bin/env python3
"""
Empirical fine-tuning of measured-platform JMT models so simulated POST RT
matches the measured pino responseTime.

Reads the current JMT simulation output (predicted_io2_runs/<model>.jsimg-result.jsim),
compares POST RT (CreateCommand Response Time per Sink) to the measured value
in index.md, and scales ALL ServiceStrategy demands of that model by the ratio
`measured / observed`. Re-running JMT after this should give RT very close
to the measured value.

Scaling all demands (rather than only AppService) preserves the relative
ratios between stations — the K_λ coefficients derived from the M7i pair
stay valid because they are RATIOS of demands.

Usage: run AFTER calibrate_to_measured_rt.py and one initial JMT run, then
re-run JMT once more. Iterate 1-2 times if needed.
"""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from predict_io2_jmt import (  # type: ignore[import-not-found]
    STATION_UA,
    find_station_node,
    iter_server_strategies,
)
from build_index_predicted_from_jmt import sim_results  # type: ignore[import-not-found]
from calibrate_to_measured_rt import MEASURED, measured_post_rt  # type: ignore[import-not-found]

MODELS = HERE / "calibrated_models"
RUNS = HERE / "predicted_io2_runs"
INDEX = HERE / "index.md"


def scale_all_demands(jsimg: Path, f: float) -> int:
    """Multiply all ServiceStrategy demands by f (divide lambdas by f)."""
    tree = ET.parse(jsimg)
    root = tree.getroot()
    n = 0
    for st_ua in STATION_UA.values():
        node = find_station_node(root, st_ua)
        if node is None:
            continue
        for cls_ua, val in iter_server_strategies(node):
            cur = float(val.text)
            val.text = f"{cur / f:.10f}"
            n += 1
    tree.write(jsimg, encoding="utf-8", xml_declaration=True)
    return n


def main() -> int:
    text = INDEX.read_text(encoding="utf-8")
    print("=== Iterative refinement: scale ALL demands to match measured POST RT ===\n")
    print(f"{'platform':<28} {'measured':>9} {'jmt_obs':>9} {'f':>7}  scaled")
    print("-" * 70)
    for hw, disk, var_full, var_label in MEASURED:
        jsimg = MODELS / f"{hw}_{disk}_{var_full}.jsimg"
        result = RUNS / f"{hw}_{disk}_{var_full}.jsimg-result.jsim"
        if not jsimg.exists() or not result.exists():
            continue
        meas = measured_post_rt(text, hw, disk, var_label)
        if meas is None:
            continue
        sim = sim_results(result)
        cre = sim["per_class"].get("CreateCommand", {})
        jmt_observed = cre.get("rt_ms")
        if jmt_observed is None or jmt_observed <= 0:
            continue
        f = meas / jmt_observed
        n = scale_all_demands(jsimg, f)
        print(f"  {hw}_{disk}_{var_full:<19} {meas:>9.2f} {jmt_observed:>9.2f} {f:>7.4f}  ({n} demands)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
