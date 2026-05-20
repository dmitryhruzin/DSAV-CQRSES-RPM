#!/usr/bin/env python3
"""Export all numbers needed for docs/exp6-design.md.

Prints:
- Per-cell seq mean/median/CV² (4 machines)
- Per-cell load σ_MLE (4 machines)
- K-coefficients on means vs medians (m7i pair)
- Final predicted m7a-io2 params (μ, σ)
- Implied mean and comparison vs measured
- Brunnert variant with median calibration
- Hybrid variant with median calibration
"""

import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
fits_seq = json.load(open(HERE / 'experiment-fits.json'))
fits_load = json.load(open(HERE / 'experiment-fits-load.json'))

CELLS = [
    ('AppService.Zapyty (query.execute − db.projection.read)', 'GET'),
    ('ProjectionDB.Zapyty (db.projection.read)', 'GET'),
    ('AppService.Stvor (cmd+pub − ES − SN)', 'POST'),
    ('EventStore.Stvor (db.eventstore.write)', 'POST'),
    ('SnapshotDB.Stvor (db.snapshot.r+w)', 'POST'),
    ('AppService.RC.POST (event.handle − db.projection.write)', 'POST'),
    ('ProjectionDB.RC.POST (db.projection.write)', 'POST'),
    ('AppService.Onovl (cmd+pub − ES − SN)', 'PATCH'),
    ('EventStore.Onovl (db.eventstore.write)', 'PATCH'),
    ('SnapshotDB.Onovl (db.snapshot.r+w)', 'PATCH'),
    ('AppService.RC.PATCH (event.handle − db.projection.r − db.projection.w)', 'PATCH'),
    ('ProjectionDB.RC.PATCH.read (db.projection.read)', 'PATCH'),
    ('ProjectionDB.RC.PATCH.write (db.projection.write)', 'PATCH'),
]

SHORT = {
    'AppService.Zapyty (query.execute − db.projection.read)': 'AppService.Zapyty',
    'ProjectionDB.Zapyty (db.projection.read)': 'ProjectionDB.Zapyty',
    'AppService.Stvor (cmd+pub − ES − SN)': 'AppService.Stvor',
    'EventStore.Stvor (db.eventstore.write)': 'EventStore.Stvor',
    'SnapshotDB.Stvor (db.snapshot.r+w)': 'SnapshotDB.Stvor',
    'AppService.RC.POST (event.handle − db.projection.write)': 'AppService.RC.POST',
    'ProjectionDB.RC.POST (db.projection.write)': 'ProjectionDB.RC.POST',
    'AppService.Onovl (cmd+pub − ES − SN)': 'AppService.Onovl',
    'EventStore.Onovl (db.eventstore.write)': 'EventStore.Onovl',
    'SnapshotDB.Onovl (db.snapshot.r+w)': 'SnapshotDB.Onovl',
    'AppService.RC.PATCH (event.handle − db.projection.r − db.projection.w)': 'AppService.RC.PATCH',
    'ProjectionDB.RC.PATCH.read (db.projection.read)': 'ProjectionDB.RC.PATCH.read',
    'ProjectionDB.RC.PATCH.write (db.projection.write)': 'ProjectionDB.RC.PATCH.write',
}

MACHINES = ['m7i-gp3-m_cqrs', 'm7i-io2-m_cqrs', 'm7a-gp3-m_cqrs', 'm7a-io2-m_cqrs']

def fmt(x, d=3):
    return f'{x:.{d}f}'

# === Шаг 1: метрики из seq на 4 машинах ===
print('\n## Шаг 1 — Метрики (seq, ms): mean, median, CV²\n')
for m in MACHINES:
    print(f'### {m}\n')
    print(f'| {"Cell":30s} | {"n":>5s} | {"mean":>6s} | {"median":>6s} | {"CV²":>6s} | {"mean/median":>11s} |')
    print(f'| {"":-<30s} | {":---:":>5s} | {":---:":>6s} | {":---:":>6s} | {":---:":>6s} | {":---:":>11s} |')
    for cell_full, method in CELLS:
        s = fits_seq['perMachine'][m][method].get(cell_full)
        if not s:
            continue
        ratio = s['mean'] / s['median'] if s['median'] > 0 else float('nan')
        print(f'| {SHORT[cell_full]:30s} | {s["n"]:>5d} | {fmt(s["mean"]):>6s} | {fmt(s["median"]):>6s} | {fmt(s["cv2"], 2):>6s} | {ratio:>10.3f}x |')
    print()

