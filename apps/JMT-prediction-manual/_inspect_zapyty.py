#!/usr/bin/env python3
"""Inspect Zapyty (GET) metrics across machines: seq vs load, K-prediction sanity."""

import json
from pathlib import Path
from collections import defaultdict

HERE = Path(__file__).resolve().parent
fits_seq = json.load(open(HERE / 'experiment-fits.json'))
fits_load = json.load(open(HERE / 'experiment-fits-load.json'))

cells_zapyty = {
    'AppService.Zapyty': 'AppService.Zapyty (query.execute − db.projection.read)',
    'ProjectionDB.Zapyty': 'ProjectionDB.Zapyty (db.projection.read)',
}

machines = ['m7i-gp3-m_cqrs', 'm7i-io2-m_cqrs', 'm7a-gp3-m_cqrs', 'm7a-io2-m_cqrs']

print("=" * 90)
print("Per-cell mean (ms) for Zapyty across machines")
print("=" * 90)
print(f"{'cell':25s} | {'machine':22s} | {'seq mean':>10s} | {'load mean':>10s} | {'load/seq':>10s}")
print("-" * 90)
for cell_short, cell_full in cells_zapyty.items():
    for m in machines:
        s = fits_seq['perMachine'][m]['GET'][cell_full]['mean']
        l = fits_load['perMachine'][m]['GET'][cell_full]['mean']
        ratio = l / s if s > 0 else float('nan')
        print(f"{cell_short:25s} | {m:22s} | {s:>10.3f} | {l:>10.3f} | {ratio:>10.2f}")
    print("-" * 90)

print()
print("=" * 90)
print("Sum AppService + ProjectionDB (predicted GET service time without queueing)")
print("=" * 90)
print(f"{'machine':22s} | {'seq sum':>10s} | {'load sum':>10s}")
print("-" * 90)
for m in machines:
    s_app = fits_seq['perMachine'][m]['GET'][cells_zapyty['AppService.Zapyty']]['mean']
    s_pr  = fits_seq['perMachine'][m]['GET'][cells_zapyty['ProjectionDB.Zapyty']]['mean']
    l_app = fits_load['perMachine'][m]['GET'][cells_zapyty['AppService.Zapyty']]['mean']
    l_pr  = fits_load['perMachine'][m]['GET'][cells_zapyty['ProjectionDB.Zapyty']]['mean']
    print(f"{m:22s} | {s_app + s_pr:>10.3f} | {l_app + l_pr:>10.3f}")

print()
print("=" * 90)
print("MEASURED end-to-end GET RT (http.request.durationMs) per machine — load logs")
print("=" * 90)
LOGS = HERE / "logs10-noretry"
print(f"{'machine':22s} | {'mean':>8s} | {'median':>8s} | {'p90':>8s} | {'p95':>8s} | {'n':>6s}")
print("-" * 90)
measured = {}
for m in machines:
    samples = []
    with (LOGS / f"{m}-load.log").open() as f:
        for ln in f:
            if not ln.strip():
                continue
            try:
                e = json.loads(ln)
            except Exception:
                continue
            if e.get("span") != "http.request":
                continue
            req = e.get("req") or {}
            if req.get("method") != "GET":
                continue
            d = e.get("durationMs")
            if d is None:
                continue
            samples.append(d)
    samples.sort()
    n = len(samples)
    mean = sum(samples) / n
    median = samples[n // 2]
    p90 = samples[int(0.9 * (n - 1))]
    p95 = samples[int(0.95 * (n - 1))]
    measured[m] = {'mean': mean, 'median': median, 'p90': p90, 'p95': p95, 'n': n}
    print(f"{m:22s} | {mean:>8.3f} | {median:>8.3f} | {p90:>8.3f} | {p95:>8.3f} | {n:>6d}")

print()
print("=" * 90)
print("K_disk(GET) — io2/gp3 ratio for both intel and amd, both sources")
print("=" * 90)
print(f"{'cell':25s} | {'K m7i (seq)':>12s} | {'K m7i (load)':>13s} | {'K m7a (seq)':>12s} | {'K m7a (load)':>13s}")
print("-" * 90)
for cell_short, cell_full in cells_zapyty.items():
    K_m7i_seq  = fits_seq['perMachine']['m7i-io2-m_cqrs']['GET'][cell_full]['mean']  / fits_seq['perMachine']['m7i-gp3-m_cqrs']['GET'][cell_full]['mean']
    K_m7i_load = fits_load['perMachine']['m7i-io2-m_cqrs']['GET'][cell_full]['mean'] / fits_load['perMachine']['m7i-gp3-m_cqrs']['GET'][cell_full]['mean']
    K_m7a_seq  = fits_seq['perMachine']['m7a-io2-m_cqrs']['GET'][cell_full]['mean']  / fits_seq['perMachine']['m7a-gp3-m_cqrs']['GET'][cell_full]['mean']
    K_m7a_load = fits_load['perMachine']['m7a-io2-m_cqrs']['GET'][cell_full]['mean'] / fits_load['perMachine']['m7a-gp3-m_cqrs']['GET'][cell_full]['mean']
    print(f"{cell_short:25s} | {K_m7i_seq:>12.3f} | {K_m7i_load:>13.3f} | {K_m7a_seq:>12.3f} | {K_m7a_load:>13.3f}")

print()
print("Total GET RT measured ratio io2/gp3 (independent reality check):")
print(f"  m7i: {measured['m7i-io2-m_cqrs']['mean'] / measured['m7i-gp3-m_cqrs']['mean']:.3f}")
print(f"  m7a: {measured['m7a-io2-m_cqrs']['mean'] / measured['m7a-gp3-m_cqrs']['mean']:.3f}")
