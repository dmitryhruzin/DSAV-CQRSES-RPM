#!/usr/bin/env python3
"""Parse JMT result CSVs for the 3 experiments on m7a-io2 and compute MRE
against measured load distribution.

Reads:
  models/m7a-io2-m_cqrs_<expN>_logs/Стоп_<class>_Response Time per Sink.csv
  logs10-noretry/m7a-io2-m_cqrs-load.log (measured ground truth)

Outputs:
  experiment-mre.json — full results
  Markdown table to stdout
"""

import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
LOGS = HERE / "logs10-noretry"

CLASSES = {
    "Zapyty": "Запити",
    "Stvor":  "Команди створення",
    "Onovl":  "Команди оновлення",
    "RC":     "Процеси досягнення узгодженості",
}
METHOD_OF = {"Zapyty": "GET", "Stvor": "POST", "Onovl": "PATCH"}  # RC handled separately


def read_csv_samples_ms(path: Path) -> list[float]:
    """Read JMT response-time CSV and return samples in ms."""
    out = []
    if not path.exists():
        return out
    with path.open() as f:
        rdr = csv.reader(f)
        try:
            header = next(rdr)
        except StopIteration:
            return out
        sample_idx = 1  # SAMPLE column
        try:
            sample_idx = header.index("SAMPLE")
        except ValueError:
            pass
        for row in rdr:
            if len(row) <= sample_idx:
                continue
            try:
                v = float(row[sample_idx])
                if v >= 0:
                    out.append(v * 1000.0)  # s → ms
            except Exception:
                continue
    return out


def stats_of(vals: list[float]) -> dict:
    if not vals:
        return {}
    s = sorted(vals)
    n = len(s)
    mean = sum(vals) / n
    median = s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
    pick = lambda p: s[min(n - 1, int(round(p * (n - 1))))]
    return {
        "n": n, "mean": mean, "median": median,
        "p90": pick(0.90), "p95": pick(0.95), "p99": pick(0.99),
        "max": s[-1],
    }


def measured_m7a_io2_load() -> dict:
    """Compute measured RT distribution for m7a-io2 load (10s-skipped logs)."""
    path = LOGS / "m7a-io2-m_cqrs-load.log"
    per_class = defaultdict(list)
    req_start = {}
    req_eh_end = {}
    req_method = {}
    with path.open() as f:
        for ln in f:
            if not ln.strip():
                continue
            try:
                e = json.loads(ln)
            except Exception:
                continue
            sp = e.get("span")
            if not sp:
                continue
            d = e.get("durationMs"); st = e.get("startedAt")
            req = e.get("req") or {}; rid = req.get("id")
            m = req.get("method")
            if sp == "http.request":
                if d is None:
                    continue
                if m == "GET":   per_class["Zapyty"].append(d)
                elif m == "POST":  per_class["Stvor"].append(d)
                elif m == "PATCH": per_class["Onovl"].append(d)
                if rid:
                    req_start[rid] = st
                    req_method[rid] = m
            elif sp == "event.handle":
                if d is not None:
                    per_class["RC_handler"].append(d)
                if rid is not None and d is not None:
                    end = (st or 0) + d
                    if rid not in req_eh_end or end > req_eh_end[rid]:
                        req_eh_end[rid] = end
    # consistency_lag = max(event.handle end) − http.request startedAt
    for rid, eh_end in req_eh_end.items():
        st0 = req_start.get(rid)
        if st0 is None:
            continue
        per_class["RC_lag"].append(eh_end - st0)
    return {cls: stats_of(per_class[cls]) for cls in
            ("Zapyty", "Stvor", "Onovl", "RC_handler", "RC_lag")}


def predicted_jmt(experiment: str) -> dict:
    """Read JMT CSV samples for predicted m7a-io2 under given experiment."""
    log_dir = MODELS / f"m7a-io2-m_cqrs_{experiment}_logs"
    out = {}
    for code, cyr in CLASSES.items():
        csv_path = log_dir / f"Стоп_{cyr}_Response Time per Sink.csv"
        samples = read_csv_samples_ms(csv_path)
        out[code] = stats_of(samples)
    return out