# === Шаг 2: σ из load (MLE) ===
print('\n## Шаг 2 — σ из load (MLE) на 4 машинах\n')
for m in MACHINES:
    print(f'### {m}\n')
    print(f'| {"Cell":30s} | {"mean_load":>9s} | {"σ_load_MLE":>11s} | {"CV²_load":>9s} |')
    print(f'| {"":-<30s} | {":---:":>9s} | {":---:":>11s} | {":---:":>9s} |')
    for cell_full, method in CELLS:
        l = fits_load['perMachine'][m][method].get(cell_full)
        if not l:
            continue
        print(f'| {SHORT[cell_full]:30s} | {fmt(l["mean"]):>9s} | {fmt(l["exp1"]["sigma"]):>11s} | {fmt(l["cv2"], 2):>9s} |')
    print()

# === Шаг 3: K-коэффициенты ===
print('\n## Шаг 3 — K_disk на mean vs median (m7i пара)\n')
print(f'| {"Cell":30s} | {"mean_gp3":>8s} | {"mean_io2":>8s} | {"K_mean":>7s} | {"med_gp3":>7s} | {"med_io2":>7s} | {"K_median":>9s} |')
print(f'| {"":-<30s} | {":---:":>8s} | {":---:":>8s} | {":---:":>7s} | {":---:":>7s} | {":---:":>7s} | {":---:":>9s} |')
for cell_full, method in CELLS:
    gp3 = fits_seq['perMachine']['m7i-gp3-m_cqrs'][method].get(cell_full)
    io2 = fits_seq['perMachine']['m7i-io2-m_cqrs'][method].get(cell_full)
    if not gp3 or not io2:
        continue
    K_mean = io2['mean'] / gp3['mean']
    K_med = io2['median'] / gp3['median']
    print(f'| {SHORT[cell_full]:30s} | {fmt(gp3["mean"]):>8s} | {fmt(io2["mean"]):>8s} | {fmt(K_mean):>7s} | {fmt(gp3["median"]):>7s} | {fmt(io2["median"]):>7s} | {fmt(K_med):>9s} |')

# === Шаг 4: финальные параметры predicted m7a-io2 ===
print('\n## Шаг 4 — Финальные параметры predicted m7a-io2 для Exp 6\n')
print('Формула: σ = σ_load_MLE(m7a-gp3); μ = ln(median_seq(m7a-gp3)) + ln(K_median) − σ²/2\n')
print(f'| {"Cell":30s} | {"med_seq_m7a-gp3":>15s} | {"K_median":>9s} | {"σ_load":>7s} | {"μ_pred":>7s} | {"impl_mean":>10s} | {"meas_seq_m7a-io2":>16s} |')
print(f'| {"":-<30s} | {":---:":>15s} | {":---:":>9s} | {":---:":>7s} | {":---:":>7s} | {":---:":>10s} | {":---:":>16s} |')
for cell_full, method in CELLS:
    src = fits_seq['perMachine']['m7a-gp3-m_cqrs'][method].get(cell_full)
    gp3 = fits_seq['perMachine']['m7i-gp3-m_cqrs'][method].get(cell_full)
    io2 = fits_seq['perMachine']['m7i-io2-m_cqrs'][method].get(cell_full)
    target = fits_seq['perMachine']['m7a-io2-m_cqrs'][method].get(cell_full)
    load = fits_load['perMachine']['m7a-gp3-m_cqrs'][method].get(cell_full)
    if not (src and gp3 and io2 and target and load):
        continue
    K_med = io2['median'] / gp3['median']
    sigma = load['exp1']['sigma']
    mu_pred = math.log(src['median']) + math.log(K_med) - sigma * sigma / 2
    implied_mean = math.exp(mu_pred + sigma * sigma / 2)  # = median × K_median
    print(f'| {SHORT[cell_full]:30s} | {fmt(src["median"]):>15s} | {fmt(K_med):>9s} | {fmt(sigma):>7s} | {fmt(mu_pred):>7s} | {fmt(implied_mean):>10s} | {fmt(target["mean"]):>16s} |')

