#!/usr/bin/env python3
"""Export 3 summary tables (mean/median/p95) for log-analisis-load.md
with measured/predicted (Exp 6 JMT)/MRE per machine, per 5 metrics:
  - POST responseTime
  - POST req_start → last event.handle end  (POST RC_lag)
  - PATCH responseTime
  - PATCH req_start → last event.handle end (PATCH RC_lag)
  - GET responseTime
"""

import csv
import json
import random
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGS = HERE / "logs10-noretry"
MODELS = HERE / "models"
EXP = "exp6"

CLASSES_CYR = {
    "Zapyty": "Запити",
    "Stvor":  "Команди створення",
    "Onovl":  "Команди оновлення",
    "RC":     "Процеси досягнення узгодженості",
}

MACHINES = ["m7i-gp3-m_cqrs", "m7i-io2-m_cqrs", "m7a-gp3-m_cqrs", "m7a-io2-m_cqrs"]


def read_csv_ms(path):
    out = []
    if not path.exists(): return out
    with path.open() as f:
        rdr = csv.reader(f)
        try: header = next(rdr)
        except StopIteration: return out
        idx = 1
        try: idx = header.index("SAMPLE")
        except ValueError: pass
        for row in rdr:
            if len(row) <= idx: continue
            try:
                v = float(row[idx])
                if v >= 0: out.append(v * 1000.0)
            except: continue
    return out


def stats_of(vals):
    if not vals: return None
    s = sorted(vals); n = len(s)
    return {
        "n": n,
        "mean": sum(s)/n,
        "median": s[n//2] if n % 2 else (s[n//2-1] + s[n//2])/2,
        "p95": s[int(0.95 * (n - 1))],
    }


def measured_for(machine):
    """For each method (POST/PATCH/GET), return:
       - responseTime stats per method
       - per-request 'req_start → last event.handle end' stats for POST and PATCH"""
    path = LOGS / f"{machine}-load.log"
    rt = {"GET": [], "POST": [], "PATCH": []}
    rc_lag_post = []
    rc_lag_patch = []
    req_method = {}
    req_start = {}
    req_eh_end = {}
    with path.open() as f:
        for ln in f:
            if not ln.strip(): continue
            try: e = json.loads(ln)
            except: continue
            sp = e.get("span")
            if not sp: continue
            req = e.get("req") or {}
            rid = req.get("id")
            m = req.get("method")
            d = e.get("durationMs"); st = e.get("startedAt")
            if sp == "http.request":
                if d is None or m not in rt: continue
                rt[m].append(d)
                if rid:
                    req_method[rid] = m
                    req_start[rid] = st
            elif sp == "event.handle":
                if rid and d is not None and st is not None:
                    end = st + d
                    if rid not in req_eh_end or end > req_eh_end[rid]:
                        req_eh_end[rid] = end
    for rid, eh_end in req_eh_end.items():
        st0 = req_start.get(rid)
        m = req_method.get(rid)
        if st0 is None or m is None: continue
        lag = eh_end - st0
        if m == "POST": rc_lag_post.append(lag)
        elif m == "PATCH": rc_lag_patch.append(lag)
    return {
        "POST RT": stats_of(rt["POST"]),
        "POST RC_lag": stats_of(rc_lag_post),
        "PATCH RT": stats_of(rt["PATCH"]),
        "PATCH RC_lag": stats_of(rc_lag_patch),
        "GET RT": stats_of(rt["GET"]),
    }


def predicted_for(machine):
    """Predicted stats from JMT exp6 samples.
       - POST/PATCH/GET RT directly from JMT class samples (Stvor/Onovl/Zapyty)
       - POST RC_lag = sample-convolve Stvor + RC
       - PATCH RC_lag = sample-convolve Onovl + RC"""
    log_dir = MODELS / f"{machine}_{EXP}_logs"
    samples = {code: read_csv_ms(log_dir / f"Стоп_{cyr}_Response Time per Sink.csv")
               for code, cyr in CLASSES_CYR.items()}
    rng = random.Random(42)
    # POST RC_lag = Stvor + RC pairs
    stvor = samples["Stvor"][:]; onovl = samples["Onovl"][:]; rc = samples["RC"][:]
    rng.shuffle(stvor); rng.shuffle(rc)
    n = min(len(stvor), len(rc))
    post_rc = [stvor[i] + rc[i] for i in range(n)]
    rng.shuffle(onovl); rc2 = rc[:]; rng.shuffle(rc2)
    n = min(len(onovl), len(rc2))
    patch_rc = [onovl[i] + rc2[i] for i in range(n)]
    return {
        "POST RT": stats_of(samples["Stvor"]),
        "POST RC_lag": stats_of(post_rc),
        "PATCH RT": stats_of(samples["Onovl"]),
        "PATCH RC_lag": stats_of(patch_rc),
        "GET RT": stats_of(samples["Zapyty"]),
    }


def mre(p, m):
    if p is None or m is None or m == 0: return None
    return (p - m) / m * 100.0


data = {}
for mach in MACHINES:
    data[mach] = {"measured": measured_for(mach), "predicted": predicted_for(mach)}

METRICS = ["POST RT", "POST RC_lag", "PATCH RT", "PATCH RC_lag", "GET RT"]


def short(m): return m.replace("-m_cqrs", " m_cqrs")


for stat in ("mean", "median", "p95"):
    print(f"\n### {stat.capitalize()} (мс)\n")
    print(f"| Machine + variation | source     |  POST RT | POST RC_lag |  PATCH RT | PATCH RC_lag |  GET RT |")
    print(f"| ------------------- | ---------- | -------: | ----------: | --------: | -----------: | ------: |")
    for mach in MACHINES:
        sm = short(mach)
        meas = data[mach]["measured"]
        pred = data[mach]["predicted"]
        m_row = f"| {sm:19s} | measured   |"
        p_row = f"| {sm:19s} | predicted  |"
        e_row = f"| {sm:19s} | MRE        |"
        for m in METRICS:
            mv = meas[m][stat] if meas[m] else None
            pv = pred[m][stat] if pred[m] else None
            m_row += f" {mv:>8.3f} |" if mv is not None else "    —    |"
            p_row += f" {pv:>8.3f} |" if pv is not None else "    —    |"
            err = mre(pv, mv)
            e_row += f" {err:>+7.2f}% |" if err is not None else "    —    |"
        print(m_row)
        print(p_row)
        print(e_row)
