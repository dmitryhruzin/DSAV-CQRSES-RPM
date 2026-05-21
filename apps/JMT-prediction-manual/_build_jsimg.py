#!/usr/bin/env python3
"""Build JMT .jsimg files for 4 experiments × 4 machines.

Inputs:
  experiment-fits.json       — seq-based per (machine, station, class) params
                                for Exp 1 (LN MLE), Exp 2 (Brunnert), Exp 3 (Hybrid).
  experiment-fits-load.json  — load-based LN MLE params for Exp 4.
  logs10-noretry/*-load.log  — for computing per-machine arrival rates.

Output:
  models/<machine>_<experiment>.jsimg

Usage:
  python _build_jsimg.py             # generates all 4 × 4 = 16 jsimg
  python _build_jsimg.py exp4        # generates only exp4 (4 jsimg)
"""

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGS = HERE / "logs10-noretry"
MODELS = HERE / "models"
MODELS.mkdir(exist_ok=True)

FITS = json.loads((HERE / "experiment-fits.json").read_text())
_FITS_LOAD_PATH = HERE / "experiment-fits-load.json"
FITS_LOAD = json.loads(_FITS_LOAD_PATH.read_text()) if _FITS_LOAD_PATH.exists() else None

MACHINES = ["m7i-gp3-m_cqrs", "m7i-io2-m_cqrs", "m7a-gp3-m_cqrs", "m7a-io2-m_cqrs"]
# exp1 LN MLE seq; exp2 Brunnert seq; exp3 Hybrid seq; exp4 LN MLE load;
# exp5 hybrid: μ from seq (mean is a disk property → K-prediction works),
#              σ from load (CV² is an instance-under-load property → fat tail).
# exp6: like exp5 but uses seq median instead of seq mean — robust to seq outliers.
# exp7: load median + σ_load_MLE + K_load_median — captures HT contention on m7i.
# exp8: like exp7 but DB stations have N=4 servers (model PostgreSQL MVCC parallelism).
# exp9: per-machine-family calibration.
#   m7i-* (calib): mean=seq_mean, σ=√ln(1+CV²_load), μ=ln(mean)−σ²/2  (MOM σ).
#   m7a-gp3 (calib base) & m7a-io2 (predicted): Exp 6 logic
#     (mean=seq_median, σ=σ_load_MLE).
#   K = seq-mean ratio of m7i pair (= Exp 1 K). m7a-io2 = m7a-gp3 × K.
# exp10: like exp9 but σ for m7i cells multiplied by SIGMA_M7I_FACTOR (iterative
#   tail-thickening to close the HT-contention gap on m7i POST/PATCH). K is
#   unaffected (K = seq-mean ratio, σ-independent). m7a-io2 untouched (its σ
#   comes from m7a-gp3 Exp-6 logic). μ kept mean-preserving:
#   μ = ln(seq_mean) − σ'²/2 where σ' = σ·F.
# exp11: m7i from iterative calibration (m7i_calibration.json: seq-median start,
#   scaled per-class until JMT output matches measured load). m7a-gp3 / m7a-io2
#   = Exp 6 (untouched); K = seq-median ratio of m7i pair (same as Exp 6).
# exp13: like exp12, but m7i uses m7i_calibration_v2.json (Zapyty σ = MLE-load
#   instead of MOM, thinner GET tail → lower m7i Zapyty p95). m7a = exp12.
# exp17: "v6 Pure MLE no-shift". Like exp16 (PS topology, m7i iteratively
#   calibrated) but the Lognormal center is placed at the pure MLE μ on load
#   (μ = mean(ln load)) instead of being shifted to median(seq). For m7i this
#   uses a parallel ps_mle calibration (m7i_calibration_ps_mle.json) whose
#   init pulls μ/σ from experiment-fits-load.json exp1 directly. For m7a-gp3
#   (base) and m7a-io2 (predicted) we read exp1 μ/σ from load fits — no shift.
#   K-prediction: μ_pred = μ_base + ln(K_median) where K_median = ratio of
#   load medians on the converged m7i pair (same as exp16).
# exp18: "Corrected lognormal — median-anchored, no σ²/2 subtraction". Like
#   exp16 (PS topology, m7a center = seq median, GET deflated by
#   ZAPYTY_CENTER_M7A_FACTOR, σ = σ_load_MLE) but μ is set so that the FITTED
#   median equals median_seq directly: μ = ln(median_seq) (no σ²/2 subtraction).
#   This addresses the concern that exp16 makes median(fitted) < median_seq
#   because subtracting σ²/2 was chosen to make E[X] = median_seq. m7i uses a
#   parallel ps_nosub calibration (m7i_calibration_ps_nosub.json) storing
#   {median_ms, sigma}; iterative loop scales median_ms.
ALL_EXPERIMENTS = ["exp1", "exp2", "exp3", "exp4", "exp5", "exp6", "exp7", "exp8", "exp9", "exp10", "exp11", "exp12", "exp13", "exp14", "exp15", "exp16", "exp17", "exp18"]
_M7I_CAL_PATH = HERE / "m7i_calibration.json"
M7I_CAL = json.loads(_M7I_CAL_PATH.read_text()) if _M7I_CAL_PATH.exists() else None
_M7I_CAL_V2_PATH = HERE / "m7i_calibration_v2.json"
M7I_CAL_V2 = json.loads(_M7I_CAL_V2_PATH.read_text()) if _M7I_CAL_V2_PATH.exists() else None
_M7I_CAL_PS_PATH = HERE / "m7i_calibration_ps.json"
M7I_CAL_PS = json.loads(_M7I_CAL_PS_PATH.read_text()) if _M7I_CAL_PS_PATH.exists() else None
_M7I_CAL_PS_MLE_PATH = HERE / "m7i_calibration_ps_mle.json"
M7I_CAL_PS_MLE = json.loads(_M7I_CAL_PS_MLE_PATH.read_text()) if _M7I_CAL_PS_MLE_PATH.exists() else None
_M7I_CAL_PS_NOSUB_PATH = HERE / "m7i_calibration_ps_nosub.json"
M7I_CAL_PS_NOSUB = json.loads(_M7I_CAL_PS_NOSUB_PATH.read_text()) if _M7I_CAL_PS_NOSUB_PATH.exists() else None

