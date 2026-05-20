#!/usr/bin/env python3
"""Iterative calibration of m7i JMT models to match measured load metrics.

Idea
----
The JMT output RT(class) = Σ service_time(cell) + queueing. For a calibration
machine (m7i-*) we want the JMT output to reproduce the *measured load*
distribution. We:

  1. Initialise per-cell service-time center from seq MEDIAN (the proportion
     between stations is taken from seq), σ from load CV² (MOM) so the shape
     matches load.
  2. Build the jsimg, run JMT.
  3. Per class, compare predicted median to measured-load median; scale every
     cell used by that class by ratio^damping (the seq proportion between
     that class's stations is preserved).
  4. Repeat until predicted ≈ measured (within tol) or max_iter.

Calibrated per-(machine, cell) MEAN is written to m7i_calibration.json, keyed
by machine → method → fit_cell → {"mean_ms", "sigma"}. _build_jsimg.py exp11
reads this file directly for m7i; m7a stays Exp 6.

This makes m7i models match m7i reality. K = ratio of converged m7i-io2 /
m7i-gp3 centers (σ-independent).
"""

import csv
import json
import math
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGS = HERE / "logs10-noretry"
MODELS = HERE / "models"
JMT = "/Applications/Java Modelling Tools/JMT.jar"

FITS = json.loads((HERE / "experiment-fits.json").read_text())
FITS_LOAD = json.loads((HERE / "experiment-fits-load.json").read_text())

M7I = ["m7i-gp3-classical_cqrs", "m7i-io2-classical_cqrs"]

CYR = {
    "Zapyty": "Запити",
    "Stvor": "Команди створення",
    "Onovl": "Команди оновлення",
    "RC": "Процеси досягнення узгодженості",
}

# Cells grouped by the JMT class that drives them. Scaling a class multiplies
# every listed cell. RC is driven by its own JMT class (POST handler cells).
CLASS_CELLS = {
    "Zapyty": [
        ("GET", "AppService.Zapyty (query.execute − db.projection.read)"),
        ("GET", "ProjectionDB.Zapyty (db.projection.read)"),
    ],
    "Stvor": [
        ("POST", "AppService.Stvor (cmd+pub − ES − SN)"),
        ("POST", "EventStore.Stvor (db.eventstore.write)"),
        ("POST", "SnapshotDB.Stvor (db.snapshot.r+w)"),
    ],
    "Onovl": [
        ("PATCH", "AppService.Onovl (cmd+pub − ES − SN)"),
        ("PATCH", "EventStore.Onovl (db.eventstore.write)"),
        ("PATCH", "SnapshotDB.Onovl (db.snapshot.r+w)"),
    ],
    "RC": [
        ("POST", "AppService.RC.POST (event.handle − db.projection.write)"),
        ("POST", "ProjectionDB.RC.POST (db.projection.write)"),
    ],
}

DAMPING = 0.7
TOL = 0.04
MAX_ITER = 8


