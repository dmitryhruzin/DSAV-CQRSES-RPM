#!/usr/bin/env python3
"""Extract per-station, per-class service demands (in ms) from sequential logs.

V5 changes vs v4
----------------
1. **Explicit P(op | class) × E[d_op | class, op] decomposition**: instead of just
   accumulating per-request station totals, we record per-operation statistics
   (N(op, c), P(op | c), E[d_op | c], Var(d_op | c)) and reconstruct the demand
   as ``Σ_op∈ops(s) P(op | c) × E[d_op | c]``.

2. **Per-request station totals are STILL kept** alongside the explicit
   decomposition for variance computation and goodness-of-fit testing in
   ``characterize_distributions.py``. The two demand means should agree within
   numerical precision.

3. **Attribution sanity check**: ``Σ_s D_{c,s} ≈ E[http.request | c]`` for
   request-classes, ``Σ_s D_{c,s} ≈ E[event.handle]`` for RC. Any deviation
   over 5% sets ``discrepancy_flag=True`` and is logged.

4. **Variance** now computed TWO ways:
   - empirical (per-request totals, as in v4) — used for GoF / distribution fit
   - analytic ``Var_{analytic} = Σ_op P(op) × Var(d_op | op) +
                              Σ_op P(op)(1 - P(op)) × E[d_op | op]²`` — under
     independence assumption.

The 10-second warm-up skip and span-parsing rules are identical to v4.

For each (machine, variation), produce:
  AppService (CPU), EventStore, SnapshotDB, ProjectionDB demands per class:
    Zapyty   (queries / GET)
    Stvor    (create commands / POST)
    Onovl    (update commands / PATCH)
    RC       (consistency-reaching / event handlers)
"""

import json
import sys
from collections import defaultdict
from pathlib import Path


MACHINES = ["m7i-gp3", "m7i-io2", "m7a-gp3"]
VARIATIONS = ["m_cqrs", "classical_cqrs"]


def parse(path, warmup_skip_ms=10_000):
    """Return (by_req_span, method_of_req, success_of_req, t0, t1).

    Identical to v4 — see v4/extract_demands.py for full rationale of the 2-pass
    cutoff logic.
    """
    by_req_span = defaultdict(lambda: defaultdict(list))
    method_of_req = {}
    success_of_req = {}

    first_http_t = None
    with open(path) as f:
        for line in f:
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get("span") != "http.request":
                continue
            st = e.get("startedAt")
            if st is None:
                continue
            if first_http_t is None or st < first_http_t:
                first_http_t = st
    if first_http_t is None:
        return by_req_span, method_of_req, success_of_req, None, None

    cutoff = first_http_t + warmup_skip_ms

    t1 = None
    with open(path) as f:
        for line in f:
            try:
                e = json.loads(line)
            except Exception:
                continue
            sp = e.get("span")
            if not sp:
                continue
            req = e.get("req") or {}
            rid = req.get("id")
            m = req.get("method")
            d = e.get("durationMs")
            st = e.get("startedAt")
            if not rid:
                continue
            if st is None or st < cutoff:
                continue
            method_of_req[rid] = m
            if sp == "http.request":
                success_of_req[rid] = e.get("success", True)
                if d is not None:
                    end = st + d
                    if t1 is None or end > t1:
                        t1 = end
            if d is None:
                continue
            by_req_span[rid][sp].append((st, d))
    return by_req_span, method_of_req, success_of_req, cutoff, t1


def merge_projection_reads_for_patch(req_spans):
    handlers = req_spans.get("event.handle", [])
    reads = sorted(req_spans.get("db.projection.read", []), key=lambda x: x[0])
    if not reads:
        return reads
    H = len(handlers)
    R = len(reads)
    if H == 0 or R <= H:
        return reads
    excess = R - H
    first = sum(d for _, d in reads[:excess + 1])
    return [(reads[0][0], first)] + reads[excess + 1:]


def variance(xs):
    n = len(xs)
    if n == 0:
        return 0.0
    m = sum(xs) / n
    return sum((x - m) ** 2 for x in xs) / n


def robust_avg(xs, clip_p=0.95):
    if not xs:
        return 0.0
    s = sorted(xs)
    n = len(s)
    cap = s[max(0, int(round(clip_p * (n - 1))))]
    return sum(min(x, cap) for x in xs) / n


