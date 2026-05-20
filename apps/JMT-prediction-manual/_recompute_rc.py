#!/usr/bin/env python3
"""Recompute predicted RC_lag for m7a-io2 by SUMMING command RT samples with RC
handler RT samples (pairwise), weighted by POST/PATCH arrival shares.

For one POST request: RC_lag ≈ POST_RT + RC_handler_RT (one event)
For one PATCH request: RC_lag ≈ PATCH_RT + RC_handler_RT (assuming ~1 handler)

We DO NOT model the small event-store dispatch delay (~ms) which exists in
reality between command commit and handler start — that's the "не критично"
component the user mentioned.

Outputs MRE tables for both `mean` and `p95`.
"""

import csv
import json
import math
from pathlib import Path
import random

random.seed(42)

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
LOGS = HERE / "logs10-noretry"

CLASSES = {
    "Zapyty": "Запити",
    "Stvor":  "Команди створення",
    "Onovl":  "Команди оновлення",
    "RC":     "Процеси досягнення узгодженості",
}
EXPS = ["exp1", "exp2", "exp3"]


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
    s = sorted(vals); n = len(s)
    if n == 0: return {}
    mean = sum(vals) / n
    median = s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
    pick = lambda p: s[min(n - 1, int(round(p * (n - 1))))]
    return {"n": n, "mean": mean, "median": median, "p90": pick(0.90), "p95": pick(0.95)}


def measured_m7a_io2():
    """Read measured load distribution per class + RC_lag from m7a-io2 load log."""
    path = LOGS / "m7a-io2-m_cqrs-load.log"
    per = {"Zapyty": [], "Stvor": [], "Onovl": []}
    req_start = {}; req_eh = {}
    with path.open() as f:
        for ln in f:
            if not ln.strip(): continue
            try: e = json.loads(ln)
            except Exception: continue
            sp = e.get("span");
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
    rc_lag = []
    for rid, eh_end in req_eh.items():
        st0 = req_start.get(rid)
        if st0 is None: continue
        rc_lag.append(eh_end - st0)
    return {
        "Zapyty": stats_of(per["Zapyty"]),
        "Stvor":  stats_of(per["Stvor"]),
        "Onovl":  stats_of(per["Onovl"]),
        "RC":     stats_of(rc_lag),  # measured = consistency_lag
    }


def predicted_per_class(exp):
    """JMT predicted RT samples for m7a-io2 (4 classes)."""
    log_dir = MODELS / f"m7a-io2-m_cqrs_{exp}_logs"
    out = {}
    for code, cyr in CLASSES.items():
        out[code] = read_csv_samples_ms(log_dir / f"Стоп_{cyr}_Response Time per Sink.csv")
    return out


def synth_rc_lag(post_samples, patch_samples, rc_samples, post_share=0.400, patch_share=0.600):
    """Construct synthetic RC_lag distribution by pairwise sum of command RT + RC RT.

    Sample N from POST: pair with N from RC → POST-side RC_lag
    Sample M from PATCH: pair with M from RC → PATCH-side RC_lag
    Combined: post_share * N + patch_share * M values
    """
    # Use min available count from RC
    n_rc = len(rc_samples)
    n_post = int(round(post_share * n_rc))
    n_patch = n_rc - n_post
    # Random pairing
    rc_shuf = list(rc_samples)
    random.shuffle(rc_shuf)
    post_shuf = random.sample(post_samples, min(n_post, len(post_samples)))
    patch_shuf = random.sample(patch_samples, min(n_patch, len(patch_samples)))
    out = []
    for i, p in enumerate(post_shuf):
        out.append(p + rc_shuf[i])
    for i, p in enumerate(patch_shuf):
        out.append(p + rc_shuf[i + n_post])
    return out


def mre(p, m):
    if p is None or m is None or m == 0: return None
    return (p - m) / m * 100.0


def fmt_ms(x, d=3): return f"{x:.{d}f}" if x is not None else "—"
def fmt_pct(x): return f"{x:+.1f}%" if x is not None else "—"


def main():
    meas = measured_m7a_io2()
    print("\n══════ Measured m7a-io2 LOAD ══════")
    for cls, s in meas.items():
        print(f"  {cls:8s}  mean={s['mean']:7.3f}  median={s['median']:7.3f}  p90={s['p90']:7.3f}  p95={s['p95']:7.3f}  (n={s['n']})")

    arrivals = {
        "POST": 99.207,
        "PATCH": 148.533,
    }
    total = arrivals["POST"] + arrivals["PATCH"]
    post_share = arrivals["POST"] / total
    patch_share = arrivals["PATCH"] / total
    print(f"\n  POST share = {post_share:.3f},  PATCH share = {patch_share:.3f}")

    results = {}
    for exp in EXPS:
        pred = predicted_per_class(exp)
        # Recompute RC: pairwise sum of command_RT + RC_handler_RT
        rc_synth = synth_rc_lag(pred["Stvor"], pred["Onovl"], pred["RC"],
                                 post_share=post_share, patch_share=patch_share)
        rc_stats = stats_of(rc_synth)
        results[exp] = {
            "Zapyty": stats_of(pred["Zapyty"]),
            "Stvor":  stats_of(pred["Stvor"]),
            "Onovl":  stats_of(pred["Onovl"]),
            "RC":     rc_stats,
            "RC_old": stats_of(pred["RC"]),  # original handler-only
        }
        print(f"\n══════ Predicted {exp} ══════")
        for cls in ("Zapyty", "Stvor", "Onovl", "RC", "RC_old"):
            s = results[exp][cls]
            print(f"  {cls:8s}  mean={s['mean']:7.3f}  median={s['median']:7.3f}  p90={s['p90']:7.3f}  p95={s['p95']:7.3f}")

    # ─── Render table per statistic ────────────────────────────────────────
    for stat in ("mean", "p95"):
        print(f"\n══════════════════ Table: {stat} ══════════════════\n")
        print(f"| # | Source | Zapyty | Stvor | Onovl | RC |")
        print(f"|---|---|---:|---:|---:|---:|")
        # Row 1: measured
        m = meas
        print(f"| 1 | **Measured m7a-io2** | **{fmt_ms(m['Zapyty'][stat])}** | **{fmt_ms(m['Stvor'][stat])}** | **{fmt_ms(m['Onovl'][stat])}** | **{fmt_ms(m['RC'][stat])}** |")
        i = 2
        for exp in EXPS:
            p = results[exp]
            print(f"| {i} | {exp.upper()} predicted | {fmt_ms(p['Zapyty'][stat])} | {fmt_ms(p['Stvor'][stat])} | {fmt_ms(p['Onovl'][stat])} | {fmt_ms(p['RC'][stat])} |")
            mre_cells = [fmt_pct(mre(p[c][stat], m[c][stat])) for c in ("Zapyty","Stvor","Onovl","RC")]
            print(f"| {i+1} | {exp.upper()} MRE | {mre_cells[0]} | {mre_cells[1]} | {mre_cells[2]} | {mre_cells[3]} |")
            i += 2


if __name__ == "__main__":
    main()
