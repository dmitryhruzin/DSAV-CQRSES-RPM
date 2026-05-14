#!/usr/bin/env python3
"""Extract per-station, per-class service demands (in ms) from sequential logs.

V3 CHANGE — 10 SECOND WARM-UP SKIP
----------------------------------
Compared to v2, every span whose ``startedAt`` is earlier than
``t0 + 10_000ms`` is *discarded* before any further analysis. ``t0`` is the
``startedAt`` of the FIRST ``http.request`` span in the log (anchor on the
first request, NOT the first log line — this trims the load warm-up window
rather than the server boot/idle period).

Mirrors the behaviour of ``apps/logs/analyz-10.md`` so the calibrated demands
and arrival rates are computed over the same steady-state window as the
"after 10s skip" measured baseline used for MRE evaluation.

For each (machine, variation), produce:
  AppService (CPU), EventStore, SnapshotDB, ProjectionDB demands per class:
    Zapyty   (queries / GET)
    Stvor    (create commands / POST)
    Onovl    (update commands / PATCH)
    RC       (consistency-reaching / event handlers)

Also output arrival rates (req/s) for each class from the post-warmup log
duration AND per-(class, station) VARIANCE so we can fit HyperExp / Lognormal
distributions (both of which calibrate to (mean, variance) per service phase).

Variance approach:
  For each request (or, for RC, for each event.handle invocation), accumulate
  the TOTAL time it spends at a given service station by summing the durations
  of all spans that contribute to that station's demand (per the assignment
  rules below). The resulting list of per-request totals is then summarised by
  mean and variance — those two moments are the inputs for HyperExp/Lognormal
  calibration.

Span parsing rules:
  - command/query.execute, db.eventstore.{r,w}, db.snapshot.{r,w},
    event.publishAll, http.request, event.handle, db.projection.write: keep all
  - db.projection.read for PATCH: merge to count == H (event.handle count per req)
  - db.projection.read for GET: SUM all reads per req → 1 entry per request

Demand computation (mean = winsorized average at p95):
  - AppService.X = http.request - sum(all DB span totals per req for class X)
  - EventStore.POST   = sum of eventstore.write per req (mCQRS write only)
  - EventStore.POST/PATCH (Classical) = eventstore.write + eventstore.read
  - SnapshotDB.X      = snapshot.read + snapshot.write
  - ProjectionDB.X    = projection.read + projection.write
  - For RC class: per event.handle invocation:
      ProjectionDB.RC = projection.read (matched handler) + projection.write
      AppService.RC   = event.handle - ProjectionDB.RC
      EventStore.RC = 0; SnapshotDB.RC = 0
"""

import json
import math
import sys
import statistics
from collections import defaultdict
from pathlib import Path


MACHINES = ["m7i-gp3", "m7i-io2", "m7a-gp3"]
VARIATIONS = ["m_cqrs", "classical_cqrs"]


def parse(path, warmup_skip_ms=10_000):
    """Return (by_req_span, method_of_req, success_of_req, t0, t1).

    V3: every span whose ``startedAt`` is earlier than ``t0 + warmup_skip_ms``
    is dropped. ``t0`` is the ``startedAt`` of the FIRST ``http.request`` span
    in the log (anchors the cut on the first real request, not on boot/idle).

    Two passes: pass 1 finds ``t0``; pass 2 builds the structures, skipping
    everything in the warm-up window. ``t0`` returned to the caller is the
    *cutoff* ``t0 + warmup_skip_ms`` so duration / arrival-rate calculations
    use the analysed window only.
    """
    by_req_span = defaultdict(lambda: defaultdict(list))
    method_of_req = {}
    success_of_req = {}

    # --- Pass 1: locate t0 = startedAt of first http.request span ---
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

    # --- Pass 2: parse, but skip everything before the cutoff ---
    t0_eff = None  # earliest startedAt that survives the cutoff
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
            # 10s warm-up skip
            if st is None or st < cutoff:
                continue
            method_of_req[rid] = m
            if sp == "http.request":
                success_of_req[rid] = e.get("success", True)
                if d is not None:
                    end = st + d
                    if t0_eff is None or st < t0_eff:
                        t0_eff = st
                    if t1 is None or end > t1:
                        t1 = end
            if d is None:
                continue
            by_req_span[rid][sp].append((st, d))
    # Use the cutoff itself as the analysed-window start so duration_s reflects
    # exactly (t1 - (first_http_t + 10_000)) / 1000 — arrivals must be normed
    # against the post-warmup window, not against ``t0_eff`` (which floats with
    # the first surviving request).
    return by_req_span, method_of_req, success_of_req, cutoff, t1


