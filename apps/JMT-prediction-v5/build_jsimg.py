#!/usr/bin/env python3
"""Build .jsimg files for all 8 models (v5).

V5 changes vs v4
----------------
1. RC arrival rate 250 → **275** j/s.
2. Adds ``<measure type="Throughput">`` per class and per station.
3. Supports per-(class, station) distribution choice from
   ``distribution_choice.json`` (heterogeneous).
4. Adds XML emission for additional JMT distributions: Erlang, Gamma, Weibull,
   Pareto, Coxian, plus Deterministic.
5. Phase-Type / Hypoexponential are NOT emitted as JMT XML; if any wins we
   fall back to the next-best candidate (in practice Lognormal).

The script accepts a ``--mode`` argument:
  - ``data_driven`` (default): use distribution_choice.json per (class, station)
  - ``exp`` / ``hyperexp`` / ``lognormal``: legacy homogeneous override
  - ``all``: emit all four modes (data_driven + 3 legacy)

Reads ``demands.json`` and ``distribution_choice.json``. For the predicted
M7a.io2 models, also reads ``K_io2.json``.
"""

import argparse
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

DISTRIBUTION = "data_driven"
DIST_CHOICE = None

CV2_CAP = 5.0


def ent(s: str) -> str:
    out = []
    for ch in s:
        if ord(ch) < 128:
            out.append(ch)
        else:
            out.append(f"&#{ord(ch)};")
    return "".join(out)


ST_START = "Старт"
ST_STOP = "Стоп"
ST_APP = "Сервер"
ST_ES = "Сховище подій"
ST_SN = "База даних знімків"
ST_PR = "База даних проєкцій"

CLS_GET = "Запити"
CLS_POST = "Команди створення"
CLS_PATCH = "Команди оновлення"
CLS_RC = "Процеси досягнення узгодженості"

LOGICAL = ["Zapyty", "Stvor", "Onovl", "RC"]
CLS_OF = {"Zapyty": CLS_GET, "Stvor": CLS_POST, "Onovl": CLS_PATCH, "RC": CLS_RC}
STATIONS = ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]


# -------------------- Distribution XML fragments --------------------

def _exp_strategy(mean_s: float) -> str:
    lam = 1.0 / mean_s
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.Exponential" name="Exponential"/>'
        '<subParameter classPath="jmt.engine.random.ExponentialPar" name="distrPar">'
        '<subParameter classPath="java.lang.Double" name="lambda">'
        f'<value>{lam}</value>'
        '</subParameter></subParameter></subParameter>'
    )


def _hyperexp_strategy(mean_s: float, cv2: float) -> str:
    if cv2 <= 1.0:
        lam = 1.0 / mean_s
        p, lam1, lam2 = 0.5, lam, lam
    else:
        ratio = (cv2 - 1.0) / (cv2 + 1.0)
        p = 0.5 * (1.0 - math.sqrt(ratio))
        lam1 = (2.0 * p) / mean_s
        lam2 = (2.0 * (1.0 - p)) / mean_s
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.HyperExp" name="Hyperexponential"/>'
        '<subParameter classPath="jmt.engine.random.HyperExpPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="p"><value>{p}</value></subParameter>'
        f'<subParameter classPath="java.lang.Double" name="lambda1"><value>{lam1}</value></subParameter>'
        f'<subParameter classPath="java.lang.Double" name="lambda2"><value>{lam2}</value></subParameter>'
        '</subParameter></subParameter>'
    )


def _lognormal_strategy(mean_s: float, var_s2: float) -> str:
    cv2 = var_s2 / (mean_s ** 2) if mean_s > 0 else 0.0
    sigma2 = math.log(1.0 + cv2) if cv2 > 0 else 1e-9
    sigma = math.sqrt(sigma2)
    mu = math.log(mean_s) - sigma2 / 2.0
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.Lognormal" name="Lognormal"/>'
        '<subParameter classPath="jmt.engine.random.LognormalPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="mu"><value>{mu}</value></subParameter>'
        f'<subParameter classPath="java.lang.Double" name="sigma"><value>{sigma}</value></subParameter>'
        '</subParameter></subParameter>'
    )


