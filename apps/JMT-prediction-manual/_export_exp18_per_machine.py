#!/usr/bin/env python3
"""Export per-machine measured/predicted/MRE tables for Exp 18.

Exp 18: "Corrected lognormal — median-anchored, no σ²/2 subtraction".
Like exp16 but μ = ln(median_seq) directly (NO σ²/2 subtraction), so that
median(fitted) = median_seq. σ = σ_load_MLE (same as exp16/exp17).

Builds for each of 4 machines:
  - Measured: from load logs (http.request.durationMs per class + RC_lag via event.handle)
  - Predicted: from JMT exp18 CSVs (per class, with RC_lag = Stvor/Onovl + RC convolution
    weighted by measured POST/PATCH ratio).
  - MRE: (predicted − measured) / measured × 100
Three tables: mean, median, p95.
"""

import csv
import json
import random
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
LOGS = HERE / "logs10-noretry"

CLASSES_CYR = {
    "Zapyty": "Запити",
    "Stvor":  "Команди створення",
    "Onovl":  "Команди оновлення",
    "RC":     "Процеси досягнення узгодженості",
}

MACHINES = ["m7i-gp3-m_cqrs", "m7i-io2-m_cqrs", "m7a-gp3-m_cqrs", "m7a-io2-m_cqrs"]
EXP = "exp18"

def read_csv_samples_ms(path):
    out = []
    if not path.exists():
        return out
    with path.open() as f:
        rdr = csv.reader(f)
        try:
            header = next(rdr)
        except StopIteration:
            return out
        idx = 1
        try:
            idx = header.index("SAMPLE")
        except ValueError:
            pass
        for row in rdr:
            if len(row) <= idx:
                continue
            try:
                v = float(row[idx])
                if v >= 0:
                    out.append(v * 1000.0)
            except Exception:
                continue
    return out

def stats_of(vals):
    if not vals:
        return None
    s = sorted(vals); n = len(s)
    return {
        "n": n,
        "mean": sum(s) / n,
        "median": s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2,
        "p90": s[int(0.9 * (n - 1))],
        "p95": s[int(0.95 * (n - 1))],
    }

def measured_for(machine):
    """Per-class measured RT distribution + RC_lag end-to-end from load log."""
    path = LOGS / f"{machine}-load.log"
    per = defaultdict(list)
    req_start = {}; req_eh = {}
    counts = {"POST": 0, "PATCH": 0}
    with path.open() as f:
        for ln in f:
            if not ln.strip(): continue
            try: e = json.loads(ln)
            except Exception: continue
            sp = e.get("span")
            if not sp: continue
            d = e.get("durationMs"); st = e.get("startedAt")
            req = e.get("req") or {}; rid = req.get("id"); m = req.get("method")
            if sp == "http.request":
                if d is None: continue
                if m == "GET":   per["Zapyty"].append(d)
                elif m == "POST":
                    per["Stvor"].append(d); counts["POST"] += 1
                elif m == "PATCH":
                    per["Onovl"].append(d); counts["PATCH"] += 1
                if rid: req_start[rid] = st
            elif sp == "event.handle":
                if rid and d is not None:
                    end = (st or 0) + d
                    if rid not in req_eh or end > req_eh[rid]: req_eh[rid] = end
    for rid, eh_end in req_eh.items():
        st0 = req_start.get(rid)
        if st0 is None: continue
        per["RC_lag"].append(eh_end - st0)
    return {cls: stats_of(per[cls]) for cls in ("Zapyty", "Stvor", "Onovl", "RC_lag")}, counts

def predicted_samples(machine, exp):
    log_dir = MODELS / f"{machine}_{exp}_logs"
    return {
        code: read_csv_samples_ms(log_dir / f"Стоп_{cyr}_Response Time per Sink.csv")
        for code, cyr in CLASSES_CYR.items()
    }