# Tunable: σ multiplier applied to m7i cells in exp10.
SIGMA_M7I_FACTOR = 2.0

# Tunable: center (median_seq) multiplier for m7a GET (Zapyty) cells in exp12.
# Deflating the center lowers predicted GET median directly (σ unchanged so the
# load-shaped tail is kept). μ recomputed from the scaled center so it stays
# mean-consistent; m7a-io2 follows m7a-gp3 through K-prediction.
ZAPYTY_CENTER_M7A_FACTOR = 0.87

# Hybrid (Exp 3) swap cells
HYBRID_SWAP = {
    "AppService.Onovl (cmd+pub − ES − SN)",
    "ProjectionDB.RC.POST (db.projection.write)",
}

# Station name → set of (method, fit-cell-name) for each class
# JMT station IDs (Cyrillic)
ST_START = "Старт"
ST_STOP = "Стоп"
ST_APP = "Сервер"
ST_ES = "Сховище подій"
ST_SN = "База даних знімків"
ST_PR = "База даних проєкцій"

# JMT class IDs (Cyrillic)
CLS_ZAPYTY = "Запити"
CLS_STVOR = "Команди створення"
CLS_ONOVL = "Команди оновлення"
CLS_RC = "Процеси досягнення узгодженості"
CLASSES = [CLS_ZAPYTY, CLS_STVOR, CLS_ONOVL, CLS_RC]

# Mapping from JMT class → (method-in-fits, fit-cell-name) per station
# value None means: class does not visit this station
STATION_CELLS = {
    ST_APP: {
        CLS_ZAPYTY: ("GET", "AppService.Zapyty (query.execute − db.projection.read)"),
        CLS_STVOR:  ("POST", "AppService.Stvor (cmd+pub − ES − SN)"),
        CLS_ONOVL:  ("PATCH", "AppService.Onovl (cmd+pub − ES − SN)"),
        CLS_RC:     ("POST", "AppService.RC.POST (event.handle − db.projection.write)"),
        # RC also has PATCH events; we use POST aggregate as primary
        # (mean and CV² differ slightly between POST/PATCH event handlers;
        # for simplicity treat RC as single class with POST stats)
    },
    ST_ES: {
        CLS_ZAPYTY: None,
        CLS_STVOR:  ("POST", "EventStore.Stvor (db.eventstore.write)"),
        CLS_ONOVL:  ("PATCH", "EventStore.Onovl (db.eventstore.write)"),
        CLS_RC:     None,
    },
    ST_SN: {
        CLS_ZAPYTY: None,
        CLS_STVOR:  ("POST", "SnapshotDB.Stvor (db.snapshot.r+w)"),
        CLS_ONOVL:  ("PATCH", "SnapshotDB.Onovl (db.snapshot.r+w)"),
        CLS_RC:     None,
    },
    ST_PR: {
        CLS_ZAPYTY: ("GET", "ProjectionDB.Zapyty (db.projection.read)"),
        CLS_STVOR:  None,
        CLS_ONOVL:  None,
        CLS_RC:     ("POST", "ProjectionDB.RC.POST (db.projection.write)"),
    },
}

# Class routing per station (where class goes from this station)
# Special: ST_START routes all classes to ST_APP.
ROUTING = {
    ST_APP: {
        CLS_ZAPYTY: ST_PR,
        CLS_STVOR:  ST_ES,
        CLS_ONOVL:  ST_ES,
        CLS_RC:     ST_PR,
    },
    ST_ES: {
        CLS_STVOR: ST_SN,
        CLS_ONOVL: ST_SN,
    },
    ST_SN: {
        CLS_STVOR: ST_STOP,
        CLS_ONOVL: ST_STOP,
    },
    ST_PR: {
        CLS_ZAPYTY: ST_STOP,
        CLS_RC:     ST_STOP,
    },
}

# Number of parallel servers per station (m7i.large / m7a.large = 2 vCPU → AppService 2)
SERVERS = {ST_APP: 2, ST_ES: 1, ST_SN: 1, ST_PR: 1}

# For exp8, model PostgreSQL MVCC parallelism: each DB station has N=4 servers
# (matches typical knex pool size lower bound; reflects ability to handle
# concurrent transactions in parallel).
SERVERS_EXP8 = {ST_APP: 2, ST_ES: 4, ST_SN: 4, ST_PR: 4}