def _erlang_strategy(mean_s: float, var_s2: float) -> str:
    """Erlang(alpha=rate, r=shape integer). MoM."""
    cv2 = var_s2 / (mean_s ** 2) if mean_s > 0 else 1.0
    if cv2 <= 0:
        cv2 = 1.0
    r = max(1, int(round(1.0 / cv2)))
    alpha = r / mean_s
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.Erlang" name="Erlang"/>'
        '<subParameter classPath="jmt.engine.random.ErlangPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="alpha"><value>{alpha}</value></subParameter>'
        f'<subParameter classPath="java.lang.Long" name="r"><value>{r}</value></subParameter>'
        '</subParameter></subParameter>'
    )


def _gamma_strategy(mean_s: float, var_s2: float) -> str:
    """Gamma(alpha=shape, lambda=rate). MoM."""
    cv2 = var_s2 / (mean_s ** 2) if mean_s > 0 else 1.0
    if cv2 <= 0:
        cv2 = 1.0
    alpha = 1.0 / cv2
    lam = alpha / mean_s
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.GammaDistr" name="GammaDistr"/>'
        '<subParameter classPath="jmt.engine.random.GammaDistrPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="alpha"><value>{alpha}</value></subParameter>'
        f'<subParameter classPath="java.lang.Double" name="lambda"><value>{lam}</value></subParameter>'
        '</subParameter></subParameter>'
    )


def _weibull_strategy(mean_s: float, var_s2: float) -> str:
    """Weibull(alpha=scale, r=shape). MoM via numerical solve of shape from CV²."""
    from math import gamma
    cv2 = var_s2 / (mean_s ** 2) if mean_s > 0 else 1.0
    target = cv2
    lo, hi = 0.1, 50.0
    for _ in range(200):
        mid = (lo + hi) / 2.0
        g1 = gamma(1.0 + 1.0 / mid)
        g2 = gamma(1.0 + 2.0 / mid)
        c = g2 / (g1 * g1) - 1.0
        if c > target:
            lo = mid
        else:
            hi = mid
    r = (lo + hi) / 2.0
    g1 = gamma(1.0 + 1.0 / r)
    scale = mean_s / g1
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.Weibull" name="Weibull"/>'
        '<subParameter classPath="jmt.engine.random.WeibullPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="alpha"><value>{scale}</value></subParameter>'
        f'<subParameter classPath="java.lang.Double" name="r"><value>{r}</value></subParameter>'
        '</subParameter></subParameter>'
    )


def _pareto_strategy(mean_s: float, var_s2: float) -> str:
    """Pareto(alpha=shape, k=scale). MoM: α² − 2α − 1/CV² = 0 → α = 1 + √(1 + 1/CV²)."""
    cv2 = var_s2 / (mean_s ** 2) if mean_s > 0 else 1.0
    if cv2 <= 0:
        cv2 = 0.01
    alpha = 1.0 + math.sqrt(1.0 + 1.0 / cv2)
    if alpha <= 2.0:
        alpha = 2.001
    k = mean_s * (alpha - 1.0) / alpha
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.Pareto" name="Pareto"/>'
        '<subParameter classPath="jmt.engine.random.ParetoPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="alpha"><value>{alpha}</value></subParameter>'
        f'<subParameter classPath="java.lang.Double" name="k"><value>{k}</value></subParameter>'
        '</subParameter></subParameter>'
    )