def measured_load(machine):
    """Per-class measured-load median (Zapyty/Stvor/Onovl from http.request,
    RC from event.handle handler path: max(event.handle end) − last command
    start ≈ handler RT proxy)."""
    rt = {"GET": [], "POST": [], "PATCH": []}
    eh = []  # event.handle durations as RC handler proxy
    with (LOGS / f"{machine}-load.log").open() as f:
        for ln in f:
            if not ln.strip():
                continue
            try:
                e = json.loads(ln)
            except Exception:
                continue
            sp = e.get("span")
            req = e.get("req") or {}
            m = req.get("method")
            d = e.get("durationMs")
            if sp == "http.request" and m in rt and d is not None:
                rt[m].append(d)
            elif sp == "event.handle" and d is not None:
                eh.append(d)

    def med(v):
        s = sorted(v)
        return s[len(s) // 2] if s else 0.0

    return {
        "Zapyty": med(rt["GET"]),
        "Stvor": med(rt["POST"]),
        "Onovl": med(rt["PATCH"]),
        "RC": med(eh),
    }


def read_pred_median(machine, exp):
    log_dir = MODELS / f"{machine}_{exp}_logs"
    out = {}
    for code, cyr in CYR.items():
        p = log_dir / f"Стоп_{cyr}_Response Time per Sink.csv"
        vals = []
        if p.exists():
            with p.open() as f:
                r = csv.reader(f)
                next(r, None)
                for row in r:
                    try:
                        v = float(row[1]) * 1000.0
                        if v >= 0:
                            vals.append(v)
                    except Exception:
                        pass
        vals.sort()
        out[code] = vals[len(vals) // 2] if vals else 0.0
    return out


# Variant: pass "v2" as argv[1] to use MLE σ for GET (Zapyty) cells instead
# of MOM σ — thins the GET tail (MOM σ ≈1.7 from CV²_load≈19 GC-outliers vs
# MLE σ ≈0.9). Writes m7i_calibration_v2.json, builds/reads exp13.
VARIANT = sys.argv[1] if len(sys.argv) > 1 else "v1"
# GET (Zapyty) σ from MLE-load (robust to GC-pause outliers that inflate
# CV²_load → MOM σ). Used by v2 and by ps (PS removes FCFS HOL-blocking, so
# the Zapyty p95 tail is σ-driven, not queue-driven — a fat MOM σ over-shoots).
ZAPYTY_SIGMA_MLE = (VARIANT in ("v2", "ps"))
# "ps" → calibrate m7i under the PS topology (build/run exp16, write a
#        separate m7i_calibration_ps.json so the FCFS exp11 file is untouched).
if VARIANT == "ps":
    CAL_FILE = "m7i_calibration_ps.json"
    EXP_NAME = "exp16"
elif VARIANT == "v2":
    CAL_FILE = "m7i_calibration_v2.json"
    EXP_NAME = "exp13"
else:
    CAL_FILE = "m7i_calibration.json"
    EXP_NAME = "exp11"


def init_params():
    """Per (machine, method, cell) → {mean_ms, sigma}: seq median + σ.

    σ = MOM √ln(1+CV²_load), except GET cells in v2 use MLE σ_load (robust to
    the GC-pause outliers that inflate CV²_load for Zapyty)."""
    params = {}
    for mach in M7I:
        params[mach] = {}
        for cls, cells in CLASS_CELLS.items():
            for method, cell in cells:
                s = FITS["perMachine"][mach][method][cell]
                l = FITS_LOAD["perMachine"][mach][method][cell]
                if ZAPYTY_SIGMA_MLE and method == "GET":
                    sigma = l["exp1"]["sigma"]
                else:
                    sigma = math.sqrt(math.log(1.0 + l["cv2"]))
                # Per-class tail tuning (mirrors _build_jsimg.sigma_class_factor):
                # thin GET tail, fatten Stvor/Onovl command tail. The iterative
                # loop re-converges centers under this σ so median stays on target.
                if "Zapyty" in cell and not (ZAPYTY_SIGMA_MLE and method == "GET"):
                    sigma *= 0.65   # MOM σ path: extra thinning of GET tail.
                    # (MLE-σ path is already thin → no extra multiplier.)
                elif "Stvor" in cell or "Onovl" in cell:
                    sigma *= 1.30
                params[mach].setdefault(method, {})[cell] = {
                    "mean_ms": s["median"] if s["median"] > 0 else s["mean"],
                    "sigma": sigma,
                }
    return params


def write_calibration(params):
    (HERE / CAL_FILE).write_text(json.dumps(params, indent=2, ensure_ascii=False))


def run_jmt(machine):
    subprocess.run(
        ["java", "-cp", JMT, "jmt.commandline.Jmt", "sim",
         str(MODELS / f"{machine}_{EXP_NAME}.jsimg")],
        check=True, capture_output=True,
    )


def main():
    params = init_params()
    write_calibration(params)
    meas = {m: measured_load(m) for m in M7I}

    for it in range(1, MAX_ITER + 1):
        # Build exp11 jsimg (reads m7i_calibration.json for m7i)
        subprocess.run(["python3", str(HERE / "_build_jsimg.py"), EXP_NAME],
                        check=True, capture_output=True)
        for m in M7I:
            run_jmt(m)

        worst = 0.0
        print(f"\n── iteration {it} ──")
        for m in M7I:
            pred = read_pred_median(m, EXP_NAME)
            for cls in ("Zapyty", "Stvor", "Onovl", "RC"):
                tgt = meas[m][cls]
                pv = pred[cls]
                if pv <= 0 or tgt <= 0:
                    continue
                ratio = tgt / pv
                worst = max(worst, abs(ratio - 1.0))
                # scale every cell of this class by ratio^DAMPING
                f = ratio ** DAMPING
                for method, cell in CLASS_CELLS[cls]:
                    params[m][method][cell]["mean_ms"] *= f
                print(f"  {m:18s} {cls:7s} meas={tgt:7.3f} pred={pv:7.3f} ratio={ratio:5.2f} ×{f:.3f}")
        write_calibration(params)
        if worst < TOL:
            print(f"\nConverged at iteration {it} (worst |ratio−1| = {worst:.3f})")
            break
    else:
        print(f"\nStopped at MAX_ITER (worst |ratio−1| = {worst:.3f})")

    # Report converged per-cell centers and K
    print("\n── Converged centers (ms) & K = m7i-io2 / m7i-gp3 ──")
    for cls, cells in CLASS_CELLS.items():
        for method, cell in cells:
            g = params["m7i-gp3-classical_cqrs"][method][cell]["mean_ms"]
            i = params["m7i-io2-classical_cqrs"][method][cell]["mean_ms"]
            print(f"  {cell:55s} gp3={g:7.3f}  io2={i:7.3f}  K={i/g:5.3f}")


if __name__ == "__main__":
    main()