def get_servers(experiment: str) -> dict:
    return SERVERS_EXP8 if experiment == "exp8" else SERVERS


# ─── Cyrillic XML-encoding ──────────────────────────────────────────────────
def ent(s: str) -> str:
    return "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in s)


# ─── Distribution emitters ──────────────────────────────────────────────────
def _serv_lognormal(mu: float, sigma: float) -> str:
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.Lognormal" name="Lognormal"/>'
        '<subParameter classPath="jmt.engine.random.LognormalPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="mu"><value>{mu}</value></subParameter>'
        f'<subParameter classPath="java.lang.Double" name="sigma"><value>{sigma}</value></subParameter>'
        "</subParameter></subParameter>"
    )


def _serv_exp(rate: float) -> str:
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.Exponential" name="Exponential"/>'
        '<subParameter classPath="jmt.engine.random.ExponentialPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="lambda"><value>{rate}</value></subParameter>'
        "</subParameter></subParameter>"
    )


def _serv_erlang(k: int, rate: float) -> str:
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.Erlang" name="Erlang"/>'
        '<subParameter classPath="jmt.engine.random.ErlangPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="alpha"><value>{rate}</value></subParameter>'
        f'<subParameter classPath="java.lang.Long" name="r"><value>{k}</value></subParameter>'
        "</subParameter></subParameter>"
    )


def _serv_disabled() -> str:
    return '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.DisabledServiceTimeStrategy" name="DisabledServiceTimeStrategy"/>'


def emit_service_strategy(family: str, params: dict) -> str:
    """Pick the right service strategy emitter for the given family/params.
    All durations in params are in SECONDS (JMT expects seconds)."""
    if family == "lognormal":
        return _serv_lognormal(params["mu_s"], params["sigma"])
    elif family == "exp":
        return _serv_exp(params["rate_s"])
    elif family == "erlang":
        return _serv_erlang(params["k"], params["rate_s"])
    else:
        raise ValueError(family)


