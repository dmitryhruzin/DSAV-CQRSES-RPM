#!/usr/bin/env python3
"""Analyse JMT simulation outputs (v5).

V5 extension vs v4:
  - Extracts Utilization, Throughput, AND Response Time per station/class
    from result.jsim XML.
  - Aggregates per-station per-class throughputs to system-level totals.

Writes ``analysis_v5.json`` and prints a comparison table.
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
STATIONS_UA = {
    "AppService": "Сервер",
    "EventStore": "Сховище подій",
    "SnapshotDB": "База даних знімків",
    "ProjectionDB": "База даних проєкцій",
}
STATIONS_OF_UA = {v: k for k, v in STATIONS_UA.items()}

MODES = ["data_driven", "exp", "hyperexp", "lognormal"]
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
    """Return dict {(measureType, station, class): {mean, samples}} + raw list."""
    import xml.etree.ElementTree as ET
    out = {}
    raw = []
    if not p.exists():
        return out, raw
    root = ET.parse(p).getroot()
    for m in root.findall("measure"):
        mt = m.get("measureType")
        station = m.get("station") or ""
        cls = m.get("class") or ""
        try:
            mean = float(m.get("meanValue"))
        except Exception:
            mean = None
        try:
            samples = int(m.get("analyzedSamples"))
        except Exception:
            samples = 0
        out[(mt, station, cls)] = {"mean": mean, "samples": samples}
        raw.append({
            "type": mt, "station": station, "class": cls,
            "mean": mean, "samples": samples,
            "successful": m.get("successful"),
        })
    return out, raw


def extract_per_station(result_dict):
    """From the result-dict, return:
      utilization_by_station, throughput_per_class_by_station,
      throughput_total_by_station, throughput_per_class_system."""
    util = {}
    tp_per = {}
    tp_total = {}
    for st_ua, st_logical in STATIONS_OF_UA.items():
        k = ("Utilization", st_ua, "")
        if k in result_dict:
            util[st_logical] = result_dict[k]["mean"]
        tp_per[st_logical] = {}
        tot = 0.0
        for lcls in LOGICAL:
            cname = CLS_NAME[lcls]
            k = ("Throughput", st_ua, cname)
            if k in result_dict:
                v = result_dict[k]["mean"] or 0.0
                tp_per[st_logical][lcls] = v
                tot += v
        tp_total[st_logical] = tot

    # Per-class system throughput: max across stations (each class equals
    # arrival rate at every visited station in stationary regime).
    tp_class_sys = {}
    for lcls in LOGICAL:
        vals = [tp_per[st].get(lcls, 0.0) for st in STATIONS_UA]
        tp_class_sys[lcls] = max(vals) if vals else 0.0

    return util, tp_per, tp_total, tp_class_sys


def measured_load_distribution(mach: str, var: str):
    path = LOGS / f"{mach}-{var}-load.log"
    if not path.exists():
        return {}

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

    per_class = defaultdict(list)
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


def mre(pred, meas):
    if meas is None or meas == 0 or pred is None:
        return None
    return (pred - meas) / meas * 100.0


def collect_predicted_for_mode(mode):
    log_root = JMT_LOGS / mode
    results_dir = HERE / f"results_{mode}"
    out = {}

    keys = [
        ("m7i-gp3", "m_cqrs"), ("m7i-gp3", "classical_cqrs"),
        ("m7i-io2", "m_cqrs"), ("m7i-io2", "classical_cqrs"),
        ("m7a-gp3", "m_cqrs"), ("m7a-gp3", "classical_cqrs"),
        ("m7a-io2", "m_cqrs"), ("m7a-io2", "classical_cqrs"),
    ]

    for mach, var in keys:
        key = f"{mach}__{var}"
        rt_per_class = {}

        if mach == "m7a-io2":
            log_dir = log_root / f"m7a-io2_{var}_predicted"
            for lcls, cname in CLS_NAME.items():
                csv_path = log_dir / f"Стоп_{cname}_Response Time per Sink.csv"
                if not csv_path.exists():
                    continue
                samples_s = read_csv_samples(csv_path)
                samples_ms = [x * 1000 for x in samples_s]
                rt_per_class[lcls] = compute_dist_stats(samples_ms)
            result_xml = results_dir / f"m7a-io2_{var}_predicted-result.jsim"
        else:
            result_xml = results_dir / f"{mach}_{var}_load-result.jsim"

        result_dict, _ = parse_result_xml(result_xml)
        util, tp_per, tp_total, tp_class_sys = extract_per_station(result_dict)

        out[key] = {
            "response_time_per_class": rt_per_class,
            "utilization_per_station": util,
            "throughput_per_class_per_station": tp_per,
            "throughput_total_per_station": tp_total,
            "throughput_per_class_system": tp_class_sys,
            "throughput_total_system": sum(tp_class_sys.values()),
        }
    return out


def main():
    analysis = {"predicted": {}, "measured_load_distribution": {}}

    for var in ["m_cqrs", "classical_cqrs"]:
        analysis["measured_load_distribution"][var] = measured_load_distribution(
            "m7a-io2", var
        )

    for mode in MODES:
        if not (HERE / f"results_{mode}").exists():
            continue
        analysis["predicted"][mode] = collect_predicted_for_mode(mode)

    stats_names = ["avg", "median", "p90", "p95",
                   "min", "max", "range", "variance", "stdev"]
    comparison = {}
    for mode, mode_data in analysis["predicted"].items():
        comparison[mode] = {}
        for var in ["m_cqrs", "classical_cqrs"]:
            comparison[mode][var] = {}
            pred_data = mode_data.get(f"m7a-io2__{var}", {})
            meas = analysis["measured_load_distribution"].get(var, {})
            for cls in LOGICAL:
                pred = pred_data.get("response_time_per_class", {}).get(cls)
                m = meas.get(cls)
                if not pred or not m:
                    continue
                comparison[mode][var][cls] = {
                    s: {
                        "predicted": pred.get(s),
                        "measured": m.get(s),
                        "mre_pct": mre(pred.get(s), m.get(s)),
                    }
                    for s in stats_names
                }
    analysis["comparison"] = comparison

    agg = {}
    for mode in comparison:
        agg[mode] = {}
        for stat in stats_names:
            errs = []
            for var in ["m_cqrs", "classical_cqrs"]:
                for cls in LOGICAL:
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

    (HERE / "analysis_v5.json").write_text(
        json.dumps(analysis, indent=2, ensure_ascii=False)
    )

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

    print("\n========== PREDICTED M7a.io2 (data_driven) — Response Time per class ==========")
    dd = analysis["predicted"].get("data_driven", {})
    for var in ["m_cqrs", "classical_cqrs"]:
        print(f"\n--- {var} ---")
        rt = dd.get(f"m7a-io2__{var}", {}).get("response_time_per_class", {})
        for cls in LOGICAL:
            s = rt.get(cls)
            if not s:
                continue
            print(f"  {cls:8s} avg={s['avg']:.2f}  med={s['median']:.2f}  "
                  f"p90={s['p90']:.2f}  p95={s['p95']:.2f}  "
                  f"max={s['max']:.2f}")

    print("\n========== PREDICTED M7a.io2 — Utilization & Throughput per station (data_driven) ==========")
    for var in ["m_cqrs", "classical_cqrs"]:
        print(f"\n--- {var} ---")
        cell = dd.get(f"m7a-io2__{var}", {})
        util = cell.get("utilization_per_station", {})
        tp_tot = cell.get("throughput_total_per_station", {})
        for st in ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]:
            print(f"  {st:14s}  U={util.get(st, 0.0):.3f}  X_total={tp_tot.get(st, 0.0):.2f} j/s")
        tp_sys = cell.get("throughput_per_class_system", {})
        print(f"  System: " + ", ".join(
            f"{cls}={tp_sys.get(cls, 0.0):.2f}" for cls in LOGICAL))

    print("\n========== AGGREGATE MRE (request-path classes; data_driven) ==========")
    if "data_driven" in agg:
        for stat, row in agg["data_driven"].items():
            print(f"  {stat:10s}: mean={row['mean_abs_mre_pct']:.1f}%  "
                  f"max={row['max_abs_mre_pct']:.1f}%  n={row['n']}")


if __name__ == "__main__":
    main()
