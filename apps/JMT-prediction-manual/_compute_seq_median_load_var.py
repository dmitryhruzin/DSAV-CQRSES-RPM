#!/usr/bin/env python3
"""Compute Lognormal (μ, σ) for each (machine, cell) such that:

  E[X]     = median (from log-analisis-seq.md)
  Var(X)   = variance (from log-analisis-load.md)

For Lognormal:
  E[X]    = exp(μ + σ²/2)
  Var(X)  = (exp(σ²) − 1) · exp(2μ + σ²) = E[X]² · (exp(σ²) − 1)
  ⇒ CV²   = Var / E[X]²  =  exp(σ²) − 1
  ⇒ σ²    = ln(1 + CV²)
  ⇒ μ     = ln(E[X]) − σ²/2

So given M (target mean = seq median) and V (target variance = load variance):
  CV² = V / M²
  σ   = √ln(1 + CV²)
  μ   = ln(M) − σ²/2

Outputs a 13-cell table per machine.
"""

import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
fits_seq = json.load(open(HERE / "experiment-fits.json"))
fits_load = json.load(open(HERE / "experiment-fits-load.json"))

CELLS = [
    ("AppService.Zapyty",        "GET",   "AppService.Zapyty (query.execute − db.projection.read)"),
    ("ProjectionDB.Zapyty",      "GET",   "ProjectionDB.Zapyty (db.projection.read)"),
    ("AppService.Stvor",         "POST",  "AppService.Stvor (cmd+pub − ES − SN)"),
    ("EventStore.Stvor",         "POST",  "EventStore.Stvor (db.eventstore.write)"),
    ("SnapshotDB.Stvor",         "POST",  "SnapshotDB.Stvor (db.snapshot.r+w)"),
    ("AppService.RC.POST",       "POST",  "AppService.RC.POST (event.handle − db.projection.write)"),
    ("ProjectionDB.RC.POST",     "POST",  "ProjectionDB.RC.POST (db.projection.write)"),
    ("AppService.Onovl",         "PATCH", "AppService.Onovl (cmd+pub − ES − SN)"),
    ("EventStore.Onovl",         "PATCH", "EventStore.Onovl (db.eventstore.write)"),
    ("SnapshotDB.Onovl",         "PATCH", "SnapshotDB.Onovl (db.snapshot.r+w)"),
    ("AppService.RC.PATCH",      "PATCH", "AppService.RC.PATCH (event.handle − db.projection.r − db.projection.w)"),
    ("ProjectionDB.RC.PATCH.r",  "PATCH", "ProjectionDB.RC.PATCH.read (db.projection.read)"),
    ("ProjectionDB.RC.PATCH.w",  "PATCH", "ProjectionDB.RC.PATCH.write (db.projection.write)"),
]

MACHINES = ["m7i-gp3-m_cqrs", "m7i-io2-m_cqrs", "m7a-gp3-m_cqrs", "m7a-io2-m_cqrs"]


def normal_cdf_inv_at_95():
    # Φ⁻¹(0.95) = 1.6449
    return 1.6449


for mach in MACHINES:
    print(f"\n## {mach}\n")
    print(f"| {'Cell':24s} | {'M=seq_med':>9s} | {'V=load_var':>10s} | {'CV²':>7s} | {'σ':>6s} | {'μ':>7s} | {'implied mean':>12s} | {'implied p95':>11s} |")
    print(f"| {'-'*24} | {'-'*9} | {'-'*10} | {'-'*7} | {'-'*6} | {'-'*7} | {'-'*12} | {'-'*11} |")
    for short, method, full in CELLS:
        s = fits_seq["perMachine"][mach][method].get(full)
        l = fits_load["perMachine"][mach][method].get(full)
        if not s or not l:
            continue
        M = s["median"]
        V = l["variance"]
        cv2 = V / (M * M) if M > 0 else float("inf")
        s2 = math.log(1 + cv2)
        sigma = math.sqrt(s2)
        mu = math.log(M) - s2 / 2
        implied_mean = math.exp(mu + s2 / 2)
        implied_p95 = math.exp(mu + 1.6449 * sigma)
        print(f"| {short:24s} | {M:>9.4f} | {V:>10.4f} | {cv2:>7.2f} | {sigma:>6.3f} | {mu:>7.3f} | {implied_mean:>12.4f} | {implied_p95:>11.4f} |")
