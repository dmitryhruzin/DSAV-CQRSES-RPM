#!/usr/bin/env python3
"""Recompute predicted RC by adding command RT + RC handler RT (convolution).

Real consistency_lag = http.request.durationMs + event_bus_delay + event.handle.durationMs
                     ≈ command_RT + handler_RT (event_bus_delay ≈ 0 empirically)

We sample-convolve Stvor RT + RC RT for POST consistency, and Onovl RT + RC RT
for PATCH consistency. Combined consistency_lag is weighted union by measured
POST/PATCH count ratios.
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
    return {"n": n, "mean": mean, "median": median,
            "p90": pick(0.90), "p95": pick(0.95)}


def predicted_samples(exp):
    log_dir = MODELS / f"m7a-io2-m_cqrs_{exp}_logs"
    return {
        code: read_csv_samples_ms(log_dir / f"Стоп_{cyr}_Response Time per Sink.csv")
        for code, cyr in CLASSES_CYR.items()
    }


def predicted_consistency_lag(exp, n_post_measured: int, n_patch_measured: int):
    """Convolve command RT + RC handler RT, weighted by measured POST/PATCH ratio."""
    s = predicted_samples(exp)
    stvor = s["Stvor"][:]; onovl = s["Onovl"][:]; rc = s["RC"][:]
    if not stvor or not onovl or not rc:
        return {}
    rng = random.Random(42)
    # Generate POST consistency = Stvor + RC pairs
    rng.shuffle(stvor); rng.shuffle(rc)
    n_pairs = min(len(stvor), len(rc))
    post_lag = [stvor[i] + rc[i] for i in range(n_pairs)]
    # Generate PATCH consistency = Onovl + RC pairs (different RC permutation)
    rng.shuffle(onovl); rc2 = rc[:]; rng.shuffle(rc2)
    n_pairs = min(len(onovl), len(rc2))
    patch_lag = [onovl[i] + rc2[i] for i in range(n_pairs)]
    # Combine weighted by measured POST/PATCH counts
    total = n_post_measured + n_patch_measured
    p_post = n_post_measured / total
    p_patch = n_patch_measured / total
    N = 100_000
    rng.shuffle(post_lag); rng.shuffle(patch_lag)
    n_take_post = int(N * p_post)
    n_take_patch = N - n_take_post
    combined = post_lag[:n_take_post] + patch_lag[:n_take_patch]
    return stats_of(combined)


def measured_m7a_io2():
    """Return measured stats for Zapyty, Stvor, Onovl, RC_lag (with counts)."""
    path = LOGS / "m7a-io2-m_cqrs-load.log"
    per = defaultdict(list)
    req_start = {}; req_eh_end = {}
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
                elif m == "POST":  per["Stvor"].append(d); counts["POST"] += 1
                elif m == "PATCH": per["Onovl"].append(d); counts["PATCH"] += 1
                if rid: req_start[rid] = st
            elif sp == "event.handle":
                if rid and d is not None:
                    end = (st or 0) + d
                    if rid not in req_eh_end or end > req_eh_end[rid]: req_eh_end[rid] = end
    for rid, eh_end in req_eh_end.items():
        st0 = req_start.get(rid)
        if st0 is None: continue
        per["RC_lag"].append(eh_end - st0)
    return {cls: stats_of(per[cls]) for cls in ("Zapyty", "Stvor", "Onovl", "RC_lag")}, counts


def mre(p, m):
    if p is None or m is None or m == 0: return None
    return (p - m) / m * 100.0


def main():
    meas, counts = measured_m7a_io2()
    print("Measured m7a-io2 (after 10s skip):")
    for cls, s in meas.items():
        print(f"  {cls:10s} mean={s['mean']:.3f}  median={s['median']:.3f}  p90={s['p90']:.3f}  p95={s['p95']:.3f}  n={s['n']}")
    print(f"  POST count: {counts['POST']}, PATCH count: {counts['PATCH']}")

    results = {"measured": meas, "predicted": {}}
    for exp in ("exp1", "exp2", "exp3", "exp4", "exp5", "exp6", "exp7", "exp8", "exp9"):
        s = predicted_samples(exp)
        rc_lag = predicted_consistency_lag(exp, counts["POST"], counts["PATCH"])
        results["predicted"][exp] = {
            "Zapyty": stats_of(s["Zapyty"]),
            "Stvor":  stats_of(s["Stvor"]),
            "Onovl":  stats_of(s["Onovl"]),
            "RC_lag": rc_lag,
        }
        print(f"\n{exp} predicted (with RC = command + handler convolution):")
        for cls in ("Zapyty", "Stvor", "Onovl", "RC_lag"):
            st = results["predicted"][exp][cls]
            print(f"  {cls:10s} mean={st['mean']:.3f}  median={st['median']:.3f}  p90={st['p90']:.3f}  p95={st['p95']:.3f}")

    # MRE
    print("\n══════ MRE (%) ══════")
    for stat in ("mean", "p95"):
        print(f"\n--- {stat} ---")
        header = f"  {'class':10s} {'measured':>10s}  "
        for exp in ("exp1", "exp2", "exp3", "exp4", "exp5", "exp6", "exp7", "exp8", "exp9"):
            header += f"{exp + ' pred':>10s} {exp + ' MRE':>9s}  "
        print(header)
        for cls in ("Zapyty", "Stvor", "Onovl", "RC_lag"):
            m = meas[cls][stat]
            row = f"  {cls:10s} {m:>10.3f}  "
            for exp in ("exp1", "exp2", "exp3", "exp4", "exp5", "exp6", "exp7", "exp8", "exp9"):
                p = results["predicted"][exp][cls][stat]
                e = mre(p, m)
                row += f"{p:>10.3f} {e:>+8.2f}%  "
            print(row)

    (HERE / "experiment-mre-rc-conv.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False))
    print("\nWrote experiment-mre-rc-conv.json")


if __name__ == "__main__":
    main()