def _coxian2_strategy(mean_s: float, var_s2: float) -> str:
    """Coxian-2 (lambda0, lambda1, phi0). Assume lambda0 = lambda1; phi0 chosen
    so CV² matches. Erlang-2 (phi0=0) gives CV²=0.5; Exp (phi0=1) gives CV²=1.
    """
    cv2 = var_s2 / (mean_s ** 2) if mean_s > 0 else 1.0
    cv2 = max(0.5, min(cv2, 5.0))

    def cv2_of_phi(phi0):
        lam = (2.0 - phi0) / mean_s
        ex2 = phi0 * 2.0 / (lam * lam) + (1.0 - phi0) * 6.0 / (lam * lam)
        var = ex2 - mean_s ** 2
        return var / (mean_s ** 2)

    lo, hi = 0.0, 1.0
    target = cv2
    for _ in range(100):
        mid = (lo + hi) / 2.0
        c = cv2_of_phi(mid)
        if c < target:
            lo = mid
        else:
            hi = mid
    phi0 = (lo + hi) / 2.0
    lam = (2.0 - phi0) / mean_s
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.CoxianDistr" name="Coxian"/>'
        '<subParameter classPath="jmt.engine.random.CoxianPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="lambda0"><value>{lam}</value></subParameter>'
        f'<subParameter classPath="java.lang.Double" name="lambda1"><value>{lam}</value></subParameter>'
        f'<subParameter classPath="java.lang.Double" name="phi0"><value>{phi0}</value></subParameter>'
        '</subParameter></subParameter>'
    )


def _det_strategy(mean_s: float) -> str:
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.ServiceTimeStrategy" name="ServiceTimeStrategy">'
        '<subParameter classPath="jmt.engine.random.DeterministicDistr" name="DeterministicDistr"/>'
        '<subParameter classPath="jmt.engine.random.DeterministicDistrPar" name="distrPar">'
        f'<subParameter classPath="java.lang.Double" name="t"><value>{mean_s}</value></subParameter>'
        '</subParameter></subParameter>'
    )


def _serv_strategy_for_choice(choice, mean_s, var_s2):
    if mean_s <= 0:
        return _serv_strategy_disabled()
    if choice == "Exponential":
        return _exp_strategy(mean_s)
    if choice == "Erlang-k":
        return _erlang_strategy(mean_s, var_s2)
    if choice == "Gamma":
        # Gamma in JMT's `jmt.engine.random.GammaDistr` exhibited simulation
        # instability with our parameter ranges (sim terminated after a few
        # samples). Document and fall back to the next-best continuous fit:
        # Erlang-k when shape is near-integer, else Lognormal.
        cv2 = var_s2 / (mean_s ** 2) if mean_s > 0 else 1.0
        alpha = 1.0 / cv2
        if abs(alpha - round(alpha)) < 0.05 and alpha >= 1.0:
            return _erlang_strategy(mean_s, var_s2)
        v = var_s2 if var_s2 > 0 else (mean_s ** 2) * 1e-6
        return _lognormal_strategy(mean_s, v)
    if choice == "Lognormal":
        v = var_s2 if var_s2 > 0 else (mean_s ** 2) * 1e-6
        return _lognormal_strategy(mean_s, v)
    if choice == "Weibull":
        v = var_s2 if var_s2 > 0 else (mean_s ** 2) * 1e-6
        return _weibull_strategy(mean_s, v)
    if choice == "Hyperexponential":
        cv2 = var_s2 / (mean_s ** 2) if mean_s > 0 else 0.0
        if cv2 <= 1.01:
            return _exp_strategy(mean_s)
        cv2 = min(cv2, CV2_CAP)
        return _hyperexp_strategy(mean_s, cv2)
    if choice == "Pareto":
        return _pareto_strategy(mean_s, var_s2)
    if choice == "Coxian-2":
        return _coxian2_strategy(mean_s, var_s2)
    if choice == "Deterministic":
        return _det_strategy(mean_s)
    # Fallback: Lognormal (Hypoexp / Phase-Type unsupported)
    v = var_s2 if var_s2 > 0 else (mean_s ** 2) * 1e-6
    return _lognormal_strategy(mean_s, v)


def _serv_strategy(mean_s: float, var_s2: float = 0.0,
                   mode: str = None, choice: str = None) -> str:
    mode = mode or DISTRIBUTION
    if mode == "data_driven" and choice is not None:
        return _serv_strategy_for_choice(choice, mean_s, var_s2)
    if mode == "hyperexp":
        cv2 = var_s2 / (mean_s ** 2) if mean_s > 0 else 0.0
        if cv2 <= 1.01:
            return _exp_strategy(mean_s)
        cv2 = min(cv2, CV2_CAP)
        return _hyperexp_strategy(mean_s, cv2)
    if mode == "lognormal":
        v = var_s2 if var_s2 > 0 else (mean_s ** 2) * 1e-6
        return _lognormal_strategy(mean_s, v)
    return _exp_strategy(mean_s)