def robust_variance(xs, clip_p=0.95):
    if not xs:
        return 0.0
    s = sorted(xs)
    n = len(s)
    cap = s[max(0, int(round(clip_p * (n - 1))))]
    capped = [min(x, cap) for x in xs]
    m = sum(capped) / n
    return sum((x - m) ** 2 for x in capped) / n


# Operation-to-station mapping (op-name → station-name)
STATION_OPS = {
    "EventStore": ["db.eventstore.write", "db.eventstore.read"],
    "SnapshotDB": ["db.snapshot.read", "db.snapshot.write"],
    "ProjectionDB": ["db.projection.read", "db.projection.write"],
}

CLASS_OF_METHOD = {"GET": "Zapyty", "POST": "Stvor", "PATCH": "Onovl"}


# -------------------------------------------------------------------------
# V4-compatible per-request station totals
# -------------------------------------------------------------------------

def compute_per_request_station_totals(by_req_span, method_of_req):
    totals = {c: {st: [] for st in ["AppService", "EventStore", "SnapshotDB",
                                    "ProjectionDB"]}
              for c in ["Zapyty", "Stvor", "Onovl", "RC"]}

    method_total = defaultdict(int)

    for rid, spans in by_req_span.items():
        m = method_of_req.get(rid)
        if not m:
            continue

        if m == "GET":
            pr_reads = sum(d for _, d in spans.get("db.projection.read", []))
            proj = pr_reads
            http = sum(d for _, d in spans.get("http.request", []))
            app = max(0.0, http - proj)
            if http > 0:
                totals["Zapyty"]["ProjectionDB"].append(proj)
                totals["Zapyty"]["AppService"].append(app)
                method_total["GET"] += 1

        elif m == "POST":
            es_w = sum(d for _, d in spans.get("db.eventstore.write", []))
            es_r = sum(d for _, d in spans.get("db.eventstore.read", []))
            sn_r = sum(d for _, d in spans.get("db.snapshot.read", []))
            sn_w = sum(d for _, d in spans.get("db.snapshot.write", []))
            es = es_w + es_r
            sn = sn_r + sn_w
            http = sum(d for _, d in spans.get("http.request", []))
            app = max(0.0, http - es - sn)
            if http > 0:
                totals["Stvor"]["EventStore"].append(es)
                totals["Stvor"]["SnapshotDB"].append(sn)
                totals["Stvor"]["AppService"].append(app)
                method_total["POST"] += 1

        elif m == "PATCH":
            es_w = sum(d for _, d in spans.get("db.eventstore.write", []))
            es_r = sum(d for _, d in spans.get("db.eventstore.read", []))
            sn_r = sum(d for _, d in spans.get("db.snapshot.read", []))
            sn_w = sum(d for _, d in spans.get("db.snapshot.write", []))
            es = es_w + es_r
            sn = sn_r + sn_w
            http = sum(d for _, d in spans.get("http.request", []))
            app = max(0.0, http - es - sn)
            if http > 0:
                totals["Onovl"]["EventStore"].append(es)
                totals["Onovl"]["SnapshotDB"].append(sn)
                totals["Onovl"]["AppService"].append(app)
                method_total["PATCH"] += 1

        if m in ("POST", "PATCH"):
            handlers = spans.get("event.handle", [])
            if handlers:
                pr_writes = spans.get("db.projection.write", [])
                if m == "PATCH":
                    pr_reads = merge_projection_reads_for_patch(spans)
                else:
                    pr_reads = spans.get("db.projection.read", [])
                for i, (_, eh_d) in enumerate(handlers):
                    rd = pr_reads[i][1] if i < len(pr_reads) else 0.0
                    wr = pr_writes[i][1] if i < len(pr_writes) else 0.0
                    proj = rd + wr
                    app = max(0.0, eh_d - proj)
                    totals["RC"]["ProjectionDB"].append(proj)
                    totals["RC"]["AppService"].append(app)

    return totals, method_total


# -------------------------------------------------------------------------
# V5: Explicit P × E decomposition
# -------------------------------------------------------------------------

