#!/usr/bin/env python3
"""Analyse JMT simulation outputs across all three distribution variants.

For each mode (exp / hyperexp / lognormal) read the predicted M7a.io2 sample
CSVs and compute avg/median/p90/p95/variance/stdev. Compare against the
*measured* M7a.io2 Load distribution (per-class http.request durations from
apps/logs/m7a-io2-<var>-load.log; event.handle for RC).

Writes ``analysis_v2.json`` and prints a comparison table.
"""

import csv
import json
import math
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGS = HERE.parent / "logs"
JMT_LOGS = HERE / "jmt_logs"

CLS_NAME = {
    "Zapyty": "Запити",
    "Stvor": "Команди створення",
    "Onovl": "Команди оновлення",
    "RC": "Процеси досягнення узгодженості",
}
LOGICAL = ["Zapyty", "Stvor", "Onovl", "RC"]
MODES = ["exp", "hyperexp", "lognormal"]

# Match measured load distribution stats (from earlier analyz.md) so the
# numbers can be sanity-checked. These are recomputed live from the logs
# but kept here for cross-referencing.
EXPECTED_MEASURED = {
    "m_cqrs": {
        "Zapyty": {"avg": 1.63, "median": 0.74, "p90": 1.76, "p95": 2.57},
        "Stvor":  {"avg": 3.67, "median": 2.33, "p90": 4.66, "p95": 6.46},
        "Onovl":  {"avg": 4.21, "median": 2.56, "p90": 5.06, "p95": 6.76},
    },
    "classical_cqrs": {
        "Zapyty": {"avg": 1.64, "median": 0.79, "p90": 1.90, "p95": 2.79},
        "Stvor":  {"avg": 2.76, "median": 1.60, "p90": 3.48, "p95": 4.74},
        "Onovl":  {"avg": 4.27, "median": 2.57, "p90": 4.89, "p95": 6.40},
    },
}


def compute_dist_stats(samples):
    n = len(samples)
    if n == 0:
        return None
    s = sorted(samples)
    avg = sum(samples) / n
    median = s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
    p90 = s[max(0, int(round(0.9 * (n - 1))))]
    p95 = s[max(0, int(round(0.95 * (n - 1))))]
    mn = s[0]
    mx = s[-1]
    if n > 1:
        var = sum((x - avg) ** 2 for x in samples) / (n - 1)
    else:
        var = 0.0
    sd = math.sqrt(var)
    return {
        "count": n,
        "avg": avg,
        "median": median,
        "p90": p90,
        "p95": p95,
        "min": mn,
        "max": mx,
        "range": mx - mn,
        "variance": var,
        "stdev": sd,
    }


def read_csv_samples(path: Path):
    out = []
    with path.open() as f:
        rdr = csv.reader(f)
        header = next(rdr)
        try:
            idx = header.index("SAMPLE")
        except ValueError:
            idx = 1
        for row in rdr:
            if not row:
                continue
            try:
                out.append(float(row[idx]))
            except Exception:
                continue
    return out


def parse_result_xml(p: Path):
    import xml.etree.ElementTree as ET
    out = []
    if not p.exists():
        return out
    root = ET.parse(p).getroot()
    for m in root.findall("measure"):
        out.append({
            "type": m.get("measureType"),
            "class": m.get("class") or "",
            "mean": float(m.get("meanValue")),
            "lower": float(m.get("lowerLimit")),
            "upper": float(m.get("upperLimit")),
        })
    return out


def measured_load_distribution(mach: str, var: str):
    """Per-class response-time distribution stats (ms) from the load log."""
    path = LOGS / f"{mach}-{var}-load.log"
    if not path.exists():
        return {}
    per_class = defaultdict(list)
    for line in path.open():
        try:
            e = json.loads(line)
        except Exception:
            continue
        sp = e.get("span")
        if not sp:
            continue
        req = e.get("req") or {}
        m = req.get("method")
        d = e.get("durationMs")
        if d is None:
            continue
        if sp == "http.request":
            if m == "GET":
                per_class["Zapyty"].append(d)
            elif m == "POST":
                per_class["Stvor"].append(d)
            elif m == "PATCH":
                per_class["Onovl"].append(d)
        elif sp == "event.handle":
            per_class["RC"].append(d)
    return {cls: compute_dist_stats(per_class[cls]) for cls in LOGICAL if per_class[cls]}


def measured_seq_avg_ms(mach: str, var: str):
    """Mean http.request duration per class from the seq log (sanity)."""
    path = LOGS / f"{mach}-{var}-seq.log"
    if not path.exists():
        return {}
    sums = defaultdict(float)
    cnts = defaultdict(int)
    eh_sum = 0.0
    eh_cnt = 0
    for line in path.open():
        try:
            e = json.loads(line)
        except Exception:
            continue
        sp = e.get("span")
        if not sp:
            continue
        req = e.get("req") or {}
        m = req.get("method")
        d = e.get("durationMs")
        if d is None:
            continue
        if sp == "http.request":
            sums[m] += d
            cnts[m] += 1
        elif sp == "event.handle":
            eh_sum += d
            eh_cnt += 1
    return {
        "Zapyty": (sums["GET"]/cnts["GET"]) if cnts["GET"] else None,
        "Stvor": (sums["POST"]/cnts["POST"]) if cnts["POST"] else None,
        "Onovl": (sums["PATCH"]/cnts["PATCH"]) if cnts["PATCH"] else None,
        "RC": (eh_sum/eh_cnt) if eh_cnt else None,
    }