def _serv_strategy_disabled() -> str:
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.ServiceStrategies.DisabledServiceTimeStrategy" name="DisabledServiceTimeStrategy"/>'
    )


def _empirical_routing(dests):
    inner = []
    for name, p in dests:
        inner.append(
            '<subParameter classPath="jmt.engine.random.EmpiricalEntry" name="EmpiricalEntry">'
            f'<subParameter classPath="java.lang.String" name="stationName"><value>{ent(name)}</value></subParameter>'
            f'<subParameter classPath="java.lang.Double" name="probability"><value>{p}</value></subParameter>'
            '</subParameter>'
        )
    return (
        '<subParameter classPath="jmt.engine.NetStrategies.RoutingStrategies.EmpiricalStrategy" name="Probabilities">'
        '<subParameter array="true" classPath="jmt.engine.random.EmpiricalEntry" name="EmpiricalEntryArray">'
        + "".join(inner)
        + "</subParameter></subParameter>"
    )


def _disabled_routing():
    return '<subParameter classPath="jmt.engine.NetStrategies.RoutingStrategies.DisabledRoutingStrategy" name="Disabled"/>'


def topology_for_class(logical_cls):
    if logical_cls == "Zapyty":
        return {
            ST_START: [(ST_APP, 1.0)],
            ST_APP: [(ST_PR, 1.0)],
            ST_PR: [(ST_STOP, 1.0)],
        }
    elif logical_cls in ("Stvor", "Onovl"):
        return {
            ST_START: [(ST_APP, 1.0)],
            ST_APP: [(ST_ES, 1.0)],
            ST_ES: [(ST_SN, 1.0)],
            ST_SN: [(ST_STOP, 1.0)],
        }
    elif logical_cls == "RC":
        return {
            ST_START: [(ST_APP, 1.0)],
            ST_APP: [(ST_PR, 1.0)],
            ST_PR: [(ST_STOP, 1.0)],
        }


def visits_for_class_at_station(logical_cls, station):
    if station in (ST_START, ST_STOP):
        return True
    if logical_cls == "Zapyty":
        return station in (ST_APP, ST_PR)
    if logical_cls == "RC":
        return station in (ST_APP, ST_PR)
    return station in (ST_APP, ST_ES, ST_SN)


STATION_LOGICAL = {
    ST_APP: "AppService",
    ST_ES: "EventStore",
    ST_SN: "SnapshotDB",
    ST_PR: "ProjectionDB",
}


def serv_block_for_station(station, demands_per_class_ms,
                           variances_per_class_ms2, choices=None):
    parts = []
    for lcls in LOGICAL:
        parts.append(f"<refClass>{ent(CLS_OF[lcls])}</refClass>")
        d_ms = demands_per_class_ms.get(lcls, 0.0)
        v_ms2 = variances_per_class_ms2.get(lcls, 0.0)
        if not visits_for_class_at_station(lcls, station) or d_ms <= 0:
            parts.append(_serv_strategy_disabled())
        else:
            d_s = d_ms / 1000.0
            v_s2 = v_ms2 / 1_000_000.0
            choice = (choices or {}).get(lcls)
            parts.append(_serv_strategy(d_s, v_s2, choice=choice))
    return "".join(parts)


def routing_block_for_station(station):
    parts = []
    for lcls in LOGICAL:
        parts.append(f"<refClass>{ent(CLS_OF[lcls])}</refClass>")
        topo = topology_for_class(lcls)
        if station in topo:
            parts.append(_empirical_routing(topo[station]))
        else:
            parts.append(_disabled_routing())
    return "".join(parts)