def predicted_rc_lag(samples, n_post, n_patch):
    """Convolve command RT + RC handler RT, weighted by measured POST/PATCH ratio."""
    stvor = samples["Stvor"][:]; onovl = samples["Onovl"][:]; rc = samples["RC"][:]
    if not stvor or not onovl or not rc:
        return None
    rng = random.Random(42)
    rng.shuffle(stvor); rng.shuffle(rc)
    n = min(len(stvor), len(rc))
    post_lag = [stvor[i] + rc[i] for i in range(n)]
    rng.shuffle(onovl); rc2 = rc[:]; rng.shuffle(rc2)
    n = min(len(onovl), len(rc2))
    patch_lag = [onovl[i] + rc2[i] for i in range(n)]
    total = n_post + n_patch
    p_post = n_post / total
    N = 100_000
    rng.shuffle(post_lag); rng.shuffle(patch_lag)
    n_take_post = int(N * p_post)
    combined = post_lag[:n_take_post] + patch_lag[:N - n_take_post]
    return stats_of(combined)

def mre(p, m):
    if p is None or m is None or m == 0: return None
    return (p - m) / m * 100.0

# Collect data
data = {}
for mach in MACHINES:
    meas, counts = measured_for(mach)
    samples = predicted_samples(mach, EXP)
    rc_lag = predicted_rc_lag(samples, counts["POST"], counts["PATCH"])
    pred = {
        "Zapyty": stats_of(samples["Zapyty"]),
        "Stvor":  stats_of(samples["Stvor"]),
        "Onovl":  stats_of(samples["Onovl"]),
        "RC_lag": rc_lag,
    }
    data[mach] = {"measured": meas, "predicted": pred}

# Print tables
classes_display = ["Zapyty", "Stvor", "Onovl", "RC_lag"]

def short_machine(m):
    return m.replace("-m_cqrs", "")

for stat in ("mean", "median", "p95"):
    print(f"\n## {stat.upper()} per machine, Exp 18 (мс)\n")
    print(f"| machine          | source     | Zapyty | Stvor  | Onovl  | RC_lag |")
    print(f"| ---------------- | ---------- | -----: | -----: | -----: | -----: |")
    for mach in MACHINES:
        sm = short_machine(mach)
        meas = data[mach]["measured"]
        pred = data[mach]["predicted"]
        m_row = f"| {sm:16s} | measured   |"
        p_row = f"| {sm:16s} | predicted  |"
        e_row = f"| {sm:16s} | MRE        |"
        for cls in classes_display:
            mv = meas[cls][stat] if meas[cls] else None
            pv = pred[cls][stat] if pred[cls] else None
            m_row += f" {mv:>6.3f} |" if mv is not None else "    —   |"
            p_row += f" {pv:>6.3f} |" if pv is not None else "    —   |"
            err = mre(pv, mv)
            e_row += f" {err:>+6.2f}% |" if err is not None else "    —   |"
        print(m_row)
        print(p_row)
        print(e_row)
        print(f"| {'':16s} |            |        |        |        |        |")

# Aggregate |MRE| per machine + average
print("\n## Aggregate |MRE| Exp 18 per machine (mean of 4 classes)\n")
print(f"| machine          |   mean |   median |   p90  |   p95  |")
print(f"| ---------------- | -----: | -------: | -----: | -----: |")
for mach in MACHINES:
    sm = short_machine(mach)
    row = f"| {sm:16s} |"
    for stat in ("mean", "median", "p90", "p95"):
        meas = data[mach]["measured"]
        pred = data[mach]["predicted"]
        errs = []
        for cls in classes_display:
            mv = meas[cls][stat] if meas[cls] else None
            pv = pred[cls][stat] if pred[cls] else None
            e = mre(pv, mv)
            if e is not None: errs.append(abs(e))
        avg = sum(errs) / len(errs) if errs else None
        row += f" {avg:>5.2f}% |" if avg is not None else "    —  |"
    print(row)
