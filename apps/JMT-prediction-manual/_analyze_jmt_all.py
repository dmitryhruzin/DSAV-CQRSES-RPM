#!/usr/bin/env python3
"""Analyse JMT results for ALL 4 machines × 3 experiments.

Calibration machines (m7i-gp3, m7i-io2, m7a-gp3): K NOT applied → MRE measures
model structural fidelity.
Predicted machine (m7a-io2): K applied → MRE = model + K-prediction error.

Difference between them isolates K-prediction error.
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
LOGS = HERE / "logs10-noretry"

CLASSES = {
    "Zapyty": "Запити",
    "Stvor":  "Команди створення",
    "Onovl":  "Команди оновлення",
    "RC":     "Процеси досягнення узгодженості",
}
MACHINES = ["m7i-gp3-m_cqrs", "m7i-io2-m_cqrs", "m7a-gp3-m_cqrs", "m7a-io2-m_cqrs"]
EXPS = ["exp1", "exp2", "exp3", "exp4", "exp5", "exp6", "exp7", "exp8", "exp9", "exp10", "exp11", "exp12", "exp13"]


def read_csv_samples_ms(path: Path) -> list[float]:
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
        try: idx = header.index("SAMPLE")
        except ValueError: pass
        for row in rdr:
            if len(row) <= idx:
                continue
            try:
                v = float(row[idx])
                if v >= 0: out.append(v * 1000.0)
            except Exception:
                continue
    return out


def stats_of(vals):
    if not vals: return {}
    s = sorted(vals); n = len(s)
    mean = sum(vals) / n
    median = s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
    pick = lambda p: s[min(n - 1, int(round(p * (n - 1))))]
    return {"n": n, "mean": mean, "median": median, "p90": pick(0.90), "p95": pick(0.95)}


def measured(machine):
    """Per-class measured RT distribution from <machine>-load.log."""
    path = LOGS / f"{machine}-load.log"
    per = defaultdict(list)
    req_start = {}; req_eh = {}
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
                elif m == "POST":  per["Stvor"].append(d)
                elif m == "PATCH": per["Onovl"].append(d)
                if rid: req_start[rid] = st
            elif sp == "event.handle":
                if rid and d is not None:
                    end = (st or 0) + d
                    if rid not in req_eh or end > req_eh[rid]: req_eh[rid] = end
    for rid, eh_end in req_eh.items():
        st0 = req_start.get(rid)
        if st0 is None: continue
        per["RC_lag"].append(eh_end - st0)
    return {cls: stats_of(per[cls]) for cls in ("Zapyty", "Stvor", "Onovl", "RC_lag")}


def predicted(machine, exp):
    log_dir = MODELS / f"{machine}_{exp}_logs"
    out = {}
    for code, cyr in CLASSES.items():
        out[code] = stats_of(read_csv_samples_ms(log_dir / f"Стоп_{cyr}_Response Time per Sink.csv"))
    return out


def mre(p, m):
    if p is None or m is None or m == 0: return None
    return (p - m) / m * 100.0


def main():
    stat_keys = ["mean", "median", "p90", "p95"]

    # Per-machine measured + predicted, MRE
    results = {}
    for mach in MACHINES:
        meas = measured(mach)
        results[mach] = {"measured": meas, "predicted": {}, "mre": {}}
        for exp in EXPS:
            pred = predicted(mach, exp)
            results[mach]["predicted"][exp] = pred
            results[mach]["mre"][exp] = {}
            for code in ("Zapyty", "Stvor", "Onovl"):  # skip RC for MRE
                m = meas.get(code, {})
                p = pred.get(code, {})
                results[mach]["mre"][exp][code] = {
                    s: mre(p.get(s), m.get(s)) for s in stat_keys
                }

    # Print per-machine aggregate (mean |MRE| across Zapyty/Stvor/Onovl)
    print("══════ Mean |MRE| per (machine, experiment, statistic) — Zapyty/Stvor/Onovl ══════\n")
    print(f"  {'machine':18s} {'stat':8s} | " + "  ".join(f"{e:>10s}" for e in EXPS))
    for mach in MACHINES:
        for stat in stat_keys:
            cells = []
            for exp in EXPS:
                vals = [abs(results[mach]["mre"][exp][cls][stat])
                        for cls in ("Zapyty", "Stvor", "Onovl")
                        if results[mach]["mre"][exp][cls][stat] is not None]
                if not vals: cells.append("       —")
                else: cells.append(f"{sum(vals)/len(vals):>9.2f}%")
            label = "PREDICTED" if "io2" in mach and mach.startswith("m7a") else "calib   "
            print(f"  {mach:18s} {stat:8s} | " + "  ".join(cells) + f"   ({label})")
        print()

    print("══════ Cross-machine aggregate (mean of per-machine means) ══════")
    print(f"  {'group':25s} {'stat':8s} | " + "  ".join(f"{e:>10s}" for e in EXPS))
    calib = [m for m in MACHINES if m != "m7a-io2-m_cqrs"]
    predicted_mach = "m7a-io2-m_cqrs"
    for stat in stat_keys:
        # Calibration machines aggregate
        cells_c = []
        for exp in EXPS:
            all_vals = []
            for mach in calib:
                for cls in ("Zapyty", "Stvor", "Onovl"):
                    e = results[mach]["mre"][exp][cls][stat]
                    if e is not None: all_vals.append(abs(e))
            cells_c.append(f"{sum(all_vals)/len(all_vals):>9.2f}%" if all_vals else "       —")
        # Predicted machine
        cells_p = []
        for exp in EXPS:
            vals = [abs(results[predicted_mach]["mre"][exp][cls][stat])
                    for cls in ("Zapyty", "Stvor", "Onovl")
                    if results[predicted_mach]["mre"][exp][cls][stat] is not None]
            cells_p.append(f"{sum(vals)/len(vals):>9.2f}%" if vals else "       —")
        print(f"  {'calib (3 machines)':25s} {stat:8s} | " + "  ".join(cells_c))
        print(f"  {'PREDICTED (m7a-io2)':25s} {stat:8s} | " + "  ".join(cells_p))
        print()

    (HERE / "experiment-mre-all.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print("Wrote experiment-mre-all.json")


if __name__ == "__main__":
    main()
