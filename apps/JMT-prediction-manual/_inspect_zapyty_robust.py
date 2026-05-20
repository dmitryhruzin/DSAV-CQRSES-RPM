#!/usr/bin/env python3
"""Compare mean vs median for Zapyty cells across machines.

If load mean >> load median on some machines, that's tail noise inflating mean,
not a real service-time signal.
"""

import json
from pathlib import Path
from statistics import median

HERE = Path(__file__).resolve().parent
LOGS = HERE / "logs10-noretry"

machines = ['m7i-gp3-m_cqrs', 'm7i-io2-m_cqrs', 'm7a-gp3-m_cqrs', 'm7a-io2-m_cqrs']


def collect_zapyty_spans(log_path: Path):
    """Per-request: sum of (query.execute − db.projection.read) for App, db.projection.read for PR."""
    by_req = {}  # rid → spans dict
    with log_path.open() as f:
        for ln in f:
            if not ln.strip():
                continue
            try:
                e = json.loads(ln)
            except Exception:
                continue
            req = e.get("req") or {}
            if req.get("method") != "GET":
                continue
            rid = req.get("id")
            if not rid:
                continue
            sp = e.get("span")
            d = e.get("durationMs")
            if d is None:
                continue
            r = by_req.setdefault(rid, {})
            r[sp] = r.get(sp, 0) + d

    app_samples = []
    pr_samples = []
    for r in by_req.values():
        q = r.get("query.execute", 0)
        pr = r.get("db.projection.read", 0)
        app = q - pr
        if app >= 0:
            app_samples.append(app)
        if pr >= 0:
            pr_samples.append(pr)
    return app_samples, pr_samples


def stats(vals):
    s = sorted(vals)
    n = len(s)
    if n == 0:
        return None
    mean = sum(s) / n
    p50 = s[n // 2]
    p90 = s[int(0.9 * (n - 1))]
    p95 = s[int(0.95 * (n - 1))]
    p99 = s[int(0.99 * (n - 1))]
    # Trimmed mean: drop top 1% outliers
    trim_n = max(1, int(0.01 * n))
    trimmed_mean = sum(s[:-trim_n]) / max(1, n - trim_n)
    return {
        'n': n,
        'mean': mean,
        'median': p50,
        'p90': p90,
        'p95': p95,
        'p99': p99,
        'trimmed_mean_1pct': trimmed_mean,
    }


print("=" * 110)
print("AppService.Zapyty (query.execute − db.projection.read), ms — SEQ vs LOAD")
print("=" * 110)
print(f"{'machine':22s} | {'src':4s} | {'n':>5s} | {'mean':>7s} | {'median':>7s} | {'trim_1%':>7s} | {'p95':>7s} | {'p99':>7s} | mean/median")
print("-" * 110)
for m in machines:
    for src in ['seq', 'load']:
        app, pr = collect_zapyty_spans(LOGS / f"{m}-{src}.log")
        s = stats(app)
        ratio = s['mean'] / s['median'] if s['median'] > 0 else float('nan')
        print(f"{m:22s} | {src:4s} | {s['n']:>5d} | {s['mean']:>7.3f} | {s['median']:>7.3f} | {s['trimmed_mean_1pct']:>7.3f} | {s['p95']:>7.3f} | {s['p99']:>7.3f} | {ratio:>7.2f}x")
    print()

print("=" * 110)
print("ProjectionDB.Zapyty (db.projection.read), ms — SEQ vs LOAD")
print("=" * 110)
print(f"{'machine':22s} | {'src':4s} | {'n':>5s} | {'mean':>7s} | {'median':>7s} | {'trim_1%':>7s} | {'p95':>7s} | {'p99':>7s} | mean/median")
print("-" * 110)
for m in machines:
    for src in ['seq', 'load']:
        app, pr = collect_zapyty_spans(LOGS / f"{m}-{src}.log")
        s = stats(pr)
        ratio = s['mean'] / s['median'] if s['median'] > 0 else float('nan')
        print(f"{m:22s} | {src:4s} | {s['n']:>5d} | {s['mean']:>7.3f} | {s['median']:>7.3f} | {s['trimmed_mean_1pct']:>7.3f} | {s['p95']:>7.3f} | {s['p99']:>7.3f} | {ratio:>7.2f}x")
    print()