# === Шаг 5: сравнение Exp 5 vs Exp 6 service time ===
print('\n## Шаг 5 — Sanity check: implied mean Exp 5 vs Exp 6 vs measured\n')
print(f'| {"Cell":30s} | {"meas_m7a-io2":>12s} | {"Exp5 impl":>9s} | {"Exp5 Δ%":>8s} | {"Exp6 impl":>9s} | {"Exp6 Δ%":>8s} |')
print(f'| {"":-<30s} | {":---:":>12s} | {":---:":>9s} | {":---:":>8s} | {":---:":>9s} | {":---:":>8s} |')
e5_errs, e6_errs = [], []
for cell_full, method in CELLS:
    src = fits_seq['perMachine']['m7a-gp3-m_cqrs'][method].get(cell_full)
    gp3 = fits_seq['perMachine']['m7i-gp3-m_cqrs'][method].get(cell_full)
    io2 = fits_seq['perMachine']['m7i-io2-m_cqrs'][method].get(cell_full)
    target = fits_seq['perMachine']['m7a-io2-m_cqrs'][method].get(cell_full)
    load = fits_load['perMachine']['m7a-gp3-m_cqrs'][method].get(cell_full)
    if not (src and gp3 and io2 and target and load):
        continue
    K_mean = io2['mean'] / gp3['mean']
    K_med = io2['median'] / gp3['median']
    sigma = load['exp1']['sigma']
    impl_e5 = src['mean'] * K_mean
    impl_e6 = src['median'] * K_med
    meas = target['mean']
    e5_pct = (impl_e5 - meas) / meas * 100
    e6_pct = (impl_e6 - meas) / meas * 100
    e5_errs.append(abs(e5_pct))
    e6_errs.append(abs(e6_pct))
    print(f'| {SHORT[cell_full]:30s} | {fmt(meas):>12s} | {fmt(impl_e5):>9s} | {e5_pct:>+7.2f}% | {fmt(impl_e6):>9s} | {e6_pct:>+7.2f}% |')

print(f'\n**Mean |Δ%|:** Exp 5 = {sum(e5_errs)/len(e5_errs):.2f}%, Exp 6 = {sum(e6_errs)/len(e6_errs):.2f}%')

# === Шаг 6: AppService demand check ===
print('\n## Шаг 6 — AppService CPU demand Exp 5 vs Exp 6\n')
print('AppService capacity = 2 vCPU = 2000 ms/sec\n')

# Arrival rates from compute_arrival_rates
arr = {
    'm7i-gp3-m_cqrs': {'GET': 102.964, 'POST': 102.634, 'PATCH': 155.614, 'RC': 289.054},
    'm7i-io2-m_cqrs': {'GET': 98.014, 'POST': 98.648, 'PATCH': 144.274, 'RC': 272.270},
    'm7a-gp3-m_cqrs': {'GET': 102.346, 'POST': 102.123, 'PATCH': 151.115, 'RC': 284.299},
    'm7a-io2-m_cqrs': {'GET': 97.312, 'POST': 99.207, 'PATCH': 148.533, 'RC': 277.944},
}

cells_for_app = {
    'GET':   'AppService.Zapyty (query.execute − db.projection.read)',
    'POST':  'AppService.Stvor (cmd+pub − ES − SN)',
    'PATCH': 'AppService.Onovl (cmd+pub − ES − SN)',
    'RC':    'AppService.RC.POST (event.handle − db.projection.write)',
}

print(f'| {"machine":22s} | {"E5 demand":>9s} | {"E5 util":>7s} | {"E6 demand":>9s} | {"E6 util":>7s} |')
print(f'| {"":-<22s} | {":---:":>9s} | {":---:":>7s} | {":---:":>9s} | {":---:":>7s} |')
for m in MACHINES:
    src = fits_seq['perMachine'][m] if m != 'm7a-io2-m_cqrs' else None
    base = 'm7a-gp3-m_cqrs' if m == 'm7a-io2-m_cqrs' else m
    src_b = fits_seq['perMachine'][base]
    gp3 = fits_seq['perMachine']['m7i-gp3-m_cqrs']
    io2 = fits_seq['perMachine']['m7i-io2-m_cqrs']

    e5 = 0
    e6 = 0
    for method_key, cell in cells_for_app.items():
        method = 'POST' if method_key == 'RC' else method_key
        s = src_b[method][cell]
        if m == 'm7a-io2-m_cqrs':
            K_mean = io2[method][cell]['mean'] / gp3[method][cell]['mean']
            K_med = io2[method][cell]['median'] / gp3[method][cell]['median']
            mean_e5 = s['mean'] * K_mean
            mean_e6 = s['median'] * K_med
        else:
            mean_e5 = s['mean']
            mean_e6 = s['median']
        rate = arr[m][method_key]
        e5 += rate * mean_e5
        e6 += rate * mean_e6
    print(f'| {m:22s} | {e5:>8.0f}ms | {e5/2000:>6.1%} | {e6:>8.0f}ms | {e6/2000:>6.1%} |')