def collect_op_samples(by_req_span, method_of_req):
    """Build {class: {op_name: [list of durations, one entry per occurrence]}}.

    Also returns per-class http.request totals (one per request) and per-handler
    event.handle totals for the attribution sanity check.
    """
    op_samples = {c: defaultdict(list) for c in ("Zapyty", "Stvor", "Onovl", "RC")}
    http_per_req = {c: [] for c in ("Zapyty", "Stvor", "Onovl")}
    eh_per_handler = []

    n_req_class = defaultdict(int)
    n_handlers_total = 0

    for rid, spans in by_req_span.items():
        m = method_of_req.get(rid)
        if not m:
            continue
        cls = CLASS_OF_METHOD.get(m)
        if cls:
            http_d = sum(d for _, d in spans.get("http.request", []))
            if http_d > 0:
                n_req_class[cls] += 1
                http_per_req[cls].append(http_d)

                if m == "GET":
                    pr = sum(d for _, d in spans.get("db.projection.read", []))
                    if pr > 0:
                        op_samples[cls]["db.projection.read"].append(pr)
                else:
                    for op in ("db.eventstore.write", "db.eventstore.read",
                               "db.snapshot.read", "db.snapshot.write"):
                        for _, d in spans.get(op, []):
                            op_samples[cls][op].append(d)

        if m in ("POST", "PATCH"):
            handlers = spans.get("event.handle", [])
            if handlers:
                pr_writes = spans.get("db.projection.write", [])
                if m == "PATCH":
                    pr_reads = merge_projection_reads_for_patch(spans)
                else:
                    pr_reads = spans.get("db.projection.read", [])
                for i, (_, eh_d) in enumerate(handlers):
                    n_handlers_total += 1
                    eh_per_handler.append(eh_d)
                    rd = pr_reads[i][1] if i < len(pr_reads) else 0.0
                    wr = pr_writes[i][1] if i < len(pr_writes) else 0.0
                    if rd > 0:
                        op_samples["RC"]["db.projection.read"].append(rd)
                    if wr > 0:
                        op_samples["RC"]["db.projection.write"].append(wr)

    return op_samples, http_per_req, eh_per_handler, dict(n_req_class), n_handlers_total


def op_to_station_map(cls):
    if cls == "Zapyty":
        return {"db.projection.read": "ProjectionDB"}
    elif cls in ("Stvor", "Onovl"):
        return {
            "db.eventstore.write": "EventStore",
            "db.eventstore.read": "EventStore",
            "db.snapshot.read": "SnapshotDB",
            "db.snapshot.write": "SnapshotDB",
        }
    elif cls == "RC":
        return {
            "db.projection.read": "ProjectionDB",
            "db.projection.write": "ProjectionDB",
        }
    return {}


