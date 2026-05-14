#!/usr/bin/env python3
"""Analyse JMT simulation outputs across all three distribution variants (v4).

V4: identical to v3, except K_AppService is no longer forced to 1.0 (see
compute_k.py / build_jsimg.py). Ground truth for MRE is the M7a.io2 Load
distribution *after the first 10 seconds of the log are skipped* — matching
``apps/logs/analyz-10.md``. The load distribution is recomputed live with the
same 10s warm-up skip used by ``extract_demands.py``.

For each mode (exp / hyperexp / lognormal) read the predicted M7a.io2 sample
CSVs and compute avg/median/p90/p95/min/max/range/variance/stdev. Compare
against the measured M7a.io2 Load distribution (per-class http.request
durations from apps/logs/m7a-io2-<var>-load.log; event.handle for RC).

Writes ``analysis_v4.json`` and prints a comparison table.
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

# Measured M7a.io2 Load stats *after the first 10s warm-up are skipped*,
# straight from apps/logs/analyz-10.md. Used as the ground truth for MRE.
# These are also recomputed live below for cross-checking.
EXPECTED_MEASURED = {
    "m_cqrs": {
        "Zapyty": {"avg": 1.00, "median": 0.73, "p90": 1.65, "p95": 2.25,
                    "min": 0.29, "max": 31.47, "range": 31.18,
                    "variance": 1.58, "stdev": 1.26},
        "Stvor":  {"avg": 2.85, "median": 2.29, "p90": 4.34, "p95": 5.65,
                    "min": 1.25, "max": 63.90, "range": 62.65,
                    "variance": 5.13, "stdev": 2.26},
        "Onovl":  {"avg": 3.12, "median": 2.53, "p90": 4.76, "p95": 6.02,
                    "min": 1.55, "max": 52.98, "range": 51.43,
                    "variance": 5.50, "stdev": 2.34},
        # consistency_lag from analyz-10 (RC tail-row, mCQRS):
        "RC_post":  {"avg": 4.28, "median": 3.59, "p90": 6.32, "p95": 7.86,
                    "min": 1.80, "max": 75.28, "range": 73.48,
                    "variance": 8.61, "stdev": 2.93},
        "RC_patch": {"avg": 5.98, "median": 5.08, "p90": 8.97, "p95": 11.14,
                    "min": 2.32, "max": 93.61, "range": 91.29,
                    "variance": 15.45, "stdev": 3.93},
    },
    "classical_cqrs": {
        "Zapyty": {"avg": 1.02, "median": 0.78, "p90": 1.78, "p95": 2.44,
                    "min": 0.29, "max": 18.68, "range": 18.39,
                    "variance": 0.87, "stdev": 0.93},
        "Stvor":  {"avg": 1.99, "median": 1.57, "p90": 3.32, "p95": 4.26,
                    "min": 0.82, "max": 27.51, "range": 26.69,
                    "variance": 2.40, "stdev": 1.55},
        "Onovl":  {"avg": 3.03, "median": 2.55, "p90": 4.63, "p95": 5.79,
                    "min": 1.49, "max": 33.15, "range": 31.66,
                    "variance": 3.22, "stdev": 1.79},
        "RC_post":  {"avg": 3.48, "median": 3.04, "p90": 5.47, "p95": 6.71},
        "RC_patch": {"avg": 6.80, "median": 5.22, "p90": 9.20, "p95": 11.45},
    },
}

WARMUP_SKIP_MS = 10_000


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
    """Per-class response-time distribution stats (ms) from the load log.

    V3: applies the 10s warm-up skip exactly like analyz-10.md / extract_demands.py.
    Anchor = startedAt of the first http.request span in the log; any span with
    ``startedAt < anchor + 10_000ms`` is discarded.

    Also splits RC into:
      - ``RC_post``:  consistency_lag for POST commands
      - ``RC_patch``: consistency_lag for PATCH commands
      - ``RC``:       union (kept for backwards compatibility)
    Each consistency_lag = max(event.handle.endedAt over all handlers of req)
                            − http.request.startedAt for that req.
    """
    path = LOGS / f"{mach}-{var}-load.log"
    if not path.exists():
        return {}

    # ---- Pass 1: find anchor = first http.request startedAt ----
    anchor = None
    for line in path.open():
        try:
            e = json.loads(line)
        except Exception:
            continue
        if e.get("span") != "http.request":
            continue
        st = e.get("startedAt")
        if st is None:
            continue
        if anchor is None or st < anchor:
            anchor = st
    if anchor is None:
        return {}
    cutoff = anchor + WARMUP_SKIP_MS

    # ---- Pass 2: collect surviving spans ----
    per_class = defaultdict(list)
    # For consistency_lag we need to remember per-req http.request startedAt
    # and method, then max(event.handle.endedAt) - http.startedAt.
    req_http_start = {}
    req_method = {}
    req_eh_max_end = {}
    for line in path.open():
        try:
            e = json.loads(line)
        except Exception:
            continue
        sp = e.get("span")
        if not sp:
            continue
        st = e.get("startedAt")
        d = e.get("durationMs")
        if st is None or st < cutoff:
            continue
        req = e.get("req") or {}
        rid = req.get("id")
        m = req.get("method")
        if d is None:
            continue
        if sp == "http.request":
            if m == "GET":
                per_class["Zapyty"].append(d)
            elif m == "POST":
                per_class["Stvor"].append(d)
            elif m == "PATCH":
                per_class["Onovl"].append(d)
            if rid is not None:
                req_http_start[rid] = st
                req_method[rid] = m
        elif sp == "event.handle":
            per_class["RC"].append(d)
            if rid is not None:
                end = st + d
                cur = req_eh_max_end.get(rid)
                if cur is None or end > cur:
                    req_eh_max_end[rid] = end

    # Compute consistency_lag per req and bucket by method
    for rid, eh_end in req_eh_max_end.items():
        st0 = req_http_start.get(rid)
        m = req_method.get(rid)
        if st0 is None:
            continue
        lag = eh_end - st0
        if m == "POST":
            per_class["RC_post"].append(lag)
        elif m == "PATCH":
            per_class["RC_patch"].append(lag)

    out = {}
    for cls in ("Zapyty", "Stvor", "Onovl", "RC", "RC_post", "RC_patch"):
        if per_class[cls]:
            out[cls] = compute_dist_stats(per_class[cls])
    return out


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
    # V4: all 9 stats including min/max/range/variance/stdev.
    stats_names = ["avg", "median", "p90", "p95",
                   "min", "max", "range", "variance", "stdev"]
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

    (HERE / "analysis_v4.json").write_text(
        json.dumps(analysis, indent=2, ensure_ascii=False)
    )

    # ----- Human-readable summary -----
    print("\n========== MEASURED M7a.io2 Load distribution (10s skip) ==========")
    for var in ["m_cqrs", "classical_cqrs"]:
        print(f"\n--- {var} ---")
        hdr = ("cls", "avg", "med", "p90", "p95", "min", "max", "range", "var", "std")
        print(f"{hdr[0]:8s} " + " ".join(f"{h:>7s}" for h in hdr[1:]))
        for cls in LOGICAL:
            s = analysis["measured_load_distribution"][var].get(cls)
            if not s:
                continue
            print(f"{cls:8s} "
                  f"{s['avg']:>7.2f} {s['median']:>7.2f} {s['p90']:>7.2f} "
                  f"{s['p95']:>7.2f} {s['min']:>7.2f} {s['max']:>7.2f} "
                  f"{s['range']:>7.2f} {s['variance']:>7.2f} {s['stdev']:>7.2f}")

    print("\n========== PREDICTED vs MEASURED — full breakdown (9 stats) ==========")
    for mode in MODES:
        print(f"\n>>>>>>>>>> {mode} <<<<<<<<<<")
        for var in ["m_cqrs", "classical_cqrs"]:
            print(f"\n--- {var} ---")
            print(f"{'cls':6s}", end="")
            for stat in stats_names:
                print(f" {stat+'_p':>8s} {stat+'_m':>8s} {stat+'_e%':>7s}",
                      end="")
            print()
            for cls in LOGICAL:
                cmp = comparison[mode][var].get(cls)
                if not cmp:
                    continue
                print(f"{cls:6s}", end="")
                for stat in stats_names:
                    c = cmp[stat]
                    p = c["predicted"]
                    m = c["measured"]
                    e = c["mre_pct"]
                    pp = f"{p:>8.2f}" if p is not None else "       -"
                    mm = f"{m:>8.2f}" if m is not None else "       -"
                    ee = f"{e:>6.1f}%" if e is not None else "      -"
                    print(f" {pp} {mm} {ee}", end="")
                print()

    print("\n========== AGGREGATE MRE (request-path classes, both vars) ==========")
    print(f"{'mode':12s}", " ".join(f"{s:>9s}" for s in stats_names))
    for mode in MODES:
        row = agg[mode]
        print(f"{mode:12s}",
              " ".join(f"{row.get(s,{}).get('mean_abs_mre_pct',0):>8.1f}%"
                       for s in stats_names))


if __name__ == "__main__":
    main()