def random_source_section(arrival_rates_per_sec):
    parts = []
    for lcls in LOGICAL:
        parts.append(f"<refClass>{ent(CLS_OF[lcls])}</refClass>")
        r = arrival_rates_per_sec.get(lcls, 0.0)
        if r > 0:
            parts.append(_exp_strategy(1.0 / r))
        else:
            parts.append(_serv_strategy_disabled())
    return (
        '<section className="RandomSource">'
        '<parameter array="true" classPath="jmt.engine.NetStrategies.ServiceStrategy" name="ServiceStrategy">'
        + "".join(parts)
        + "</parameter></section>"
    )


def queue_section():
    drops = []
    puts = []
    for lcls in LOGICAL:
        drops.append(f"<refClass>{ent(CLS_OF[lcls])}</refClass>")
        drops.append('<subParameter classPath="java.lang.String" name="dropStrategy"><value>drop</value></subParameter>')
        puts.append(f"<refClass>{ent(CLS_OF[lcls])}</refClass>")
        puts.append('<subParameter classPath="jmt.engine.NetStrategies.QueuePutStrategies.TailStrategy" name="TailStrategy"/>')
    return (
        '<section className="Queue">'
        '<parameter classPath="java.lang.Integer" name="size"><value>-1</value></parameter>'
        '<parameter array="true" classPath="java.lang.String" name="dropStrategies">'
        + "".join(drops) + '</parameter>'
        '<parameter classPath="jmt.engine.NetStrategies.QueueGetStrategies.FCFSstrategy" name="FCFSstrategy"/>'
        '<parameter array="true" classPath="jmt.engine.NetStrategies.QueuePutStrategy" name="QueuePutStrategy">'
        + "".join(puts) + '</parameter>'
        '</section>'
    )


def server_section(station, demands_per_class_ms, variances_per_class_ms2,
                   num_servers=1, choices=None):
    nv_parts = []
    cp_parts = []
    compat_inner = []
    for lcls in LOGICAL:
        nv_parts.append(f"<refClass>{ent(CLS_OF[lcls])}</refClass>")
        nv_parts.append('<subParameter classPath="java.lang.Integer" name="numberOfVisits"><value>1</value></subParameter>')
        cp_parts.append(f"<refClass>{ent(CLS_OF[lcls])}</refClass>")
        cp_parts.append('<subParameter classPath="java.lang.Integer" name="serverParallelism"><value>1</value></subParameter>')
        compat_inner.append('<subParameter classPath="java.lang.Boolean" name="compatibilities"><value>true</value></subParameter>')

    srv_strat = serv_block_for_station(station, demands_per_class_ms,
                                       variances_per_class_ms2, choices=choices)
    return (
        '<section className="Server">'
        f'<parameter classPath="java.lang.Integer" name="maxJobs"><value>{num_servers}</value></parameter>'
        '<parameter array="true" classPath="java.lang.Integer" name="numberOfVisits">'
        + "".join(nv_parts) + '</parameter>'
        '<parameter array="true" classPath="jmt.engine.NetStrategies.ServiceStrategy" name="ServiceStrategy">'
        + srv_strat + '</parameter>'
        '<parameter array="true" classPath="java.lang.Integer" name="classParallelism">'
        + "".join(cp_parts) + '</parameter>'
        '<parameter array="true" classPath="java.lang.String" name="serverNames">'
        '<subParameter classPath="java.lang.String" name="serverTypesNames">'
        f'<value>{ent(station)} - Server Type 1</value></subParameter></parameter>'
        '<parameter array="true" classPath="java.lang.Integer" name="serversPerServerType">'
        f'<subParameter classPath="java.lang.Integer" name="serverTypesNumOfServers"><value>{num_servers}</value></subParameter></parameter>'
        '<parameter array="true" classPath="java.lang.Object" name="serverCompatibilities">'
        '<subParameter array="true" classPath="java.lang.Boolean" name="serverTypesCompatibilities">'
        + "".join(compat_inner) + '</subParameter></parameter>'
        '<parameter classPath="java.lang.String" name="schedulingPolicy"><value>ALIS (Assign Longest Idle Server)</value></parameter>'
        '</section>'
    )