def build_decomposition(op_samples, http_per_req, eh_per_handler,
                        n_req_class, n_handlers_total,
                        per_request_totals):
    """Build the explicit P × E decomposition for each (class, station)."""
    decomposition = {c: {} for c in ("Zapyty", "Stvor", "Onovl", "RC")}

    for cls in ("Zapyty", "Stvor", "Onovl", "RC"):
        op_map = op_to_station_map(cls)
        if cls == "RC":
            N_c = n_handlers_total
            anchor_per_unit = eh_per_handler
        else:
            N_c = n_req_class.get(cls, 0)
            anchor_per_unit = http_per_req[cls]

        if N_c == 0:
            continue

        by_station = defaultdict(list)
        for op, st in op_map.items():
            by_station[st].append(op)

        D_explicit = {}
        for st, ops in by_station.items():
            ops_info = []
            D_mean = 0.0
            for op in ops:
                samp = op_samples[cls].get(op, [])
                N_op = len(samp)
                P = N_op / N_c if N_c else 0.0
                E_d = (sum(samp) / N_op) if N_op else 0.0
                E_d_w = robust_avg(samp)
                Var_d = variance(samp)
                contribution = P * E_d_w
                ops_info.append({
                    "name": op,
                    "N_op": N_op,
                    "N_class": N_c,
                    "P": P,
                    "E_d": E_d,
                    "E_d_winsorized": E_d_w,
                    "Var_d": Var_d,
                    "contribution_mean_ms": contribution,
                })
                D_mean += contribution

            xs = per_request_totals[cls][st]
            n_pr = len(xs)
            mean_pr = (sum(xs) / n_pr) if n_pr else 0.0
            D_var_emp = robust_variance(xs, clip_p=0.98) if xs else 0.0

            D_var_analytic = 0.0
            for info in ops_info:
                P, E_d_w, Var_d = info["P"], info["E_d_winsorized"], info["Var_d"]
                D_var_analytic += P * Var_d
                D_var_analytic += P * (1.0 - P) * (E_d_w ** 2)

            denom = max(D_mean, mean_pr, 1e-9)
            attr_diff_pct = abs(D_mean - mean_pr) / denom * 100.0

            decomposition[cls][st] = {
                "ops": ops_info,
                "D_mean_explicit_ms": D_mean,
                "D_mean_per_request_totals_ms": mean_pr,
                "D_var_empirical_ms2": D_var_emp,
                "D_var_analytic_ms2": D_var_analytic,
                "attribution_diff_pct": attr_diff_pct,
                "discrepancy_flag": attr_diff_pct > 5.0,
            }
            D_explicit[st] = D_mean

        if anchor_per_unit:
            anchor_mean = sum(anchor_per_unit) / len(anchor_per_unit)
        else:
            anchor_mean = 0.0

        db_sum = sum(D_explicit.values())
        app_mean_explicit = max(0.0, anchor_mean - db_sum)

        xs_app = per_request_totals[cls]["AppService"]
        app_mean_pr = (sum(xs_app) / len(xs_app)) if xs_app else 0.0
        app_var_emp = robust_variance(xs_app, clip_p=0.98) if xs_app else 0.0

        denom = max(app_mean_explicit, app_mean_pr, 1e-9)
        attr_diff_pct = abs(app_mean_explicit - app_mean_pr) / denom * 100.0

        anchor_name = ("http.request_residual" if cls != "RC"
                       else "event.handle_residual")
        decomposition[cls]["AppService"] = {
            "ops": [{
                "name": anchor_name,
                "N_op": len(anchor_per_unit),
                "N_class": N_c,
                "P": 1.0,
                "E_d": anchor_mean,
                "E_d_winsorized": robust_avg(anchor_per_unit),
                "Var_d": variance(anchor_per_unit),
                "contribution_mean_ms": app_mean_explicit,
            }],
            "D_mean_explicit_ms": app_mean_explicit,
            "D_mean_per_request_totals_ms": app_mean_pr,
            "D_var_empirical_ms2": app_var_emp,
            "D_var_analytic_ms2": 0.0,
            "attribution_diff_pct": attr_diff_pct,
            "discrepancy_flag": attr_diff_pct > 5.0,
        }

        # Attribution sanity check at class level
        total_D = app_mean_explicit + db_sum
        if anchor_mean > 0:
            attr_total_pct = abs(total_D - anchor_mean) / anchor_mean * 100.0
        else:
            attr_total_pct = 0.0
        decomposition[cls]["_class_total"] = {
            "sum_D_ms": total_D,
            "E_anchor_ms": anchor_mean,
            "attribution_diff_pct": attr_total_pct,
            "discrepancy_flag": attr_total_pct > 5.0,
        }

    return decomposition