# ─── Calibration → JMT params ───────────────────────────────────────────────
def get_calibrated_params(machine: str, fit_cell: str, method: str, experiment: str,
                          k_disk: float | None, base_machine: str = "m7a-gp3-m_cqrs") -> dict:
    """Compute (family, JMT params in SECONDS) for given (machine, cell, experiment).

    For the predicted machine (m7a-io2 in our setup), use K-prediction from
    base_machine (m7a-gp3). For calibration machines, use directly fitted params.

    Returns dict with 'family' and family-specific params (mu_s/sigma, rate_s, k).
    """
    is_predicted = (machine == "m7a-io2-m_cqrs")
    src_machine = base_machine if is_predicted else machine
    fits = FITS_LOAD if experiment == "exp4" else FITS
    cell = fits["perMachine"][src_machine][method][fit_cell]

    if experiment in ("exp1", "exp4"):
        family = "lognormal"
        mu_ms = cell["exp1"]["mu"]
        sigma = cell["exp1"]["sigma"]
    elif experiment == "exp5":
        # Hypothesis: arithmetic-mean of service time is a disk property (K
        # shifts it); LN-shape is an instance-under-load property (relatively
        # constant). Use seq's arithmetic mean and load's MLE σ to build the LN:
        #   σ = σ_load_MLE         (moderate; MOM σ from CV²_load explodes
        #                           because load tails are heavier than LN)
        #   μ = ln(mean_seq) − σ²/2  (preserves E[X] = mean_seq)
        # K-prediction: μ' = μ + ln(K_disk) → E[X]' = mean_seq × K_disk.
        family = "lognormal"
        cell_seq = FITS["perMachine"][src_machine][method][fit_cell]
        cell_load = FITS_LOAD["perMachine"][src_machine][method][fit_cell]
        mean_seq = cell_seq["mean"]
        sigma = cell_load["exp1"]["sigma"]
        mu_ms = math.log(mean_seq) - sigma * sigma / 2.0
    elif experiment in ("exp6", "exp15"):
        # Like exp5 but uses seq MEDIAN instead of seq MEAN. Even though seq
        # data is clean (mean ≈ median), median is the more robust center
        # statistic and may reduce GET over-prediction since seq still has
        # small right-skew from rare slow queries.
        family = "lognormal"
        cell_seq = FITS["perMachine"][src_machine][method][fit_cell]
        cell_load = FITS_LOAD["perMachine"][src_machine][method][fit_cell]
        median_seq = cell_seq["median"]
        sigma = cell_load["exp1"]["sigma"]
        mu_ms = math.log(median_seq) - sigma * sigma / 2.0
    elif experiment in ("exp7", "exp8"):
        # exp7: load median + σ_load_MLE + K_load_median.
        # exp8: same calibration but used together with multi-server DB topology
        #       (PostgreSQL parallelism via MVCC; pool size ≈ knex default).
        family = "lognormal"
        cell_load = FITS_LOAD["perMachine"][src_machine][method][fit_cell]
        median_load = cell_load["median"]
        sigma = cell_load["exp1"]["sigma"]
        mu_ms = math.log(median_load) - sigma * sigma / 2.0
    elif experiment in ("exp9", "exp10"):
        # Per-machine-family calibration:
        #   m7i-* (calibration): mean = seq_mean, σ = √ln(1+CV²_load) (MOM),
        #                        μ = ln(seq_mean) − σ²/2.
        #     exp10: σ multiplied by SIGMA_M7I_FACTOR (thicker tail), μ kept
        #            mean-preserving with the scaled σ.
        #   m7a-gp3 (base) & m7a-io2 (predicted): Exp 6 logic
        #                        (mean = seq_median, σ = σ_load_MLE) — never
        #                        touched by the m7i σ multiplier.
        # K = seq-mean ratio of m7i pair (σ-independent → unaffected by exp10).
        family = "lognormal"
        if src_machine.startswith("m7i"):
            cell_seq = FITS["perMachine"][src_machine][method][fit_cell]
            cell_load = FITS_LOAD["perMachine"][src_machine][method][fit_cell]
            mean_seq = cell_seq["mean"]
            cv2_load = cell_load["cv2"]
            sigma = math.sqrt(math.log(1.0 + cv2_load))
            if experiment == "exp10":
                sigma = sigma * SIGMA_M7I_FACTOR
            mu_ms = math.log(mean_seq) - sigma * sigma / 2.0
        else:
            cell_seq = FITS["perMachine"][src_machine][method][fit_cell]
            cell_load = FITS_LOAD["perMachine"][src_machine][method][fit_cell]
            median_seq = cell_seq["median"]
            sigma = cell_load["exp1"]["sigma"]
            mu_ms = math.log(median_seq) - sigma * sigma / 2.0
    elif experiment == "exp17":
        # "v6 Pure MLE no-shift": μ = mean(ln load) directly (pure MLE on load),
        # σ = σ_load_MLE. NO shift to median(seq). PS topology (same as exp16).
        # For m7i we still run an iterative calibration (ps_mle variant) whose
        # init seeds the per-cell μ/σ from FITS_LOAD.exp1 and then scales μ
        # (additively, by ln(ratio)) to match measured-load medians. The stored
        # JSON carries mean_ms = e^(μ + σ²/2) so the iterative scaling acts on
        # the mean, but ln(median) = μ is what JMT uses (recomputed from
        # mean_ms and σ via μ = ln(mean_ms) − σ²/2 — consistent with how exp16
        # reads m7i_calibration_ps.json).
        # For m7a-gp3 (base) and m7a-io2 (predicted) we pull μ, σ from
        # FITS_LOAD.exp1 with no shift; K-prediction uses K_median (load).
        family = "lognormal"
        if src_machine.startswith("m7i"):
            cal = M7I_CAL_PS_MLE
            if cal is None:
                # Fall back to FITS_LOAD.exp1 if calibration not yet run.
                cell_load = FITS_LOAD["perMachine"][src_machine][method][fit_cell]
                mu_ms = cell_load["exp1"]["mu"]
                sigma = cell_load["exp1"]["sigma"]
            else:
                c = cal[src_machine][method][fit_cell]
                mean_ms = c["mean_ms"]
                sigma = c["sigma"]
                mu_ms = math.log(mean_ms) - sigma * sigma / 2.0
        else:
            cell_load = FITS_LOAD["perMachine"][src_machine][method][fit_cell]
            mu_ms = cell_load["exp1"]["mu"]      # pure MLE μ — no shift
            sigma = cell_load["exp1"]["sigma"]   # MLE σ
    elif experiment == "exp18":
        # "Corrected lognormal, median-anchored": μ = ln(median_seq) directly,
        # NO σ²/2 subtraction. Makes median(fitted) = median_seq (vs. exp16
        # which makes E[X] = median_seq by subtracting σ²/2). σ = σ_load_MLE
        # (same as exp16). PS topology (same as exp16/exp17). For m7a GET, the
        # same ZAPYTY_CENTER_M7A_FACTOR=0.87 deflation is applied to median_seq
        # so the m7a-gp3 GET center stays comparable to exp16. m7i uses a
        # parallel ps_nosub calibration (m7i_calibration_ps_nosub.json) with
        # {median_ms, sigma}; μ = ln(median_ms).
        family = "lognormal"
        if src_machine.startswith("m7i"):
            cal = M7I_CAL_PS_NOSUB
            if cal is None:
                # Fall back: seq median + σ_load_MLE if calibration not run yet
                cell_seq = FITS["perMachine"][src_machine][method][fit_cell]
                cell_load = FITS_LOAD["perMachine"][src_machine][method][fit_cell]
                median_seq = cell_seq["median"]
                sigma = cell_load["exp1"]["sigma"]
                mu_ms = math.log(median_seq)
            else:
                c = cal[src_machine][method][fit_cell]
                median_ms = c["median_ms"]
                sigma = c["sigma"]
                mu_ms = math.log(median_ms)   # NO σ²/2 subtraction
        else:
            cell_seq = FITS["perMachine"][src_machine][method][fit_cell]
            cell_load = FITS_LOAD["perMachine"][src_machine][method][fit_cell]
            median_seq = cell_seq["median"]
            sigma = cell_load["exp1"]["sigma"]
            if method == "GET":
                median_seq = median_seq * ZAPYTY_CENTER_M7A_FACTOR
            mu_ms = math.log(median_seq)   # NO σ²/2 subtraction
    elif experiment in ("exp11", "exp12", "exp13", "exp14", "exp16"):
        # exp11: m7i iteratively-calibrated (m7i_calibration.json); m7a = Exp 6.
        # exp12: like exp11, but for m7a GET cells the center (median_seq) is
        #        deflated by ZAPYTY_CENTER_M7A_FACTOR — lowers predicted GET
        #        median directly (σ = σ_load_MLE kept, tail shape unchanged).
        # exp13: like exp12, but m7i reads m7i_calibration_v2.json (Zapyty σ =
        #        MLE-load instead of MOM → thinner GET tail, lower m7i Zapyty
        #        p95). m7a identical to exp12.
        family = "lognormal"
        if src_machine.startswith("m7i"):
            cal = (M7I_CAL_PS if experiment == "exp16" and M7I_CAL_PS else (M7I_CAL_V2 if experiment in ("exp13", "exp14") else M7I_CAL))
            c = cal[src_machine][method][fit_cell]
            mean_ms = c["mean_ms"]
            sigma = c["sigma"]
            mu_ms = math.log(mean_ms) - sigma * sigma / 2.0
        else:
            cell_seq = FITS["perMachine"][src_machine][method][fit_cell]
            cell_load = FITS_LOAD["perMachine"][src_machine][method][fit_cell]
            median_seq = cell_seq["median"]
            sigma = cell_load["exp1"]["sigma"]
            if experiment in ("exp12", "exp13", "exp14", "exp16") and method == "GET":
                median_seq = median_seq * ZAPYTY_CENTER_M7A_FACTOR
            mu_ms = math.log(median_seq) - sigma * sigma / 2.0
    elif experiment == "exp2":
        e2 = cell["exp2"]
        family = e2["family"]
        if family == "lognormal":
            mu_ms = e2["mu"]; sigma = e2["sigma"]
        elif family == "exp":
            rate_ms = e2["rate"]  # 1/ms
        elif family == "erlang":
            k = e2["k"]; rate_ms = e2["rate"]
    elif experiment == "exp3":
        if fit_cell in HYBRID_SWAP:
            # Use Exp 2 family (Erlang for both swap cells)
            e2 = cell["exp2"]
            family = e2["family"]
            if family == "erlang":
                k = e2["k"]; rate_ms = e2["rate"]
            elif family == "lognormal":
                mu_ms = e2["mu"]; sigma = e2["sigma"]
            elif family == "exp":
                rate_ms = e2["rate"]
        else:
            family = "lognormal"
            mu_ms = cell["exp1"]["mu"]
            sigma = cell["exp1"]["sigma"]
    else:
        raise ValueError(experiment)

    # Apply K-prediction if this is the predicted machine.
    # ms-mean of the base distribution is implicit in (mu_ms, sigma) or (k/rate).
    # K-prediction shifts mean by factor K_disk:
    #   For LN: mu_ms' = mu_ms + ln(K_disk), sigma unchanged.
    #   For Erlang: rate_ms' = rate_ms / K_disk, k unchanged.
    #   For Exp: rate_ms' = rate_ms / K_disk.
    if is_predicted and k_disk is not None:
        if family == "lognormal":
            mu_ms = mu_ms + math.log(k_disk)
        else:
            rate_ms = rate_ms / k_disk

    # Now convert ms params → seconds for JMT.
    if family == "lognormal":
        # mu in ms-space → mu in s-space shifts by -ln(1000); sigma unchanged.
        mu_s = mu_ms - math.log(1000.0)
        return {"family": "lognormal", "mu_s": mu_s, "sigma": sigma}
    elif family == "exp":
        # rate in 1/ms → 1/s by multiplying by 1000.
        rate_s = rate_ms * 1000.0
        return {"family": "exp", "rate_s": rate_s}
    elif family == "erlang":
        rate_s = rate_ms * 1000.0
        return {"family": "erlang", "k": k, "rate_s": rate_s}