def mre(p: float, m: float) -> float | None:
    if p is None or m is None or m == 0:
        return None
    return (p - m) / m * 100.0


def main():
    measured = measured_m7a_io2_load()
    print("\n══════ Measured m7a-io2 LOAD distribution (ms) ══════")
    for cls in ("Zapyty", "Stvor", "Onovl", "RC_handler", "RC_lag"):
        s = measured.get(cls, {})
        if not s:
            continue
        print(f"  {cls:12s} n={s['n']:6d}  mean={s['mean']:7.3f}  median={s['median']:7.3f}  p90={s['p90']:7.3f}  p95={s['p95']:7.3f}  p99={s['p99']:7.3f}  max={s['max']:7.2f}")

    results = {"measured": measured, "predicted": {}, "comparison": {}}

    for exp in ("exp1", "exp2", "exp3"):
        pred = predicted_jmt(exp)
        results["predicted"][exp] = pred
        print(f"\n══════ Predicted JMT m7a-io2 — {exp} (ms) ══════")
        for cls in ("Zapyty", "Stvor", "Onovl", "RC"):
            s = pred.get(cls, {})
            if not s:
                continue
            print(f"  {cls:12s} n={s['n']:6d}  mean={s['mean']:7.3f}  median={s['median']:7.3f}  p90={s['p90']:7.3f}  p95={s['p95']:7.3f}  p99={s['p99']:7.3f}  max={s['max']:7.2f}")

    # MRE per class per stat
    stat_keys = ["mean", "median", "p90", "p95"]
    print("\n══════ MRE per class (JMT predicted vs measured, %) ══════")
    print(f"  {'class':12s} {'stat':8s} " + "  ".join(f"{e:>10s}" for e in ("exp1", "exp2", "exp3")))
    aggregate = {e: {s: [] for s in stat_keys} for e in ("exp1", "exp2", "exp3")}
    comparison = {}
    for cls_code in ("Zapyty", "Stvor", "Onovl", "RC"):
        # RC measured maps to RC_lag (more apples-to-apples: end-to-end consistency)
        meas_key = "RC_lag" if cls_code == "RC" else cls_code
        meas = measured.get(meas_key, {})
        comparison[cls_code] = {}
        for stat in stat_keys:
            m = meas.get(stat)
            row_vals = {}
            for e in ("exp1", "exp2", "exp3"):
                pred = results["predicted"][e].get(cls_code, {}).get(stat)
                err = mre(pred, m)
                row_vals[e] = {"pred": pred, "measured": m, "mre_pct": err}
                if err is not None:
                    aggregate[e][stat].append(abs(err))
            comparison[cls_code][stat] = row_vals
            cells = "  ".join(
                (f"{row_vals[e]['mre_pct']:>+9.2f}%" if row_vals[e]["mre_pct"] is not None else "       —")
                for e in ("exp1", "exp2", "exp3")
            )
            print(f"  {cls_code:12s} {stat:8s} {cells}")
    print("\n══════ Aggregate mean|MRE| (excluding RC for cross-class agg) ══════")
    for stat in stat_keys:
        cells = []
        for e in ("exp1", "exp2", "exp3"):
            # exclude RC for aggregate (RC mapping is ambiguous — consistency_lag vs event.handle)
            vals_no_rc = [a for cls in ("Zapyty", "Stvor", "Onovl")
                          for a in [comparison[cls][stat][e]["mre_pct"]] if a is not None]
            if not vals_no_rc:
                cells.append("       —")
                continue
            avg = sum(abs(v) for v in vals_no_rc) / len(vals_no_rc)
            cells.append(f"{avg:>9.2f}%")
        print(f"  {'no-RC':12s} {stat:8s} " + "  ".join(cells))
    print()
    for stat in stat_keys:
        cells = []
        for e in ("exp1", "exp2", "exp3"):
            vals = aggregate[e][stat]
            if not vals:
                cells.append("       —")
                continue
            avg = sum(vals) / len(vals)
            cells.append(f"{avg:>9.2f}%")
        print(f"  {'all-4-cls':12s} {stat:8s} " + "  ".join(cells))

    results["comparison"] = comparison
    (HERE / "experiment-mre.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print("\nWrote experiment-mre.json")


if __name__ == "__main__":
    main()
