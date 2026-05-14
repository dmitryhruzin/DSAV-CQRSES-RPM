#!/usr/bin/env python3
"""Build .jsimg files for all 8 models (6 calibrated + 2 predicted M7a.io2).

Supports three service-time distribution modes (selected per run via
the DISTRIBUTION constant at the top OR the command-line argument):

  - "exp"        : Exponential (calibrated by mean only).
  - "hyperexp"   : two-phase balanced HyperExp (calibrated by mean and CV²).
  - "lognormal"  : Lognormal (calibrated by mean and variance).

For each mode, models are emitted into ``models_<mode>/`` so the three
variants do not collide.

Reads ``demands.json`` (produced by ``extract_demands.py``) and, for the
predicted M7a.io2 models, ``K_io2.json`` (produced by ``compute_k.py``).
"""

import argparse
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

# Default — overridden by --mode or DISTRIBUTION env var.
DISTRIBUTION = "exp"

# Cap CV^2 for HyperExp/Lognormal calibration. Beyond CV^2 ~ 5 the
# two-phase HyperExp has a near-zero phase-2 weight with an extremely slow
# rate (single-server queueing then explodes), which is unrealistic — the
# measured tail is heavy but bounded. Keep the cap moderate.
CV2_CAP = 5.0

# -------------------- Cyrillic helpers --------------------

def ent(s: str) -> str:
    """Encode all non-ASCII characters as numeric refs (matches mCQRS.jsimg)."""
    out = []
    for ch in s:
        if ord(ch) < 128:
            out.append(ch)
        else:
            out.append(f"&#{ord(ch)};")
    return "".join(out)


# Stations
ST_START = "Старт"
ST_STOP = "Стоп"
ST_APP = "Сервер"
ST_ES = "Сховище подій"
ST_SN = "База даних знімків"
ST_PR = "База даних проєкцій"

# Classes
CLS_GET = "Запити"
CLS_POST = "Команди створення"
CLS_PATCH = "Команди оновлення"
CLS_RC = "Процеси досягнення узгодженості"

LOGICAL = ["Zapyty", "Stvor", "Onovl", "RC"]
CLS_OF = {"Zapyty": CLS_GET, "Stvor": CLS_POST, "Onovl": CLS_PATCH, "RC": CLS_RC}
STATIONS = ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]


# -------------------- Distribution XML fragments --------------------

def _exp_strategy(mean_s: float) -> str:
    """Exponential service time. lambda = 1 / mean_s."""
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
    """Two-phase balanced HyperExp calibrated to (mean, CV²).

    Balanced means formula (so phase means are equal: 1/(2p*λ1) = 1/(2(1-p)*λ2) = mean):
      p   = 0.5 * (1 - sqrt((CV² - 1) / (CV² + 1)))
      λ1  = 2p / mean
      λ2  = 2(1-p) / mean

    If CV² ≤ 1.01, the parameters degenerate (p -> 0 or 0.5 with equal λ).
    The caller is responsible for falling back to Exponential in that case.
    """
    if cv2 <= 1.0:
        # Defensive: same as Exponential — equal λ, p=0.5
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
    """Lognormal calibrated to (mean, var).
        σ² = ln(1 + var / mean²) = ln(1 + CV²)
        μ  = ln(mean) - σ² / 2
    """
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


def _serv_strategy(mean_s: float, var_s2: float = 0.0,
                   mode: str = None) -> str:
    """Dispatch to the configured distribution. mean_s, var_s2 in SECONDS."""
    mode = mode or DISTRIBUTION
    if mode == "hyperexp":
        cv2 = var_s2 / (mean_s ** 2) if mean_s > 0 else 0.0
        if cv2 <= 1.01:
            return _exp_strategy(mean_s)
        cv2 = min(cv2, CV2_CAP)
        return _hyperexp_strategy(mean_s, cv2)
    elif mode == "lognormal":
        # Lognormal accepts any CV² > 0; if variance ~ 0, use a tiny variance.
        if var_s2 <= 0:
            var_s2 = (mean_s ** 2) * 1e-6
        return _lognormal_strategy(mean_s, var_s2)
    else:
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


# -------------------- Topology --------------------

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
                           variances_per_class_ms2):
    """Return the inner ServiceStrategy XML for the Server section at this
    station. demands and variances are dicts: logical_class -> ms / ms^2.
    Disabled classes -> DisabledServiceTimeStrategy.
    """
    parts = []
    for lcls in LOGICAL:
        parts.append(f"<refClass>{ent(CLS_OF[lcls])}</refClass>")
        d_ms = demands_per_class_ms.get(lcls, 0.0)
        v_ms2 = variances_per_class_ms2.get(lcls, 0.0)
        if not visits_for_class_at_station(lcls, station) or d_ms <= 0:
            parts.append(_serv_strategy_disabled())
        else:
            d_s = d_ms / 1000.0
            v_s2 = v_ms2 / 1_000_000.0  # ms^2 -> s^2
            parts.append(_serv_strategy(d_s, v_s2))
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


# -------------------- Section builders --------------------