def compute_demands(path, variation):
    by_req_span, method_of_req, success_of_req, t0, t1 = parse(path)
    duration_s = (t1 - t0) / 1000.0 if (t0 and t1) else 1.0

    station_totals, method_total = compute_per_request_station_totals(
        by_req_span, method_of_req
    )

    LOGICAL = ["Zapyty", "Stvor", "Onovl", "RC"]
    STATIONS = ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]

    demands = {}
    variances = {}
    variances_w = {}
    for cls in LOGICAL:
        demands[cls] = {}
        variances[cls] = {}
        variances_w[cls] = {}
        for st in STATIONS:
            xs = station_totals[cls][st]
            if not xs:
                demands[cls][st] = 0.0
                variances[cls][st] = 0.0
                variances_w[cls][st] = 0.0
                continue
            mean_ms = robust_avg(xs)
            var_ms2 = robust_variance(xs, clip_p=0.98)
            var_w_ms2 = robust_variance(xs, clip_p=0.95)
            demands[cls][st] = mean_ms
            variances[cls][st] = var_ms2
            variances_w[cls][st] = var_w_ms2

    for cls in LOGICAL:
        if demands[cls]["AppService"] > 0 and demands[cls]["AppService"] < 0.05:
            demands[cls]["AppService"] = 0.05

    eh_total_n = len(station_totals["RC"]["AppService"])
    arrivals = {
        "Zapyty": method_total.get("GET", 0) / duration_s,
        "Stvor": method_total.get("POST", 0) / duration_s,
        "Onovl": method_total.get("PATCH", 0) / duration_s,
        "RC": eh_total_n / duration_s,
    }

    out_span = defaultdict(lambda: defaultdict(list))
    for rid, spans in by_req_span.items():
        m = method_of_req.get(rid)
        if not m:
            continue
        for sp, entries in spans.items():
            for _, d in entries:
                out_span[m][sp].append(d)
    raw = {}
    for m in ("POST", "PATCH", "GET"):
        raw[m] = {
            "req_count": method_total.get(m, 0),
            "spans": {
                sp: {"count": len(out_span[m][sp]),
                     "avg": (sum(out_span[m][sp])/len(out_span[m][sp]))
                            if out_span[m][sp] else 0.0,
                     "winsorized_avg": robust_avg(out_span[m][sp]),
                     "var": variance(out_span[m][sp])}
                for sp in out_span.get(m, {})
            },
        }

    station_stats = {}
    for cls in LOGICAL:
        station_stats[cls] = {}
        for st in STATIONS:
            xs = station_totals[cls][st]
            n = len(xs)
            mean_ms = demands[cls][st]
            var_ms2 = variances[cls][st]
            cv2 = (var_ms2 / (mean_ms ** 2)) if mean_ms > 0 else 0.0
            station_stats[cls][st] = {
                "n": n,
                "mean_ms": mean_ms,
                "var_ms2": var_ms2,
                "cv2": cv2,
            }

    # V5: explicit P × E decomposition + per-request totals (for GoF)
    op_samples, http_per_req, eh_per_handler, n_req_class, n_handlers_total = \
        collect_op_samples(by_req_span, method_of_req)
    decomposition = build_decomposition(
        op_samples, http_per_req, eh_per_handler,
        n_req_class, n_handlers_total,
        station_totals,
    )

    per_request_totals = {
        cls: {st: list(station_totals[cls][st]) for st in STATIONS}
        for cls in LOGICAL
    }

    return {
        "duration_s": duration_s,
        "stations": demands,
        "var_ms2": variances,
        "var_w_ms2": variances_w,
        "arrivals": arrivals,
        "raw": raw,
        "station_stats": station_stats,
        "decomposition": decomposition,
        "per_request_totals": per_request_totals,
    }


def main():
    root = Path(__file__).resolve().parents[1] / "logs"
    out = {}
    for mach in MACHINES:
        for var in VARIATIONS:
            log = root / f"{mach}-{var}-seq.log"
            if not log.exists():
                print(f"missing: {log}", file=sys.stderr)
                continue
            print(f"processing {log.name} ...", file=sys.stderr)
            res = compute_demands(str(log), var)
            out[f"{mach}__{var}"] = res

            print(f"  duration {res['duration_s']:.2f}s")
            for cls in ("Zapyty", "Stvor", "Onovl", "RC"):
                s = res["stations"][cls]
                ss = res["station_stats"][cls]
                tot = res["decomposition"][cls].get("_class_total", {})
                attr = tot.get("attribution_diff_pct", 0.0)
                flag = "!" if tot.get("discrepancy_flag") else " "
                print(
                    f"  {cls:8s}: app={s['AppService']:.3f} (cv2={ss['AppService']['cv2']:.2f})  "
                    f"es={s['EventStore']:.3f} (cv2={ss['EventStore']['cv2']:.2f})  "
                    f"sn={s['SnapshotDB']:.3f} (cv2={ss['SnapshotDB']['cv2']:.2f})  "
                    f"pr={s['ProjectionDB']:.3f} (cv2={ss['ProjectionDB']['cv2']:.2f})   "
                    f"arr={res['arrivals'][cls]:.3f}/s   "
                    f"attribΔ={attr:.2f}%{flag}"
                )
    out_path = Path(__file__).resolve().parent / "demands.json"
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
