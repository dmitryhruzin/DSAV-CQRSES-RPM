#!/usr/bin/env python3
"""Diagnose double-counting: compute AppService CPU demand under seq vs load fits."""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
fits_seq = json.load(open(HERE / 'experiment-fits.json'))
fits_load = json.load(open(HERE / 'experiment-fits-load.json'))

cells = {
    'GET':   'AppService.Zapyty (query.execute − db.projection.read)',
    'POST':  'AppService.Stvor (cmd+pub − ES − SN)',
    'PATCH': 'AppService.Onovl (cmd+pub − ES − SN)',
    'RC':    'AppService.RC.POST (event.handle − db.projection.write)',  # POST method bucket
}

# Hardcoded arrival rates from earlier compute_arrival_rates output
arr = {
    'm7i-gp3-m_cqrs': (103, 103, 156, 289),
    'm7i-io2-m_cqrs': (98, 99, 144, 272),
    'm7a-gp3-m_cqrs': (102, 102, 151, 284),
    'm7a-io2-m_cqrs': (97, 99, 149, 278),
}

print("AppService mean service times (ms):")
print(f"  {'machine':22s} | {'GET':>15s} | {'POST':>15s} | {'PATCH':>15s} | {'RC':>15s}")
for mach in ['m7i-gp3-m_cqrs', 'm7i-io2-m_cqrs', 'm7a-gp3-m_cqrs', 'm7a-io2-m_cqrs']:
    parts = [f"{mach:22s}"]
    for method, cell in cells.items():
        rc_method = 'POST' if method == 'RC' else method
        s = fits_seq['perMachine'][mach][rc_method][cell]['mean']
        l = fits_load['perMachine'][mach][rc_method][cell]['mean']
        parts.append(f"{s:6.2f}s/{l:6.2f}l")
    print("  " + " | ".join(parts))

print()
print("CPU demand on AppService (2 vCPU → capacity = 2000 ms CPU per real second):")
print(f"  {'machine':22s} | {'seq demand':>12s} (util) | {'load demand':>12s} (util)")
for mach in ['m7i-gp3-m_cqrs', 'm7i-io2-m_cqrs', 'm7a-gp3-m_cqrs', 'm7a-io2-m_cqrs']:
    z, st, ov, rc = arr[mach]
    d_seq = 0; d_load = 0
    for method, cell in cells.items():
        rc_method = 'POST' if method == 'RC' else method
        s = fits_seq['perMachine'][mach][rc_method][cell]['mean']
        l = fits_load['perMachine'][mach][rc_method][cell]['mean']
        rate = {'GET': z, 'POST': st, 'PATCH': ov, 'RC': rc}[method]
        d_seq += rate * s
        d_load += rate * l
    print(f"  {mach:22s} | {d_seq:>10.0f} ms ({d_seq/2000:>5.1%}) | {d_load:>10.0f} ms ({d_load/2000:>5.1%})")