def merge_projection_reads_for_patch(req_spans):
    """For PATCH: if R reads > H handlers, merge the first (R-H+1) reads into one
    entry so that the count equals H (one read per handler invocation).
    Returns list of (start_ts, duration_ms) in original order, length == H (when
    possible).
    """
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


def avg(xs):
    return sum(xs) / len(xs) if xs else 0.0


def variance(xs):
    """Population variance — variance of the empirical sample as a distribution.
    For HyperExp/Lognormal calibration this is conventionally Var(X)."""
    n = len(xs)
    if n == 0:
        return 0.0
    m = sum(xs) / n
    return sum((x - m) ** 2 for x in xs) / n


def robust_avg(xs, clip_p=0.95):
    """Winsorize at the clip_p quantile to suppress huge outliers."""
    if not xs:
        return 0.0
    s = sorted(xs)
    n = len(s)
    cap = s[max(0, int(round(clip_p * (n - 1))))]
    return sum(min(x, cap) for x in xs) / n


def robust_variance(xs, clip_p=0.95):
    """Variance after Winsorizing at clip_p (matches the mean used)."""
    if not xs:
        return 0.0
    s = sorted(xs)
    n = len(s)
    cap = s[max(0, int(round(clip_p * (n - 1))))]
    capped = [min(x, cap) for x in xs]
    m = sum(capped) / n
    return sum((x - m) ** 2 for x in capped) / n


def p90(xs):
    if not xs:
        return 0.0
    s = sorted(xs)
    n = len(s)
    return s[max(0, int(round(0.90 * (n - 1))))]


# -------------------------------------------------------------------------
# Per-request station totals
# -------------------------------------------------------------------------
# For each request, accumulate sum of durations at each station.
#
# Station spans by class:
#   GET (Zapyty):
#     ProjectionDB: sum of projection.read (already summed in our rule)
#     AppService:   http.request - ProjectionDB
#   POST (Stvor):
#     EventStore:   sum of eventstore.write [+ eventstore.read for Classical]
#     SnapshotDB:   sum of snapshot.read + snapshot.write
#     AppService:   http.request - EventStore - SnapshotDB
#   PATCH (Onovl): same as POST
#   RC: per event.handle invocation:
#     ProjectionDB: projection.read (matched by index after merge) + projection.write
#     AppService:   event.handle - ProjectionDB
#
# The variance is computed across the LIST of per-request (per-handler for RC)
# totals at that station.

DB_SPANS = {
    "EventStore": ["db.eventstore.write", "db.eventstore.read"],
    "SnapshotDB": ["db.snapshot.read", "db.snapshot.write"],
    "ProjectionDB": ["db.projection.read", "db.projection.write"],
}


def compute_per_request_station_totals(by_req_span, method_of_req):
    """Return per-class per-station list of per-request totals (ms).

    Output structure:
      totals[logical_class][station] = list of floats (one per request, or per
                                         handler for RC).
    Also returns the request count per method for arrival rates.
    """
    totals = {c: {st: [] for st in ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]}
              for c in ["Zapyty", "Stvor", "Onovl", "RC"]}

    method_total = defaultdict(int)
    # RC handler accumulators across all POST/PATCH requests
    # Per-handler ProjectionDB time = matched projection.read + matched projection.write
    # Per-handler AppService time   = event.handle - ProjectionDB
    for rid, spans in by_req_span.items():
        m = method_of_req.get(rid)
        if not m:
            continue
        # ------------------ GET (Zapyty) ------------------
        if m == "GET":
            # ProjectionDB.read for GET = sum of all reads (rule)
            pr_reads = sum(d for _, d in spans.get("db.projection.read", []))
            # No projection.write on GET path
            proj = pr_reads
            http = sum(d for _, d in spans.get("http.request", []))
            app = max(0.0, http - proj)
            if http > 0:
                totals["Zapyty"]["ProjectionDB"].append(proj)
                totals["Zapyty"]["AppService"].append(app)
                method_total["GET"] += 1

        # ------------------ POST (Stvor) ------------------
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

        # ------------------ PATCH (Onovl) ------------------
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

        # ------------------ RC (one entry per event.handle) ------------------
        if m in ("POST", "PATCH"):
            handlers = spans.get("event.handle", [])
            if handlers:
                pr_writes = spans.get("db.projection.write", [])
                if m == "PATCH":
                    pr_reads = merge_projection_reads_for_patch(spans)
                else:
                    pr_reads = spans.get("db.projection.read", [])
                # Match by index (defensive — H may be > reads/writes)
                H = len(handlers)
                for i, (_, eh_d) in enumerate(handlers):
                    rd = pr_reads[i][1] if i < len(pr_reads) else 0.0
                    wr = pr_writes[i][1] if i < len(pr_writes) else 0.0
                    proj = rd + wr
                    app = max(0.0, eh_d - proj)
                    totals["RC"]["ProjectionDB"].append(proj)
                    totals["RC"]["AppService"].append(app)

    return totals, method_total