# ─── Arrival rates from load logs ───────────────────────────────────────────
def compute_arrival_rates(machine: str) -> dict:
    """Return per-class arrival rate in events/second from the load log."""
    path = LOGS / f"{machine}-load.log"
    t0 = float("inf"); t1 = -float("inf")
    cnt = {"GET": 0, "POST": 0, "PATCH": 0}
    eh = 0
    with open(path) as f:
        for line in f:
            if not line.strip():
                continue
            try:
                e = json.loads(line)
            except Exception:
                continue
            sp = e.get("span")
            if sp == "http.request":
                m = (e.get("req") or {}).get("method")
                st = e.get("startedAt"); d = e.get("durationMs")
                if st is None or d is None:
                    continue
                if m in cnt:
                    cnt[m] += 1
                if st < t0: t0 = st
                if st + d > t1: t1 = st + d
            elif sp == "event.handle":
                eh += 1
    dur = (t1 - t0) / 1000.0 if t0 < float("inf") else 1.0
    return {
        CLS_ZAPYTY: cnt["GET"] / dur,
        CLS_STVOR:  cnt["POST"] / dur,
        CLS_ONOVL:  cnt["PATCH"] / dur,
        CLS_RC:     eh / dur,
    }


# ─── K_disk per cell ────────────────────────────────────────────────────────
def compute_k_disk(fits: dict | None = None, center: str = "mean"):
    """K_disk per fit_cell = center(m7i-io2) / center(m7i-gp3).

    For Exp 4 pass FITS_LOAD so K is computed on load means, matching the
    distribution source used for service times. For Exp 6 pass center='median'
    so K is computed on medians (consistent with median-based service times).
    """
    if fits is None:
        fits = FITS
    gp3 = fits["perMachine"]["m7i-gp3-m_cqrs"]
    io2 = fits["perMachine"]["m7i-io2-m_cqrs"]
    K = {}
    for method in ["GET", "POST", "PATCH"]:
        for cell, r in gp3[method].items():
            t = io2[method].get(cell)
            if t and r[center] > 0:
                K[(method, cell)] = t[center] / r[center]
    return K