def router_section(station):
    rb = routing_block_for_station(station)
    return (
        '<section className="Router">'
        '<parameter array="true" classPath="jmt.engine.NetStrategies.RoutingStrategy" name="RoutingStrategy">'
        + rb + '</parameter></section>'
    )


def class_soft_deadlines():
    return (
        '<classSoftDeadlines>'
        '<softDeadline>0.0</softDeadline>'
        '<softDeadline>0.0</softDeadline>'
        '<softDeadline>0.0</softDeadline>'
        '<softDeadline>0.0</softDeadline>'
        '</classSoftDeadlines>'
        '<quantumSize><quantaSize>0.0</quantaSize></quantumSize>'
        '<quantumSwitchoverTime><quantumSwitchoverTime>0.0</quantumSwitchoverTime></quantumSwitchoverTime>'
    )


def start_node(arrivals_per_sec):
    src = random_source_section(arrivals_per_sec)
    router = '<section className="Router">' \
             '<parameter array="true" classPath="jmt.engine.NetStrategies.RoutingStrategy" name="RoutingStrategy">' \
             + "".join(
                 f"<refClass>{ent(CLS_OF[c])}</refClass>" + _empirical_routing([(ST_APP, 1.0)])
                 for c in LOGICAL
             ) + '</parameter></section>'
    return (
        f'<node name="{ent(ST_START)}">' + src
        + '<section className="ServiceTunnel"/>'
        + router
        + '</node>'
    )


def stop_node():
    return f'<node name="{ent(ST_STOP)}"><section className="JobSink"/></node>'


def service_node(station, demands_per_class_ms, variances_per_class_ms2,
                 num_servers=1, choices=None):
    return (
        f'<node name="{ent(station)}">'
        + class_soft_deadlines()
        + queue_section()
        + server_section(station, demands_per_class_ms, variances_per_class_ms2,
                         num_servers=num_servers, choices=choices)
        + router_section(station)
        + '</node>'
    )


def measures(verbose_response_time=False):
    util_stations = [ST_APP, ST_ES, ST_SN, ST_PR]
    parts = []
    # Utilization per station (system-level, across all classes)
    for s in util_stations:
        parts.append(
            f'<measure alpha="0.01" name="{ent(s)}_Utilization" nodeType="station" '
            f'precision="0.03" referenceNode="{ent(s)}" referenceUserClass="" '
            f'type="Utilization" verbose="false"/>'
        )
    # V5: Throughput per station per class — only for (station, class) pairs
    # the class actually visits (otherwise analyzedSamples=0 trivially
    # satisfies precision and JMT stops early).
    station_logical_of = {ST_APP: "AppService", ST_ES: "EventStore",
                          ST_SN: "SnapshotDB", ST_PR: "ProjectionDB"}
    for s in util_stations:
        st_logical = station_logical_of[s]
        for lcls in LOGICAL:
            if not visits_for_class_at_station(lcls, s):
                continue
            cname = CLS_OF[lcls]
            parts.append(
                f'<measure alpha="0.01" name="{ent(s)}_{ent(cname)}_Throughput" '
                f'nodeType="station" precision="0.03" referenceNode="{ent(s)}" '
                f'referenceUserClass="{ent(cname)}" type="Throughput" '
                f'verbose="false"/>'
            )
    # System-level throughput per class (we sum per-class station throughputs
    # in analyze_results.py to get aggregate; for per-class system throughput,
    # use the bottleneck-station throughput per class which equals the per-class
    # arrival rate in stationary regime).
    vstr = "true" if verbose_response_time else "false"
    for lcls in LOGICAL:
        cname = CLS_OF[lcls]
        parts.append(
            f'<measure alpha="0.01" name="{ent(ST_STOP)}_{ent(cname)}_Response Time per Sink" '
            f'nodeType="station" precision="0.03" referenceNode="{ent(ST_STOP)}" '
            f'referenceUserClass="{ent(cname)}" type="Response Time per Sink" verbose="{vstr}"/>'
        )
    return "".join(parts)


