#!/usr/bin/env python3
"""V5 Phase 4 — Validation vs measured load distributions.

For each baseline machine (6 pairs) and the M7a.io2 (2 pairs, transfer
learning honest test), compare predicted (JMT) response-time stats against
measured Load log stats (from apps/logs/<machine>-<variation>-load.log).

MRE per (class, stat).

Writes ``validation_v5.json``.
"""

import json
import math
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGS = HERE.parent / "logs"

LOGICAL = ["Zapyty", "Stvor", "Onovl", "RC"]
WARMUP_SKIP_MS = 10_000

# Re-use the parser logic from analyze_results.py
import importlib.util
spec = importlib.util.spec_from_file_location("ar", HERE / "analyze_results.py")
ar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ar)


def mre(pred, meas):
    if meas is None or meas == 0 or pred is None:
        return None
    return (pred - meas) / meas * 100.0


def main():
    out = {}
    keys = [
        ("m7i-gp3", "m_cqrs"), ("m7i-gp3", "classical_cqrs"),
        ("m7i-io2", "m_cqrs"), ("m7i-io2", "classical_cqrs"),
        ("m7a-gp3", "m_cqrs"), ("m7a-gp3", "classical_cqrs"),
        ("m7a-io2", "m_cqrs"), ("m7a-io2", "classical_cqrs"),
    ]
    stats_names = ["avg", "median", "p90", "p95",
                   "min", "max", "range", "variance", "stdev"]

    # Load v5 data
    analysis = json.loads((HERE / "analysis_v5.json").read_text())
    dd = analysis.get("predicted", {}).get("data_driven", {})

    for mach, var in keys:
        key = f"{mach}__{var}"
        out[key] = {}

        # Measured load distribution
        meas = ar.measured_load_distribution(mach, var)
        out[key]["measured"] = meas

        # Predicted: for M7a.io2 we have per-class RT samples; for baselines
        # we approximate predicted = aggregate from result.jsim Response Time
        # per Sink (mean only — we don't have CSV verbose dumps for baselines).
        if mach == "m7a-io2":
            pred_rt = dd.get(key, {}).get("response_time_per_class", {})
        else:
            # Use Response Time per Sink mean from result.jsim
            result_xml = HERE / f"results_data_driven" / f"{mach}_{var}_load-result.jsim"
            res, _ = ar.parse_result_xml(result_xml)
            pred_rt = {}
            for lcls in LOGICAL:
                cname = ar.CLS_NAME[lcls]
                k = ("Response Time per Sink", "Стоп", cname)
                if k in res:
                    # only mean available — build a degenerate stats dict
                    m = res[k]["mean"] or 0.0
                    pred_rt[lcls] = {"avg": m * 1000.0}  # s → ms
        out[key]["predicted"] = pred_rt

        # MRE per class / stat
        comparison = {}
        for cls in LOGICAL:
            p = pred_rt.get(cls)
            m = meas.get(cls)
            if not p or not m:
                continue
            comparison[cls] = {}
            for stat in stats_names:
                if stat in p and stat in m:
                    comparison[cls][stat] = {
                        "predicted": p[stat],
                        "measured": m[stat],
                        "mre_pct": mre(p[stat], m[stat]),
                    }
        out[key]["comparison"] = comparison

    # Aggregate MRE per machine/variation (for the request-path classes only)
    aggregate = {}
    for key, payload in out.items():
        agg = {}
        comp = payload.get("comparison", {})
        for stat in stats_names:
            errs = []
            for cls in LOGICAL:
                if cls == "RC":
                    continue
                e = comp.get(cls, {}).get(stat, {}).get("mre_pct")
                if e is not None:
                    errs.append(abs(e))
            if errs:
                agg[stat] = {
                    "mean_abs_mre_pct": sum(errs) / len(errs),
                    "max_abs_mre_pct": max(errs),
                    "n": len(errs),
                }
        aggregate[key] = agg
    out["_aggregate_per_key"] = aggregate

    # Honest test for M7a.io2 (avg only)
    print("\n========== VALIDATION: predicted vs measured (avg, MRE %) ==========")
    print(f"{'key':30s}  {'Zapyty':>14s}  {'Stvor':>14s}  {'Onovl':>14s}")
    for key, payload in out.items():
        if key.startswith("_"):
            continue
        comp = payload.get("comparison", {})
        cells = []
        for cls in ("Zapyty", "Stvor", "Onovl"):
            c = comp.get(cls, {}).get("avg")
            if c:
                cells.append(f"{c['predicted']:.2f}/{c['measured']:.2f}({c['mre_pct']:+.1f}%)")
            else:
                cells.append("       n/a       ")
        print(f"{key:30s}  {cells[0]:>14s}  {cells[1]:>14s}  {cells[2]:>14s}")

    (HERE / "validation_v5.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False)
    )
    print(f"\nWrote validation_v5.json")


if __name__ == "__main__":
    main()