# ─── XML builders ───────────────────────────────────────────────────────────
def user_classes_xml() -> str:
    return "".join(
        f'<userClass name="{ent(c)}" priority="0" referenceSource="{ent(ST_START)}" softDeadline="0.0" type="open"/>'
        for c in CLASSES
    )


def random_source_xml(arrivals: dict) -> str:
    parts = []
    for c in CLASSES:
        parts.append(f"<refClass>{ent(c)}</refClass>")
        rate = arrivals[c]
        if rate > 0:
            parts.append(_serv_exp(rate))  # interarrival = Exponential(rate)
        else:
            parts.append(_serv_disabled())
    return (
        '<section className="RandomSource">'
        '<parameter array="true" classPath="jmt.engine.NetStrategies.ServiceStrategy" name="ServiceStrategy">'
        + "".join(parts) + "</parameter></section>"
    )


def soft_deadlines_block() -> str:
    return (
        "<classSoftDeadlines>"
        + "".join("<softDeadline>0.0</softDeadline>" for _ in CLASSES)
        + "</classSoftDeadlines>"
        "<quantumSize><quantaSize>0.0</quantaSize></quantumSize>"
        "<quantumSwitchoverTime><quantumSwitchoverTime>0.0</quantumSwitchoverTime></quantumSwitchoverTime>"
    )


def queue_section() -> str:
    drops = []; puts = []
    for c in CLASSES:
        drops.append(f"<refClass>{ent(c)}</refClass>")
        drops.append('<subParameter classPath="java.lang.String" name="dropStrategy"><value>drop</value></subParameter>')
        puts.append(f"<refClass>{ent(c)}</refClass>")
        puts.append('<subParameter classPath="jmt.engine.NetStrategies.QueuePutStrategies.TailStrategy" name="TailStrategy"/>')
    return (
        '<section className="Queue">'
        '<parameter classPath="java.lang.Integer" name="size"><value>-1</value></parameter>'
        '<parameter array="true" classPath="java.lang.String" name="dropStrategies">'
        + "".join(drops) + "</parameter>"
        '<parameter classPath="jmt.engine.NetStrategies.QueueGetStrategies.FCFSstrategy" name="FCFSstrategy"/>'
        '<parameter array="true" classPath="jmt.engine.NetStrategies.QueuePutStrategy" name="QueuePutStrategy">'
        + "".join(puts) + "</parameter></section>"
    )


def server_section(station: str, station_params_by_class: dict, num_servers: int) -> str:
    """station_params_by_class[class] = dict (family + jmt params in seconds) OR None for disabled."""
    nv_parts = []; cp_parts = []; serv_parts = []; compat_parts = []
    for c in CLASSES:
        nv_parts.append(f"<refClass>{ent(c)}</refClass>")
        nv_parts.append('<subParameter classPath="java.lang.Integer" name="numberOfVisits"><value>1</value></subParameter>')
        cp_parts.append(f"<refClass>{ent(c)}</refClass>")
        cp_parts.append('<subParameter classPath="java.lang.Integer" name="serverParallelism"><value>1</value></subParameter>')
        serv_parts.append(f"<refClass>{ent(c)}</refClass>")
        p = station_params_by_class.get(c)
        serv_parts.append(emit_service_strategy(p["family"], p) if p else _serv_disabled())
        compat_parts.append('<subParameter classPath="java.lang.Boolean" name="compatibilities"><value>true</value></subParameter>')
    return (
        '<section className="Server">'
        f'<parameter classPath="java.lang.Integer" name="maxJobs"><value>{num_servers}</value></parameter>'
        '<parameter array="true" classPath="java.lang.Integer" name="numberOfVisits">'
        + "".join(nv_parts) + "</parameter>"
        '<parameter array="true" classPath="jmt.engine.NetStrategies.ServiceStrategy" name="ServiceStrategy">'
        + "".join(serv_parts) + "</parameter>"
        '<parameter array="true" classPath="java.lang.Integer" name="classParallelism">'
        + "".join(cp_parts) + "</parameter>"
        '<parameter array="true" classPath="java.lang.String" name="serverNames">'
        '<subParameter classPath="java.lang.String" name="serverTypesNames">'
        f'<value>{ent(station)} - Server Type 1</value></subParameter></parameter>'
        '<parameter array="true" classPath="java.lang.Integer" name="serversPerServerType">'
        f'<subParameter classPath="java.lang.Integer" name="serverTypesNumOfServers"><value>{num_servers}</value></subParameter></parameter>'
        '<parameter array="true" classPath="java.lang.Object" name="serverCompatibilities">'
        '<subParameter array="true" classPath="java.lang.Boolean" name="serverTypesCompatibilities">'
        + "".join(compat_parts) + "</subParameter></parameter>"
        '<parameter classPath="java.lang.String" name="schedulingPolicy"><value>ALIS (Assign Longest Idle Server)</value></parameter>'
        "</section>"
    )