def mre(pred, meas):
    if meas is None or meas == 0 or pred is None:
        return None
    return (pred - meas) / meas * 100.0


def main():
    analysis = {"predicted": {}, "measured_load_distribution": {}}

    # ----- Measured load distributions -----
    for var in ["m_cqrs", "classical_cqrs"]:
        analysis["measured_load_distribution"][var] = measured_load_distribution(
            "m7a-io2", var
        )

    # ----- Predicted (3 modes x 2 variations) -----
    for mode in MODES:
        analysis["predicted"][mode] = {}
        for var in ["m_cqrs", "classical_cqrs"]:
            log_dir = JMT_LOGS / mode / f"m7a-io2_{var}_predicted"
            per_class = {}
            for lcls, cy in CLS_NAME.items():
                csv_path = log_dir / f"Стоп_{cy}_Response Time per Sink.csv"
                if not csv_path.exists():
                    continue
                samples_s = read_csv_samples(csv_path)
                samples_ms = [x * 1000 for x in samples_s]
                stats = compute_dist_stats(samples_ms)
                per_class[lcls] = stats
            analysis["predicted"][mode][var] = per_class

    # ----- Compute MRE comparison -----
    stats_names = ["avg", "median", "p90", "p95"]
    comparison = {}
    for mode in MODES:
        comparison[mode] = {}
        for var in ["m_cqrs", "classical_cqrs"]:
            comparison[mode][var] = {}
            for cls in LOGICAL:
                pred = analysis["predicted"][mode][var].get(cls)
                meas = analysis["measured_load_distribution"][var].get(cls)
                if not pred or not meas:
                    continue
                comparison[mode][var][cls] = {
                    s: {
                        "predicted": pred.get(s),
                        "measured": meas.get(s),
                        "mre_pct": mre(pred.get(s), meas.get(s)),
                    }
                    for s in stats_names
                }
    analysis["comparison"] = comparison

    # ----- Aggregate MRE summaries -----
    agg = {}
    for mode in MODES:
        agg[mode] = {}
        for stat in stats_names:
            errs = []
            for var in ["m_cqrs", "classical_cqrs"]:
                for cls in LOGICAL:
                    # Skip RC for the aggregate because RC measured includes
                    # Node.js single-thread serialization that JMT can't model.
                    if cls == "RC":
                        continue
                    e = comparison[mode][var].get(cls, {}).get(stat, {}).get("mre_pct")
                    if e is not None:
                        errs.append(abs(e))
            if errs:
                agg[mode][stat] = {
                    "mean_abs_mre_pct": sum(errs) / len(errs),
                    "max_abs_mre_pct": max(errs),
                    "n": len(errs),
                }
    analysis["aggregate_mre"] = agg

    (HERE / "analysis_v2.json").write_text(
        json.dumps(analysis, indent=2, ensure_ascii=False)
    )

    # ----- Human-readable summary -----
    print("\n========== MEASURED M7a.io2 Load distribution ==========")
    for var in ["m_cqrs", "classical_cqrs"]:
        print(f"\n--- {var} ---")
        print(f"{'cls':8s} {'avg':>7s} {'med':>7s} {'p90':>7s} {'p95':>7s}")
        for cls in LOGICAL:
            s = analysis["measured_load_distribution"][var].get(cls)
            if not s:
                continue
            print(f"{cls:8s} {s['avg']:>7.2f} {s['median']:>7.2f} "
                  f"{s['p90']:>7.2f} {s['p95']:>7.2f}")

    print("\n========== PREDICTED vs MEASURED — full breakdown ==========")
    for mode in MODES:
        print(f"\n>>>>>>>>>> {mode} <<<<<<<<<<")
        for var in ["m_cqrs", "classical_cqrs"]:
            print(f"\n--- {var} ---")
            print(f"{'cls':8s}", end="")
            for stat in stats_names:
                print(f"  {stat+'_pred':>10s} {stat+'_meas':>10s} {stat+'_MRE%':>8s}",
                      end="")
            print()
            for cls in LOGICAL:
                cmp = comparison[mode][var].get(cls)
                if not cmp:
                    continue
                print(f"{cls:8s}", end="")
                for stat in stats_names:
                    c = cmp[stat]
                    p = c["predicted"]
                    m = c["measured"]
                    e = c["mre_pct"]
                    print(f"  {p:>10.2f} {m:>10.2f} {e:>7.1f}%", end="")
                print()

    print("\n========== AGGREGATE MRE (request-path classes, both vars) ==========")
    print(f"{'mode':12s} {'avg':>10s} {'median':>10s} {'p90':>10s} {'p95':>10s}")
    for mode in MODES:
        row = agg[mode]
        print(f"{mode:12s}",
              " ".join(f"{row.get(s,{}).get('mean_abs_mre_pct',0):>9.1f}%"
                       for s in stats_names))


if __name__ == "__main__":
    main()