def connections():
    edges = [
        (ST_START, ST_APP),
        (ST_APP, ST_ES),
        (ST_APP, ST_PR),
        (ST_ES, ST_SN),
        (ST_SN, ST_STOP),
        (ST_PR, ST_STOP),
    ]
    return "".join(
        f'<connection source="{ent(s)}" target="{ent(t)}"/>'
        for s, t in edges
    )


def user_classes_block():
    return "".join(
        f'<userClass name="{ent(CLS_OF[c])}" priority="0" referenceSource="{ent(ST_START)}" softDeadline="0.0" type="open"/>'
        for c in LOGICAL
    )


def jmodel_block():
    positions = {
        ST_START: (25.0, 94.0),
        ST_STOP: (1100.0, 114.0),
        ST_APP: (190.0, 91.0),
        ST_ES: (361.0, 114.0),
        ST_SN: (562.0, 114.0),
        ST_PR: (710.0, 22.0),
    }
    user_colors = [
        (CLS_GET, "#FFFF0000"),
        (CLS_POST, "#FF00FF00"),
        (CLS_PATCH, "#FFFF00FF"),
        (CLS_RC, "#FFFFC800"),
    ]
    parts = ['<jmodel xsi:noNamespaceSchemaLocation="JModelGUI.xsd">']
    for cname, color in user_colors:
        parts.append(f'<userClass color="{color}" name="{ent(cname)}"/>')
    for st, (x, y) in positions.items():
        parts.append(
            f'<station name="{ent(st)}"><position angle="0.0" rotate="false" x="{x}" y="{y}"/></station>'
        )
    parts.append("</jmodel>")
    return "".join(parts)


def build_model(name, demands, variances, arrivals, log_path, max_samples=200000,
                verbose_response_time=False, choices_per_station=None):
    def dems(stat_logical):
        return {c: demands[c].get(stat_logical, 0.0) for c in LOGICAL}

    def vars_(stat_logical):
        return {c: variances[c].get(stat_logical, 0.0) for c in LOGICAL}

    def choices_for(stat_logical):
        if not choices_per_station:
            return None
        return choices_per_station.get(stat_logical, {})

    sim_attrs = (
        'disableStatisticStop="true" '
        'logDecimalSeparator="." logDelimiter="," '
        f'logPath="{log_path}" '
        'logReplaceMode="0" maxEvents="-1" '
        f'maxSamples="{max_samples}" '
        f'name="{name}" polling="1.0" '
        'xsi:noNamespaceSchemaLocation="SIMmodeldefinition.xsd"'
    )

    parts = [
        '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>',
        f'<archive xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" name="{name}" xsi:noNamespaceSchemaLocation="Archive.xsd">',
        f'<sim {sim_attrs}>',
        user_classes_block(),
        start_node(arrivals),
        stop_node(),
        service_node(ST_APP, dems("AppService"), vars_("AppService"),
                     num_servers=2, choices=choices_for("AppService")),
        service_node(ST_ES, dems("EventStore"), vars_("EventStore"),
                     num_servers=1, choices=choices_for("EventStore")),
        service_node(ST_SN, dems("SnapshotDB"), vars_("SnapshotDB"),
                     num_servers=1, choices=choices_for("SnapshotDB")),
        service_node(ST_PR, dems("ProjectionDB"), vars_("ProjectionDB"),
                     num_servers=1, choices=choices_for("ProjectionDB")),
        measures(verbose_response_time=verbose_response_time),
        connections(),
        '</sim>',
        jmodel_block(),
        '</archive>',
    ]
    return "".join(parts)


CALIB_KEYS = [
    ("m7i-gp3", "m_cqrs"),
    ("m7i-gp3", "classical_cqrs"),
    ("m7i-io2", "m_cqrs"),
    ("m7i-io2", "classical_cqrs"),
    ("m7a-gp3", "m_cqrs"),
    ("m7a-gp3", "classical_cqrs"),
]


def reorg(d_in):
    out = {}
    for lcls in LOGICAL:
        out[lcls] = dict(d_in.get(lcls, {}))
    return out