def empirical_routing(destination: str) -> str:
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.RoutingStrategies.EmpiricalStrategy" name="Probabilities">'
        '<subParameter array="true" classPath="jmt.engine.random.EmpiricalEntry" name="EmpiricalEntryArray">'
        '<subParameter classPath="jmt.engine.random.EmpiricalEntry" name="EmpiricalEntry">'
        f'<subParameter classPath="java.lang.String" name="stationName"><value>{ent(destination)}</value></subParameter>'
        '<subParameter classPath="java.lang.Double" name="probability"><value>1.0</value></subParameter>'
        "</subParameter></subParameter></subParameter>"
    )


def disabled_routing() -> str:
    return '<subParameter classPath="jmt.engine.NetStrategies.RoutingStrategies.DisabledRoutingStrategy" name="Disabled"/>'


def router_section(station: str) -> str:
    parts = []
    routes = ROUTING.get(station, {})
    for c in CLASSES:
        parts.append(f"<refClass>{ent(c)}</refClass>")
        dest = routes.get(c)
        parts.append(empirical_routing(dest) if dest else disabled_routing())
    return (
        '<section className="Router">'
        '<parameter array="true" classPath="jmt.engine.NetStrategies.RoutingStrategy" name="RoutingStrategy">'
        + "".join(parts) + "</parameter></section>"
    )


def start_node(arrivals: dict) -> str:
    # Start router always sends to AppService (only 1 outgoing connection).
    rs = random_source_xml(arrivals)
    router_parts = []
    for c in CLASSES:
        router_parts.append(f"<refClass>{ent(c)}</refClass>")
        router_parts.append(empirical_routing(ST_APP))
    router = (
        '<section className="Router">'
        '<parameter array="true" classPath="jmt.engine.NetStrategies.RoutingStrategy" name="RoutingStrategy">'
        + "".join(router_parts) + "</parameter></section>"
    )
    return f'<node name="{ent(ST_START)}">' + rs + '<section className="ServiceTunnel"/>' + router + "</node>"


def stop_node() -> str:
    return f'<node name="{ent(ST_STOP)}"><section className="JobSink"/></node>'


def ps_server_section(station_params_by_class: dict, num_servers: int) -> str:
    """Processor-Sharing server (EPS). Models CPU time-sharing (Node.js event
    loop + OS preemptive scheduler) — short jobs aren't head-of-line blocked
    behind long ones, unlike FCFS Server. Schema mirrors JMT's
    open_1class_1stat_mg1ps.jsimg reference."""
    nv = []; serv = []; ps = []; w = []
    for c in CLASSES:
        nv.append(f"<refClass>{ent(c)}</refClass>")
        nv.append('<subParameter classPath="java.lang.Integer" name="numberOfVisits"><value>1</value></subParameter>')
        serv.append(f"<refClass>{ent(c)}</refClass>")
        p = station_params_by_class.get(c)
        serv.append(emit_service_strategy(p["family"], p) if p else _serv_disabled())
        ps.append(f"<refClass>{ent(c)}</refClass>")
        ps.append('<subParameter classPath="jmt.engine.NetStrategies.PSStrategies.EPSStrategy" name="EPSStrategy"/>')
        w.append(f"<refClass>{ent(c)}</refClass>")
        w.append('<subParameter classPath="java.lang.Double" name="serviceWeight"><value>1.0</value></subParameter>')
    return (
        '<section className="PSServer">'
        f'<parameter classPath="java.lang.Integer" name="maxJobs"><value>{num_servers}</value></parameter>'
        '<parameter array="true" classPath="java.lang.Integer" name="numberOfVisits">'
        + "".join(nv) + "</parameter>"
        '<parameter array="true" classPath="jmt.engine.NetStrategies.ServiceStrategy" name="ServiceStrategy">'
        + "".join(serv) + "</parameter>"
        '<parameter array="true" classPath="jmt.engine.NetStrategies.PSStrategy" name="PSStrategy">'
        + "".join(ps) + "</parameter>"
        '<parameter array="true" classPath="java.lang.Double" name="serviceWeights">'
        + "".join(w) + "</parameter>"
        "</section>"
    )


def service_node(station: str, station_params_by_class: dict, num_servers: int,
                  ps: bool = False) -> str:
    server = (ps_server_section(station_params_by_class, num_servers) if ps
              else server_section(station, station_params_by_class, num_servers))
    return (
        f'<node name="{ent(station)}">'
        + soft_deadlines_block()
        + queue_section()
        + server
        + router_section(station)
        + "</node>"
    )


def measures_block(verbose: bool) -> str:
    parts = []
    util_stations = [ST_APP, ST_ES, ST_SN, ST_PR]
    for s in util_stations:
        parts.append(
            f'<measure alpha="0.01" name="{ent(s)}_Utilization" nodeType="station" '
            f'precision="0.03" referenceNode="{ent(s)}" referenceUserClass="" '
            'type="Utilization" verbose="false"/>'
        )
    v = "true" if verbose else "false"
    for c in CLASSES:
        parts.append(
            f'<measure alpha="0.01" name="{ent(ST_STOP)}_{ent(c)}_Response Time per Sink" '
            f'nodeType="station" precision="0.03" referenceNode="{ent(ST_STOP)}" '
            f'referenceUserClass="{ent(c)}" type="Response Time per Sink" verbose="{v}"/>'
        )
    return "".join(parts)