def compute_demands(path, variation):
    by_req_span, method_of_req, success_of_req, t0, t1 = parse(path)
    # ``t0`` returned by parse() is the post-warmup CUTOFF (first http.request
    # startedAt + 10s). duration_s therefore equals the analysed window only,
    # so arrival rates are normalised against post-warmup time.
    duration_s = (t1 - t0) / 1000.0 if (t0 and t1) else 1.0

    station_totals, method_total = compute_per_request_station_totals(
        by_req_span, method_of_req
    )

    # Calibrated demand = winsorized mean of the per-request station total
    # (stable steady-state mean — outliers from Node.js GC pauses are clipped).
    #
    # Variance is computed two ways:
    #   var_ms2:      empirical variance after light winsorization at p99 — keeps
    #                 the heavy tail (everything up to the 99th pctile counts in
    #                 full) but rejects the handful of 1+ second GC-pause
    #                 outliers that would otherwise blow CV² past 1000. This is
    #                 the input used for HyperExp / Lognormal CV² calibration.
    #   var_w_ms2:    aggressively-winsorized variance (matched to the
    #                 winsorized-p95 mean) — kept for diagnostics / fallback.
    demands = {}
    variances = {}
    variances_w = {}
    LOGICAL = ["Zapyty", "Stvor", "Onovl", "RC"]
    STATIONS = ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]
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
            # p98 cap: keeps the typical heavy-tail while rejecting the cluster
            # of 1-second timeout/retry outliers observed in event.handle
            # (~1.3% of handlers). p99 still includes them; p95 throws away
            # too much real tail. p98 is the sweet spot empirically.
            var_ms2 = robust_variance(xs, clip_p=0.98)
            var_w_ms2 = robust_variance(xs, clip_p=0.95)
            if mean_ms <= 0:
                mean_ms = 0.0
            demands[cls][st] = mean_ms
            variances[cls][st] = var_ms2
            variances_w[cls][st] = var_w_ms2

    # AppService min floor (matches previous behaviour) to avoid div/0.
    for cls in LOGICAL:
        if demands[cls]["AppService"] > 0 and demands[cls]["AppService"] < 0.05:
            demands[cls]["AppService"] = 0.05

    # ----- Arrival rates -----
    eh_total_n = len(station_totals["RC"]["AppService"])  # one per event.handle
    arrivals = {
        "Zapyty": method_total.get("GET", 0) / duration_s,
        "Stvor": method_total.get("POST", 0) / duration_s,
        "Onovl": method_total.get("PATCH", 0) / duration_s,
        "RC": eh_total_n / duration_s,
    }

    # ----- Raw per-span stats (for debugging / report) -----
    # Build the original per-method/per-span aggregate
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
                     "avg": avg(out_span[m][sp]),
                     "winsorized_avg": robust_avg(out_span[m][sp]),
                     "var": variance(out_span[m][sp])}
                for sp in out_span.get(m, {})
            },
        }

    # ----- Per-station per-class stats list summary (counts, CV²) -----
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

    return {
        "duration_s": duration_s,
        "stations": demands,
        "var_ms2": variances,
        "var_w_ms2": variances_w,
        "arrivals": arrivals,
        "raw": raw,
        "station_stats": station_stats,
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
                v = res["var_ms2"][cls]
                ss = res["station_stats"][cls]
                print(
                    f"  {cls:8s}: app={s['AppService']:.3f} (cv2={ss['AppService']['cv2']:.2f})  "
                    f"es={s['EventStore']:.3f} (cv2={ss['EventStore']['cv2']:.2f})  "
                    f"sn={s['SnapshotDB']:.3f} (cv2={ss['SnapshotDB']['cv2']:.2f})  "
                    f"pr={s['ProjectionDB']:.3f} (cv2={ss['ProjectionDB']['cv2']:.2f})   "
                    f"arr={res['arrivals'][cls]:.3f}/s"
                )
    out_path = Path(__file__).resolve().parent / "demands.json"
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