def build_choices_per_station(machine_key, fallback="Lognormal"):
    if DIST_CHOICE is None:
        return None
    out = {}
    machine_data = DIST_CHOICE.get(machine_key, {})
    for stat in STATIONS:
        out[stat] = {}
        for lcls in LOGICAL:
            cell = machine_data.get(lcls, {}).get(stat)
            if cell and "best" in cell and cell.get("best"):
                out[stat][lcls] = cell["best"]
            else:
                out[stat][lcls] = fallback
    return out


def build_all(mode):
    global DISTRIBUTION, DIST_CHOICE
    DISTRIBUTION = mode

    models_dir = HERE / f"models_{mode}"
    logs_dir = HERE / "jmt_logs" / mode
    models_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    demands_data = json.loads((HERE / "demands.json").read_text())
    if mode == "data_driven":
        DIST_CHOICE = json.loads((HERE / "distribution_choice.json").read_text())
    else:
        DIST_CHOICE = None

    for mach, var in CALIB_KEYS:
        key = f"{mach}__{var}"
        d = demands_data[key]
        model_name = f"{mach}_{var}.jsimg"
        log_dir = logs_dir / f"{mach}_{var}"
        log_dir.mkdir(exist_ok=True)
        choices = build_choices_per_station(key) if mode == "data_driven" else None
        xml = build_model(
            name=model_name,
            demands=reorg(d["stations"]),
            variances=reorg(d.get("var_ms2", {})),
            arrivals=d["arrivals"],
            log_path=str(log_dir),
            max_samples=200000,
            verbose_response_time=False,
            choices_per_station=choices,
        )
        (models_dir / model_name).write_text(xml, encoding="utf-8")
        print(f"[{mode}] wrote {model_name}")

    if not (HERE / "K_io2.json").exists():
        print("K_io2.json missing — skipping predicted models.")
        return

    K = json.loads((HERE / "K_io2.json").read_text())
    # V5: RC arrival rate 250 → 275 j/s
    target_load = {
        "Zapyty": 100.0,
        "Stvor": 100.0,
        "Onovl": 150.0,
        "RC": 275.0,
    }
    for var in ["m_cqrs", "classical_cqrs"]:
        gp3_key = f"m7a-gp3__{var}"
        gp3 = demands_data[gp3_key]["stations"]
        gp3_var = demands_data[gp3_key].get("var_ms2", {})
        pred = {}
        pred_var = {}
        for lcls in LOGICAL:
            pred[lcls] = {}
            pred_var[lcls] = {}
            for stat in STATIONS:
                base = gp3[lcls][stat]
                base_var = gp3_var.get(lcls, {}).get(stat, 0.0)
                k = K[var][lcls][stat]
                pred[lcls][stat] = base * k
                pred_var[lcls][stat] = base_var * (k * k)
        choices = build_choices_per_station(gp3_key) if mode == "data_driven" else None
        model_name = f"m7a-io2_{var}_predicted.jsimg"
        log_dir = logs_dir / f"m7a-io2_{var}_predicted"
        log_dir.mkdir(exist_ok=True)
        xml = build_model(
            name=model_name,
            demands=pred,
            variances=pred_var,
            arrivals=target_load,
            log_path=str(log_dir),
            max_samples=300000,
            verbose_response_time=True,
            choices_per_station=choices,
        )
        (models_dir / model_name).write_text(xml, encoding="utf-8")
        (HERE / f"predicted_demands_{var}.json").write_text(
            json.dumps({"mean_ms": pred, "var_ms2": pred_var}, indent=2),
            encoding="utf-8",
        )
        print(f"[{mode}] wrote {model_name}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode",
                        choices=["data_driven", "exp", "hyperexp", "lognormal", "all"],
                        default="data_driven",
                        help="Distribution mode (default: data_driven).")
    args = parser.parse_args()
    if args.mode == "all":
        for m in ("data_driven", "exp", "hyperexp", "lognormal"):
            build_all(m)
    else:
        build_all(args.mode)


if __name__ == "__main__":
    main()