def random_source_section(arrival_rates_per_sec):
    """Source for the Start station. arrival_rates_per_sec: dict logical->rate.
    Always Exponential interarrival (independent of service-time distribution)."""
    parts = []
    for lcls in LOGICAL:
        parts.append(f"<refClass>{ent(CLS_OF[lcls])}</refClass>")
        r = arrival_rates_per_sec.get(lcls, 0.0)
        if r > 0:
            # arrival lambda already in 1/s — pass as if mean = 1/r so that
            # _exp_strategy emits lambda = r
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
                   num_servers=1):
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
                                       variances_per_class_ms2)
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
                 num_servers=1):
    return (
        f'<node name="{ent(station)}">'
        + class_soft_deadlines()
        + queue_section()
        + server_section(station, demands_per_class_ms, variances_per_class_ms2,
                         num_servers=num_servers)
        + router_section(station)
        + '</node>'
    )


def measures(verbose_response_time=False):
    util_stations = [ST_APP, ST_ES, ST_SN, ST_PR]
    parts = []
    for s in util_stations:
        parts.append(
            f'<measure alpha="0.01" name="{ent(s)}_Utilization" nodeType="station" precision="0.03" referenceNode="{ent(s)}" referenceUserClass="" type="Utilization" verbose="false"/>'
        )
    vstr = "true" if verbose_response_time else "false"
    for lcls in LOGICAL:
        cname = CLS_OF[lcls]
        parts.append(
            f'<measure alpha="0.01" name="{ent(ST_STOP)}_{ent(cname)}_Response Time per Sink" nodeType="station" precision="0.03" referenceNode="{ent(ST_STOP)}" referenceUserClass="{ent(cname)}" type="Response Time per Sink" verbose="{vstr}"/>'
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
                verbose_response_time=False):
    """Assemble full .jsimg.
    demands:   dict logical_class -> dict station_logical -> ms
    variances: dict logical_class -> dict station_logical -> ms^2
    arrivals:  dict logical -> rate per second
    """
    def dems(stat_logical):
        return {c: demands[c].get(stat_logical, 0.0) for c in LOGICAL}

    def vars_(stat_logical):
        return {c: variances[c].get(stat_logical, 0.0) for c in LOGICAL}

    # disableStatisticStop="true" means: ignore the precision stop criterion and
    # always collect maxSamples. We need this for the predicted runs because
    # JMT only flushes the verbose response-time CSVs when the full sample
    # budget is consumed; early termination on precision skips the flush.
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
        # AppService: 2-server station (2 vCPU m7i.large / m7a.large)
        service_node(ST_APP, dems("AppService"), vars_("AppService"), num_servers=2),
        service_node(ST_ES, dems("EventStore"), vars_("EventStore"), num_servers=1),
        service_node(ST_SN, dems("SnapshotDB"), vars_("SnapshotDB"), num_servers=1),
        service_node(ST_PR, dems("ProjectionDB"), vars_("ProjectionDB"), num_servers=1),
        measures(verbose_response_time=verbose_response_time),
        connections(),
        '</sim>',
        jmodel_block(),
        '</archive>',
    ]
    return "".join(parts)


# -------------------- Main: emit models for selected mode --------------------

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


def build_all(mode):
    """Emit all 8 models for a given distribution mode into models_<mode>/."""
    global DISTRIBUTION
    DISTRIBUTION = mode

    models_dir = HERE / f"models_{mode}"
    logs_dir = HERE / "jmt_logs" / mode
    models_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    demands_data = json.loads((HERE / "demands.json").read_text())

    # ----- Calibrated baselines -----
    for mach, var in CALIB_KEYS:
        key = f"{mach}__{var}"
        d = demands_data[key]
        model_name = f"{mach}_{var}.jsimg"
        log_dir = logs_dir / f"{mach}_{var}"
        log_dir.mkdir(exist_ok=True)
        xml = build_model(
            name=model_name,
            demands=reorg(d["stations"]),
            variances=reorg(d.get("var_ms2", {})),
            arrivals=d["arrivals"],
            log_path=str(log_dir),
            max_samples=200000,
            verbose_response_time=False,
        )
        (models_dir / model_name).write_text(xml, encoding="utf-8")
        print(f"[{mode}] wrote {model_name}")

    # ----- Predicted M7a.io2 -----
    if not (HERE / "K_io2.json").exists():
        print("K_io2.json missing — skipping predicted models. Run compute_k.py first.")
        return

    K = json.loads((HERE / "K_io2.json").read_text())
    target_load = {
        "Zapyty": 100.0,
        "Stvor": 100.0,
        "Onovl": 150.0,
        "RC": 250.0,
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
                # Keep CV² constant when scaling speed: var scales as k².
                pred_var[lcls][stat] = base_var * (k * k)
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
        )
        (models_dir / model_name).write_text(xml, encoding="utf-8")
        (HERE / f"predicted_demands_{var}.json").write_text(
            json.dumps({"mean_ms": pred, "var_ms2": pred_var}, indent=2),
            encoding="utf-8",
        )
        print(f"[{mode}] wrote {model_name}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["exp", "hyperexp", "lognormal", "all"],
                        default="all",
                        help="Distribution mode (default: all = emit all three).")
    args = parser.parse_args()
    if args.mode == "all":
        for m in ("exp", "hyperexp", "lognormal"):
            build_all(m)
    else:
        build_all(args.mode)


if __name__ == "__main__":
    main()
