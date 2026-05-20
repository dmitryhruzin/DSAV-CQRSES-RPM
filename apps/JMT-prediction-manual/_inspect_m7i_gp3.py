#!/usr/bin/env python3
"""Side-by-side seq vs load metrics for m7i-gp3, all 13 cells.

For each (station, class) cell, prints:
  - seq: n, mean, median, p90, p95, CV²
  - load: same
  - load/seq ratio for mean, median, p95
  - implied 'queueing overhead' = load_median - seq_median
"""

import csv
import json
from pathlib import Path
from collections import defaultdict

HERE = Path(__file__).resolve().parent
LOGS = HERE / "logs10-noretry"

MACH = "m7i-gp3-m_cqrs"

# (cell_label, span_formula_function)
CELLS = [
    ("AppService.Zapyty", "GET", lambda r: r.get("query.execute", 0) - r.get("db.projection.read", 0)),
    ("ProjectionDB.Zapyty", "GET", lambda r: r.get("db.projection.read", 0)),
    ("AppService.Stvor", "POST", lambda r: r.get("command.execute", 0) + r.get("event.publishAll", 0)
                                          - r.get("db.eventstore.write", 0) - r.get("db.snapshot.read", 0)
                                          - r.get("db.snapshot.write", 0)),
    ("EventStore.Stvor", "POST", lambda r: r.get("db.eventstore.write", 0)),
    ("SnapshotDB.Stvor", "POST", lambda r: r.get("db.snapshot.read", 0) + r.get("db.snapshot.write", 0)),
    ("AppService.RC.POST", "POST", lambda r: r.get("event.handle", 0) - r.get("db.projection.write", 0)),
    ("ProjectionDB.RC.POST", "POST", lambda r: r.get("db.projection.write", 0)),
    ("AppService.Onovl", "PATCH", lambda r: r.get("command.execute", 0) + r.get("event.publishAll", 0)
                                          - r.get("db.eventstore.write", 0) - r.get("db.snapshot.read", 0)
                                          - r.get("db.snapshot.write", 0)),
    ("EventStore.Onovl", "PATCH", lambda r: r.get("db.eventstore.write", 0)),
    ("SnapshotDB.Onovl", "PATCH", lambda r: r.get("db.snapshot.read", 0) + r.get("db.snapshot.write", 0)),
    ("AppService.RC.PATCH", "PATCH", lambda r: r.get("event.handle", 0) - r.get("db.projection.read", 0) - r.get("db.projection.write", 0)),
    ("ProjectionDB.RC.PATCH.read", "PATCH", lambda r: r.get("db.projection.read", 0)),
    ("ProjectionDB.RC.PATCH.write", "PATCH", lambda r: r.get("db.projection.write", 0)),
]


def collect(path: Path):
    by_req = {}
    with path.open() as f:
        for ln in f:
            if not ln.strip(): continue
            try: e = json.loads(ln)
            except: continue
            req = e.get("req") or {}
            rid = req.get("id")
            method = req.get("method")
            if not rid: continue
            sp = e.get("span")
            d = e.get("durationMs")
            if d is None: continue
            r = by_req.setdefault(rid, {"_method": method})
            if sp:
                r[sp] = r.get(sp, 0) + d
    return by_req


def stats(vals):
    s = sorted(vals); n = len(s)
    if n == 0: return None
    mean = sum(s)/n
    var = sum((x-mean)**2 for x in s)/n
    cv2 = var/(mean*mean) if mean > 0 else 0
    return {
        "n": n,
        "mean": mean,
        "median": s[n//2] if n % 2 else (s[n//2-1]+s[n//2])/2,
        "p90": s[int(0.9*(n-1))],
        "p95": s[int(0.95*(n-1))],
        "cv2": cv2,
    }


by_seq = collect(LOGS / f"{MACH}-seq.log")
by_load = collect(LOGS / f"{MACH}-load.log")

print(f"# Cell-by-cell seq vs load for {MACH}\n")
print(f"{'Cell':28s} | {'src':4s} | {'n':>5s} | {'mean':>6s} | {'med':>6s} | {'p90':>6s} | {'p95':>6s} | {'CV²':>6s}")
print("-" * 100)

results = {}
for name, method, fn in CELLS:
    seq_vals = []
    load_vals = []
    for r in by_seq.values():
        if r.get("_method") != method: continue
        v = fn(r)
        if v >= 0: seq_vals.append(v)
    for r in by_load.values():
        if r.get("_method") != method: continue
        v = fn(r)
        if v >= 0: load_vals.append(v)
    s_st = stats(seq_vals)
    l_st = stats(load_vals)
    results[name] = (s_st, l_st)
    if s_st:
        print(f"{name:28s} | seq  | {s_st['n']:>5d} | {s_st['mean']:>6.3f} | {s_st['median']:>6.3f} | {s_st['p90']:>6.3f} | {s_st['p95']:>6.3f} | {s_st['cv2']:>6.2f}")
    if l_st:
        print(f"{name:28s} | load | {l_st['n']:>5d} | {l_st['mean']:>6.3f} | {l_st['median']:>6.3f} | {l_st['p90']:>6.3f} | {l_st['p95']:>6.3f} | {l_st['cv2']:>6.2f}")
    if s_st and l_st:
        r_mean = l_st['mean']/s_st['mean'] if s_st['mean'] > 0 else 0
        r_med = l_st['median']/s_st['median'] if s_st['median'] > 0 else 0
        r_p95 = l_st['p95']/s_st['p95'] if s_st['p95'] > 0 else 0
        print(f"{'':28s} | rat  |       | {r_mean:>5.2f}x | {r_med:>5.2f}x | {'':>6s} | {r_p95:>5.2f}x |")
    print()