def connections_block() -> str:
    edges = [
        (ST_START, ST_APP),
        (ST_APP, ST_ES),
        (ST_APP, ST_PR),
        (ST_ES, ST_SN),
        (ST_SN, ST_STOP),
        (ST_PR, ST_STOP),
    ]
    return "".join(f'<connection source="{ent(a)}" target="{ent(b)}"/>' for a, b in edges)


def jmodel_block() -> str:
    pos = {
        ST_START: (25.0, 94.0),
        ST_STOP:  (1100.0, 114.0),
        ST_APP:   (190.0, 91.0),
        ST_ES:    (361.0, 114.0),
        ST_SN:    (562.0, 114.0),
        ST_PR:    (710.0, 22.0),
    }
    colors = [
        (CLS_ZAPYTY, "#FFFF0000"),
        (CLS_STVOR,  "#FF00FF00"),
        (CLS_ONOVL,  "#FFFF00FF"),
        (CLS_RC,     "#FFFFC800"),
    ]
    parts = ['<jmodel xsi:noNamespaceSchemaLocation="JModelGUI.xsd">']
    for c, color in colors:
        parts.append(f'<userClass color="{color}" name="{ent(c)}"/>')
    for s, (x, y) in pos.items():
        parts.append(f'<station name="{ent(s)}"><position angle="0.0" rotate="false" x="{x}" y="{y}"/></station>')
    parts.append("</jmodel>")
    return "".join(parts)


def build_jsimg(machine: str, experiment: str, max_samples: int = 200_000, verbose: bool = True) -> Path:
    """Build a complete .jsimg file. Returns its path."""
    arrivals = compute_arrival_rates(machine)
    if experiment in ("exp4", "exp7", "exp8", "exp17"):
        k_fits = FITS_LOAD
    else:
        k_fits = FITS
    if experiment in ("exp6", "exp7", "exp8", "exp11", "exp12", "exp13", "exp14", "exp15", "exp16", "exp17", "exp18"):
        k_center = "median"
    else:
        k_center = "mean"
    K = compute_k_disk(k_fits, k_center)

    # Per-(station, class) params for THIS machine + experiment.
    station_params = {}
    for station, by_class in STATION_CELLS.items():
        station_params[station] = {}
        for cls, info in by_class.items():
            if info is None:
                station_params[station][cls] = None
                continue
            method, fit_cell = info
            k_disk = K.get((method, fit_cell))
            station_params[station][cls] = get_calibrated_params(
                machine, fit_cell, method, experiment, k_disk
            )

    name = f"{machine}_{experiment}.jsimg"
    log_dir = MODELS / f"{machine}_{experiment}_logs"
    log_dir.mkdir(exist_ok=True)

    sim_attrs = (
        'disableStatisticStop="true" '
        'logDecimalSeparator="." logDelimiter="," '
        f'logPath="{log_dir}" '
        'logReplaceMode="0" maxEvents="-1" '
        f'maxSamples="{max_samples}" '
        f'name="{name}" polling="1.0" '
        'xsi:noNamespaceSchemaLocation="SIMmodeldefinition.xsd"'
    )

    xml = (
        '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>'
        f'<archive xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" name="{name}" xsi:noNamespaceSchemaLocation="Archive.xsd">'
        f"<sim {sim_attrs}>"
        + user_classes_xml()
        + start_node(arrivals)
        + stop_node()
        + service_node(ST_APP, station_params[ST_APP], get_servers(experiment)[ST_APP], ps=(experiment in ("exp14", "exp15", "exp16", "exp17", "exp18")))
        + service_node(ST_ES, station_params[ST_ES], get_servers(experiment)[ST_ES])
        + service_node(ST_SN, station_params[ST_SN], get_servers(experiment)[ST_SN])
        + service_node(ST_PR, station_params[ST_PR], get_servers(experiment)[ST_PR])
        + measures_block(verbose=verbose)
        + connections_block()
        + "</sim>"
        + jmodel_block()
        + "</archive>"
    )

    out = MODELS / name
    out.write_text(xml, encoding="utf-8")
    return out


def main():
    experiments = sys.argv[1:] if len(sys.argv) > 1 else ALL_EXPERIMENTS
    unknown = [e for e in experiments if e not in ALL_EXPERIMENTS]
    if unknown:
        raise SystemExit(f"Unknown experiment(s): {unknown}. Choose from {ALL_EXPERIMENTS}")
    if any(e in experiments for e in ("exp4", "exp5", "exp6", "exp7", "exp8", "exp9", "exp10", "exp11", "exp12", "exp13", "exp14", "exp15", "exp16", "exp17", "exp18")) and FITS_LOAD is None:
        raise SystemExit("exp4-10 requested but experiment-fits-load.json not found")

    print(f"Generating experiments: {experiments}")
    for mach in MACHINES:
        arr = compute_arrival_rates(mach)
        print(f"\n{mach} arrival rates (events/s):")
        for c in CLASSES:
            print(f"  {c}: {arr[c]:.3f}")
    print()
    for mach in MACHINES:
        for exp in experiments:
            path = build_jsimg(mach, exp)
            print(f"Wrote {path.name}")


if __name__ == "__main__":
    main()
