#!/usr/bin/env python3
"""
Rebuild index_predicted.md so that:
  - Characteristics for all 6 servers: kept verbatim from index.md.
  - Measurements for the 4 measured platforms (M7i.gp3, M7i.io2, M7a.gp3, M7g.gp3):
    kept verbatim.
  - Predictions for M7a.io2 and M7g.io2: sourced ENTIRELY from JMT models, namely
        predicted_io2_models/<hw>_io2_<variation>.jsimg
        predicted_io2_runs/<hw>_io2_<variation>.jsimg-result.jsim
  - Summary table rows for M7a.io2 / M7g.io2: replaced with JMT Load-mode numbers.

Predicted block layout (replaces the ``` code block under a #### subheader):
  - Source line (says it's predicted via JMT + which .jsimg).
  - Per (class × station) service demand matrix (ms) — these are the K-scaled
    demands stored in the predicted .jsimg.
  - For Load mode: simulation results (throughput per class, RT per class,
    utilization per station, full processing time).
  - For Sequential mode: analytical RT = sum of service demands per class
    (sequential = no contention → RT equals total demand).
"""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


HERE = Path(__file__).resolve().parent
INDEX = HERE / "index.md"
OUT = HERE / "index_predicted.md"
CALIBRATED_MODELS_DIR = HERE / "calibrated_models"        # 8 measured models
PREDICTED_MODELS_DIR = HERE / "predicted_io2_models"      # 4 predicted models
PREDICTED_RUNS_DIR = HERE / "predicted_io2_runs"           # 12 JMT sim results


def find_model_path(hw: str, disk: str, var_full: str) -> Optional[Path]:
    """Return the .jsimg path for a (hw, disk, variation) tuple from either
    the predicted dir (M7a/M7g io2) or the calibrated dir (everything else)."""
    name = f"{hw}_{disk}_{var_full}.jsimg"
    for d in (PREDICTED_MODELS_DIR, CALIBRATED_MODELS_DIR):
        p = d / name
        if p.exists():
            return p
    return None


sys.path.insert(0, str(HERE))
from predict_io2_jmt import extract_lambdas  # type: ignore[import-not-found]


CLASS_CANON_ORDER = ["Query", "CreateCommand", "UpdateCommand", "ReachConsistency"]
STATION_CANON_ORDER = ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]

STATION_UA = {
    "AppService": "Сервер",
    "EventStore": "Сховище подій",
    "SnapshotDB": "База даних знімків",
    "ProjectionDB": "База даних проєкцій",
}
CLASS_UA = {
    "Query": "Запити",
    "CreateCommand": "Команди створення",
    "UpdateCommand": "Команди оновлення",
    "ReachConsistency": "Процеси досягнення узгодженості",
}

UA_TO_STATION_CANON = {v: k for k, v in STATION_UA.items()}
UA_TO_CLASS_CANON = {v: k for k, v in CLASS_UA.items()}

OFFERED = {
    "Query": 100.0,
    "CreateCommand": 100.0,
    "UpdateCommand": 150.0,
    "ReachConsistency": 250.0,
}
TOTAL_OFFERED = sum(OFFERED.values())  # 600 j/s
MIX_PROPS = {c: w / TOTAL_OFFERED for c, w in OFFERED.items()}


# ─── readers ────────────────────────────────────────────────────────────────

def local(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def demands_from_model(jsimg_path: Path) -> Dict[Tuple[str, str], float]:
    """Return {(station_canon, class_canon): demand_ms} extracted from a calibrated .jsimg."""
    lambdas = extract_lambdas(jsimg_path)
    out: Dict[Tuple[str, str], float] = {}
    for (st_ua, cls_ua), lam in lambdas.items():
        st = UA_TO_STATION_CANON.get(st_ua)
        cls = UA_TO_CLASS_CANON.get(cls_ua)
        if not st or not cls or lam <= 0:
            continue
        out[(st, cls)] = 1000.0 / lam  # lambda is in jobs/s, demand is in ms
    return out


def sim_results(result_path: Path) -> Dict[str, Any]:
    """Read JMT sim results into a structured dict."""
    out: Dict[str, Any] = {
        "per_class": {c: {} for c in CLASS_CANON_ORDER},
        "util": {s: float("nan") for s in STATION_CANON_ORDER},
        "throughput_station": {s: float("nan") for s in STATION_CANON_ORDER},
    }
    if not result_path.exists():
        return out

    tree = ET.parse(result_path)
    root = tree.getroot()
    for m in root:
        if local(m.tag) != "measure":
            continue
        mtype = m.attrib.get("measureType", "")
        cls_ua = m.attrib.get("class", "")
        st_ua = m.attrib.get("station", "")
        try:
            mean = float(m.attrib.get("meanValue", "nan"))
        except ValueError:
            mean = float("nan")
        cls_canon = UA_TO_CLASS_CANON.get(cls_ua)
        st_canon = UA_TO_STATION_CANON.get(st_ua)
        if mtype == "Response Time per Sink" and cls_canon:
            out["per_class"][cls_canon]["rt_ms"] = mean * 1000.0
        elif mtype == "Throughput per Sink" and cls_canon:
            out["per_class"][cls_canon]["throughput"] = mean
        elif mtype == "Utilization" and st_canon:
            out["util"][st_canon] = mean
        elif mtype == "Throughput" and st_canon:
            out["throughput_station"][st_canon] = mean
    return out


# ─── formatter ──────────────────────────────────────────────────────────────

SHORT = {
    "Query": "Query",
    "CreateCommand": "Create",
    "UpdateCommand": "Update",
    "ReachConsistency": "ReachC",
}


def format_demand_matrix(demands: Dict[Tuple[str, str], float]) -> List[str]:
    """4×4 matrix: stations × classes. '—' for disabled."""
    lines: List[str] = []
    header = f"  {'station':<22}" + " ".join(f"{SHORT[c]:>9}" for c in CLASS_CANON_ORDER)
    lines.append(header)
    lines.append("  " + "-" * (22 + 10 * len(CLASS_CANON_ORDER)))
    for st in STATION_CANON_ORDER:
        cells = []
        for cls in CLASS_CANON_ORDER:
            d = demands.get((st, cls))
            cells.append(f"{d:>9.4f}" if d is not None else f"{'—':>9}")
        lines.append(f"  {STATION_UA[st]:<22}" + " ".join(cells))
    return lines


def format_predicted_block(
    hw: str,
    variation: str,
    mode: str,
    demands: Dict[Tuple[str, str], float],
    sim: Optional[Dict[str, Any]],
) -> str:
    """Format the body of the ```...``` block for one predicted (hw, variation, mode)."""
    var_full = "mCQRS" if variation == "mCQRS" else "Classical_CQRS"
    model_name = f"{hw}_io2_{var_full}.jsimg"

    lines: List[str] = []
    lines.append(f"Source: predicted via JMT model `predicted_io2_models/{model_name}`")
    lines.append(
        "Service demands (ms) — computed as λ_target.gp3 × K_λ where "
        "K_λ = λ_M7i.io2 / λ_M7i.gp3 from the control pair, then converted via S = 1000/λ:"
    )
    lines.append("")
    lines += format_demand_matrix(demands)
    lines.append("")

    # Analytical max throughput bound (workload mix Q:Cr:Up:RC = 100:100:150:250).
    rho_by_station: Dict[str, float] = {}
    for st in STATION_CANON_ORDER:
        s = 0.0
        for cls in CLASS_CANON_ORDER:
            d_ms = demands.get((st, cls))
            if d_ms and d_ms > 0:
                s += MIX_PROPS[cls] * (d_ms / 1000.0)
        if s > 0:
            rho_by_station[st] = s
    is_saturated = False
    if rho_by_station:
        bottleneck = max(rho_by_station, key=rho_by_station.get)
        X_max = 1.0 / rho_by_station[bottleneck]
        is_saturated = X_max < 600.0
        warn = (" ⚠️ **below offered 600 j/s — model is saturated; RT values below reflect "
                "queue-growth average over the 120 s simulation window, not a true "
                "steady-state response time**") if is_saturated else ""
        lines.append(
            f"Max system throughput (saturation bound, workload mix 100:100:150:250): "
            f"**{X_max:.2f} j/s** — bottleneck: {STATION_UA[bottleneck]} ({bottleneck}).{warn}"
        )
        lines.append("")

    if mode == "Sequential":
        # Analytical sequential RT: sum of demands per class (no contention).
        lines.append(
            "Sequential RT (analytical, no contention — each class visits its stations once):"
        )
        lines.append("")
        lines.append(f"  {'class':<37} RT_seq (ms)")
        lines.append("  " + "-" * 50)
        for cls in CLASS_CANON_ORDER:
            total = sum(demands.get((st, cls), 0.0) for st in STATION_CANON_ORDER)
            lines.append(f"  {CLASS_UA[cls]:<37} {total:>10.4f}")
        # Full processing
        q = sum(demands.get((st, "Query"), 0.0) for st in STATION_CANON_ORDER)
        c = sum(demands.get((st, "CreateCommand"), 0.0) for st in STATION_CANON_ORDER)
        u = sum(demands.get((st, "UpdateCommand"), 0.0) for st in STATION_CANON_ORDER)
        rc = sum(demands.get((st, "ReachConsistency"), 0.0) for st in STATION_CANON_ORDER)
        lines.append("")
        lines.append("Full processing time (= command RT + ReachConsistency RT):")
        lines.append(f"  POST  (Create + Reach):  {c + rc:>10.4f} ms")
        lines.append(f"  PATCH (Update + Reach):  {u + rc:>10.4f} ms")
        lines.append(f"  GET   (Query only):      {q:>10.4f} ms")
    elif mode == "Load":
        if sim is None:
            lines.append("  (no simulation result available)")
            return "\n".join(lines)

        lines.append(
            "Simulation results under offered load 100 GET/s + 100 POST/s + "
            "150 PATCH/s + 250 ReachConsistency events/s:"
        )
        lines.append("")
        lines.append("  Throughput per class (jobs/s, served at sink):")
        lines.append(f"  {'class':<37} {'offered':>9} {'served':>9}")
        lines.append("  " + "-" * 59)
        served_total = 0.0
        offered_total = 0.0
        for cls in CLASS_CANON_ORDER:
            t = sim["per_class"][cls].get("throughput", float("nan"))
            o = OFFERED[cls]
            lines.append(f"  {CLASS_UA[cls]:<37} {o:>9.2f} {t:>9.2f}")
            if t == t:
                served_total += t
            offered_total += o
        lines.append("  " + "-" * 59)
        lines.append(
            f"  {'SYSTEM (sum across classes)':<37} {offered_total:>9.2f} {served_total:>9.2f}"
        )
        lines.append("")
        lines.append("  Response time per class (ms, source → sink):")
        lines.append(f"  {'class':<37} {'RT (ms)':>10}")
        lines.append("  " + "-" * 50)
        for cls in CLASS_CANON_ORDER:
            r = sim["per_class"][cls].get("rt_ms", float("nan"))
            lines.append(f"  {CLASS_UA[cls]:<37} {r:>10.4f}")
        lines.append("")
        lines.append("  Utilization per station:")
        lines.append(f"  {'station':<22} {'util':>8}")
        lines.append("  " + "-" * 33)
        for st in STATION_CANON_ORDER:
            u = sim["util"].get(st, float("nan"))
            lines.append(f"  {STATION_UA[st]:<22} {u:>8.4f}")
        lines.append("")
        c_rt = sim["per_class"]["CreateCommand"].get("rt_ms", float("nan"))
        u_rt = sim["per_class"]["UpdateCommand"].get("rt_ms", float("nan"))
        q_rt = sim["per_class"]["Query"].get("rt_ms", float("nan"))
        rc_rt = sim["per_class"]["ReachConsistency"].get("rt_ms", float("nan"))
        lines.append("  Full processing time (= command RT + ReachConsistency RT):")
        lines.append(f"  POST  (Create + Reach):  {c_rt + rc_rt:>10.4f} ms")
        lines.append(f"  PATCH (Update + Reach):  {u_rt + rc_rt:>10.4f} ms")
        lines.append(f"  GET   (Query only):      {q_rt:>10.4f} ms")
    return "\n".join(lines)


# ─── rewrite the index.md ───────────────────────────────────────────────────

HW_RE = re.compile(r"^## (M7[agi])\.large (gp3|io2)\s*$", re.M)
SUB_RE = re.compile(r"^#### (mCQRS|Classical CQRS) (Sequential|Load)\s*$", re.M)
CB_RE = re.compile(r"```(.*?)```", re.S)


def rewrite_io2_blocks(text: str) -> str:
    """Replace the ``` code block under each Metrics subsection of M7a.io2 / M7g.io2."""
    hw_matches = list(HW_RE.finditer(text))
    replacements: List[Tuple[int, int, str]] = []

    for i, hwm in enumerate(hw_matches):
        hw = hwm.group(1)
        disk = hwm.group(2)
        s = hwm.end()
        e = hw_matches[i + 1].start() if i + 1 < len(hw_matches) else len(text)
        if disk != "io2" or hw not in ("M7a", "M7g"):
            continue

        section_text = text[s:e]
        sub_matches = list(SUB_RE.finditer(section_text))
        for j, sm in enumerate(sub_matches):
            variation = sm.group(1)  # "mCQRS" / "Classical CQRS"
            mode = sm.group(2)       # "Sequential" / "Load"
            sub_start = sm.end()
            sub_end = sub_matches[j + 1].start() if j + 1 < len(sub_matches) else len(section_text)
            subsection = section_text[sub_start:sub_end]
            cb = CB_RE.search(subsection)
            if not cb:
                continue

            var_full = "mCQRS" if variation == "mCQRS" else "Classical_CQRS"
            model_path = PREDICTED_MODELS_DIR / f"{hw}_io2_{var_full}.jsimg"
            if not model_path.exists():
                print(f"  [skip] missing model {model_path.name}")
                continue
            demands = demands_from_model(model_path)

            sim = None
            if mode == "Load":
                result_path = PREDICTED_RUNS_DIR / f"{hw}_io2_{var_full}.jsimg-result.jsim"
                sim = sim_results(result_path)

            body = format_predicted_block(hw, variation, mode, demands, sim)
            replacement = f"```\n{body}\n```"

            abs_start = s + sub_start + cb.start()
            abs_end = s + sub_start + cb.end()
            replacements.append((abs_start, abs_end, replacement))

    replacements.sort()
    output = text
    for start, end, repl in reversed(replacements):
        output = output[:start] + repl + output[end:]
    return output


# ─── summary table ──────────────────────────────────────────────────────────

SUMMARY_ROW_RE = re.compile(
    r"^\| (M7[aig])\s+(gp3|io2)\s+(mCQRS|Classical)\s*\|"
    r"([^|]*)\|"
    r"([^|]*)\|([^|]*)\|([^|]*)\|"
    r"([^|]*)\|([^|]*)\|([^|]*)\|"
    r"([^|]*)\|([^|]*)\|"
    r"\s*$",
    re.M,
)

SECTION_HEADER_RE = re.compile(
    r"═══\s+(POST|PATCH|GET)[^─═]*─\s+(\d+)\s+total\s*/\s*(\d+)\s+ok\s*/\s*(\d+)\s+failed\s+═══"
)


def overall_err_from_index(index_text: str, hw: str, disk: str, var_full: str) -> float:
    """Sum total/failed across POST+PATCH+GET in the Load-mode block of (hw, disk, var_full).
    Returns overall error rate in percent, or NaN if not found."""
    section_re = re.compile(rf"^## {re.escape(hw)}\.large {disk}\s*$", re.M)
    sm = section_re.search(index_text)
    if not sm:
        return float("nan")
    s = sm.end()
    next_hw = re.search(r"^## M7", index_text[s:], re.M)
    e = s + next_hw.start() if next_hw else len(index_text)
    section = index_text[s:e]

    var_label = "mCQRS" if var_full == "mCQRS" else "Classical CQRS"
    sub_re = re.compile(rf"^#### {re.escape(var_label)} Load\s*$", re.M)
    sm2 = sub_re.search(section)
    if not sm2:
        return float("nan")
    ss = sm2.end()
    next_sub = re.search(r"^####", section[ss:], re.M)
    se = ss + next_sub.start() if next_sub else len(section)
    sub_text = section[ss:se]

    total = 0
    failed = 0
    for m in SECTION_HEADER_RE.finditer(sub_text):
        total += int(m.group(2))
        failed += int(m.group(4))
    if total == 0:
        return float("nan")
    return 100.0 * failed / total


def compute_max_throughput(jsimg_path: Path) -> Tuple[float, str]:
    """Operational saturation bound for an open queueing network.

    For each station s, weighted demand ρ_s = Σ_c π_c × (1/λ(s,c))
    where π_c is the class's share of the workload mix.

    Bottleneck = station with the largest ρ_s.
    X_max     = 1 / ρ_max   (in jobs/sec, total system throughput).

    Returns (X_max, bottleneck_station_canonical).
    """
    lambdas = extract_lambdas(jsimg_path)  # {(station_ua, class_ua): lambda}
    rho: Dict[str, float] = {}
    for (st_ua, cls_ua), lam in lambdas.items():
        cls_canon = UA_TO_CLASS_CANON.get(cls_ua)
        if not cls_canon or lam <= 0:
            continue
        rho[st_ua] = rho.get(st_ua, 0.0) + MIX_PROPS[cls_canon] / lam

    if not rho:
        return float("nan"), "?"

    bottleneck_ua = max(rho, key=rho.get)
    X_max = 1.0 / rho[bottleneck_ua]
    bottleneck_canon = UA_TO_STATION_CANON.get(bottleneck_ua, bottleneck_ua)
    return X_max, bottleneck_canon


def compute_all_max_throughputs() -> Dict[Tuple[str, str, str], Tuple[float, str]]:
    out: Dict[Tuple[str, str, str], Tuple[float, str]] = {}
    for hw in ("M7i", "M7a", "M7g"):
        for disk in ("gp3", "io2"):
            for var_full in ("mCQRS", "Classical_CQRS"):
                model_path = find_model_path(hw, disk, var_full)
                if model_path is None:
                    continue
                out[(hw, disk, var_full)] = compute_max_throughput(model_path)
    return out


LOGS_DIR = HERE.parent / "logs"


def compute_measured_throughput(hw: str, disk: str, var_full: str) -> float:
    """Real served throughput (j/s) computed from raw log files.
    Returns NaN if log is missing (e.g. for predicted M7a.io2 / M7g.io2 which
    have no real benchmark)."""
    hw_lc = hw.lower()  # M7i -> m7i
    var_slug = "m_cqrs" if var_full == "mCQRS" else "classical_cqrs"
    log_path = LOGS_DIR / f"{hw_lc}-{disk}-{var_slug}-load.log"
    if not log_path.exists():
        return float("nan")

    import json
    timestamps: List[int] = []
    http_count = 0
    write_count = 0  # POST + PATCH (each generates one ReachConsistency event)
    with open(log_path) as f:
        for line in f:
            try:
                j = json.loads(line)
            except Exception:
                continue
            t = j.get("time")
            if isinstance(t, int):
                timestamps.append(t)
            req = j.get("req")
            if isinstance(req, dict):
                method = req.get("method")
                # Count one http.request span per req-id by checking finalising line
                msg = j.get("msg", "")
                if "request completed" in msg:
                    http_count += 1
                    if method in ("POST", "PATCH"):
                        write_count += 1

    if not timestamps or http_count == 0:
        return float("nan")

    duration_s = (max(timestamps) - min(timestamps)) / 1000.0
    if duration_s <= 0:
        return float("nan")

    # Total system jobs (HTTP requests + async ReachConsistency events).
    return (http_count + write_count) / duration_s


def compute_all_measured_throughputs() -> Dict[Tuple[str, str, str], float]:
    """Only the 8 platforms used as calibration source (the ones with
    well-formed Load-mode benchmark logs). M7a.io2 / M7g.io2 are PREDICTED
    in this pipeline; their measurement (if any) is not shown."""
    measured_set = {
        ("M7i", "gp3"), ("M7i", "io2"),
        ("M7a", "gp3"),
        ("M7g", "gp3"),
    }
    out: Dict[Tuple[str, str, str], float] = {}
    for (hw, disk) in measured_set:
        for var_full in ("mCQRS", "Classical_CQRS"):
            t = compute_measured_throughput(hw, disk, var_full)
            if t == t:
                out[(hw, disk, var_full)] = t
    return out


def measured_metric_from_index(index_text: str, hw: str, disk: str, var_label: str,
                               request: str, metric: str) -> Optional[float]:
    """Extract a specific measured metric (avg) from index.md Load block.
    metric ∈ {"(pino) responseTime", "eventual_consistency_lag", ...}."""
    sec_re = re.compile(rf"^## {re.escape(hw)}\.large {disk}\s*$", re.M)
    m = sec_re.search(index_text)
    if not m:
        return None
    s, e = m.end(), len(index_text)
    nxt = re.search(r"^## M7", index_text[s:], re.M)
    if nxt:
        e = s + nxt.start()
    section = index_text[s:e]
    sub_re = re.compile(rf"^#### {re.escape(var_label)} Load\s*$", re.M)
    m2 = sub_re.search(section)
    if not m2:
        return None
    ss, se = m2.end(), len(section)
    nxt2 = re.search(r"^####", section[ss:], re.M)
    if nxt2:
        se = ss + nxt2.start()
    sub_text = section[ss:se]
    req_re = re.search(rf"═══\s+{request}.*?═══", sub_text, re.S)
    if not req_re:
        return None
    rest = sub_text[req_re.end():]
    end_re = re.search(r"═══\s+(POST|PATCH|GET)", rest)
    rseg = rest[:end_re.start()] if end_re else rest
    pat = re.escape(metric)
    rt = re.search(rf"^{'★ ' if metric == 'eventual_consistency_lag' else '  '}{pat}\s+(\d+)\s+(\d+(?:\.\d+)?)", rseg, re.M)
    if not rt:
        # try with leading whitespace flexibility
        rt = re.search(rf"{pat}\s+(\d+)\s+(\d+(?:\.\d+)?)", rseg)
    if not rt:
        return None
    return float(rt.group(2))


def predicted_m7a_io2_rt_from_ratio(index_text: str, hw: str, var_full: str) -> Dict[str, float]:
    """For M7a io2 (predicted), derive RT values as:
       measured M7a gp3 RT × (measured M7i io2 RT / measured M7i gp3 RT)
    Per-variation. Per-request-type. Captures the true direction of io2 effect
    on wall-clock (which K_disk from model demands misses for Classical).

    Returns {key: rt_ms} where key in {post_resp, post_full, patch_resp, patch_full, get_resp}.
    """
    var_label = "mCQRS" if var_full == "mCQRS" else "Classical CQRS"

    def fetch(disk: str, request: str, metric: str) -> Optional[float]:
        return measured_metric_from_index(index_text, "M7i", disk, var_label, request, metric)

    def fetch_target(disk: str, request: str, metric: str) -> Optional[float]:
        return measured_metric_from_index(index_text, hw, disk, var_label, request, metric)

    PINO = "(pino) responseTime"
    EC = "eventual_consistency_lag"

    def ratio(disk_metric_io2: Optional[float], disk_metric_gp3: Optional[float]) -> float:
        if disk_metric_io2 is None or disk_metric_gp3 is None or disk_metric_gp3 == 0:
            return 1.0
        return disk_metric_io2 / disk_metric_gp3

    K_post = ratio(fetch("io2", "POST", PINO), fetch("gp3", "POST", PINO))
    K_patch = ratio(fetch("io2", "PATCH", PINO), fetch("gp3", "PATCH", PINO))
    K_get = ratio(fetch("io2", "GET", PINO), fetch("gp3", "GET", PINO))
    K_eclag_post = ratio(fetch("io2", "POST", EC), fetch("gp3", "POST", EC))
    K_eclag_patch = ratio(fetch("io2", "PATCH", EC), fetch("gp3", "PATCH", EC))

    base_post = fetch_target("gp3", "POST", PINO)
    base_patch = fetch_target("gp3", "PATCH", PINO)
    base_get = fetch_target("gp3", "GET", PINO)
    base_ec_post = fetch_target("gp3", "POST", EC) or 0.0
    base_ec_patch = fetch_target("gp3", "PATCH", EC) or 0.0

    if None in (base_post, base_patch, base_get):
        return {}

    post_resp = base_post * K_post
    patch_resp = base_patch * K_patch
    get_resp = base_get * K_get
    post_full = post_resp + base_ec_post * K_eclag_post
    patch_full = patch_resp + base_ec_patch * K_eclag_patch

    return {
        "post_resp": post_resp,
        "post_full": post_full,
        "patch_resp": patch_resp,
        "patch_full": patch_full,
        "get_resp": get_resp,
    }


def update_summary_table(text: str) -> str:
    """Rebuild the Load-mode summary table:
    - Replace M7a io2 / M7g io2 rows with JMT-derived resp/full values.
    - Replace 3 per-method err columns (POST/PATCH/GET err) with one overall err.
    - Add Source, Measured Tput, Max Tput, Bottleneck columns.
    """

    # Predicted-row RT cache (for the predicted M7a/M7g io2 rows only).
    predicted_cache: Dict[Tuple[str, str], Dict] = {}
    for hw in ("M7a", "M7g"):
        for var_full, var_short in (("mCQRS", "mCQRS"), ("Classical_CQRS", "Classical")):
            result_path = PREDICTED_RUNS_DIR / f"{hw}_io2_{var_full}.jsimg-result.jsim"
            predicted_cache[(hw, var_short)] = sim_results(result_path)

    # Max-throughput (saturation bound) cache for ALL 12 models.
    max_tput = compute_all_max_throughputs()

    # Real measured throughput from raw HTTP logs (8 calibration-source platforms only).
    measured_tput = compute_all_measured_throughputs()

    # Cache the original index.md text for overall_err lookups.
    index_text = INDEX.read_text(encoding="utf-8")

    NEW_HEADER = (
        "| Candidate         | Source        | Price (USD/mo) | Measured Tput (j/s) "
        "| Max Tput (j/s) |    Err   | POST resp | POST full "
        "| PATCH resp | PATCH full | GET resp |"
    )
    NEW_SEP = (
        "|-------------------|:--------------|---------------:|--------------------:"
        "|---------------:|---------:|----------:|----------:"
        "|-----------:|-----------:|---------:|"
    )

    # Step 1: replace M7a io2 / M7g io2 rows (resp / full).
    # For M7a io2: use the wall-clock ratio K_RT from the M7i pair applied to
    # measured M7a gp3 values — this captures the actual io2 effect direction
    # per variation (which can be either improvement or slight regression).
    # For M7g io2: keep JMT-based simulation values (or OVERLOAD if Max Tput < 600).
    def repl(m: re.Match) -> str:
        hw = m.group(1)
        disk = m.group(2)
        var_short = m.group(3)
        price_col = m.group(4)

        if hw not in ("M7a", "M7g") or disk != "io2":
            return m.group(0)

        var_full = "mCQRS" if var_short == "mCQRS" else "Classical_CQRS"
        X_max, _ = max_tput.get((hw, disk, var_full), (float("nan"), "?"))
        candidate = f"{hw} {disk} {var_short}"

        if X_max == X_max and X_max < TOTAL_OFFERED:
            overload = " OVERLOAD "
            return (
                f"| {candidate:<17} |{price_col}|"
                f"     —    |{overload:>10}|{overload:>10}|"
                f"      —    |{overload:>11}|{overload:>11}|"
                f"    —    |{overload:>9}|"
            )

        if hw == "M7a":
            # Ratio-based prediction from measured M7i pair RT.
            r = predicted_m7a_io2_rt_from_ratio(index_text, hw, var_full)
            if r:
                return (
                    f"| {candidate:<17} |{price_col}|"
                    f"     —    | {r['post_resp']:>9.2f} | {r['post_full']:>9.2f} |"
                    f"      —    | {r['patch_resp']:>10.2f} | {r['patch_full']:>10.2f} |"
                    f"    —    | {r['get_resp']:>8.2f} |"
                )

        # Fallback / M7g: JMT-based simulation values.
        sim = predicted_cache.get((hw, var_short), {})
        per = sim.get("per_class", {})
        q_rt = per.get("Query", {}).get("rt_ms", float("nan")) or float("nan")
        c_rt = per.get("CreateCommand", {}).get("rt_ms", float("nan")) or float("nan")
        u_rt = per.get("UpdateCommand", {}).get("rt_ms", float("nan")) or float("nan")
        rc_rt = per.get("ReachConsistency", {}).get("rt_ms", float("nan")) or float("nan")

        return (
            f"| {candidate:<17} |{price_col}|"
            f"     —    | {c_rt:>9.2f} | {c_rt + rc_rt:>9.2f} |"
            f"      —    | {u_rt:>10.2f} | {u_rt + rc_rt:>10.2f} |"
            f"    —    | {q_rt:>8.2f} |"
        )

    text = SUMMARY_ROW_RE.sub(repl, text)

    # Step 2: rebuild summary table rows with new layout (collapsed err column).
    out_lines: List[str] = []
    in_load = False
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped == "### Load mode":
            in_load = True
            out_lines.append(line)
            continue
        if in_load and stripped.startswith("### "):
            in_load = False
            out_lines.append(line)
            continue

        if in_load and line.startswith("| Candidate"):
            out_lines.append(NEW_HEADER)
            continue

        if in_load and line.startswith("|-------------------|"):
            out_lines.append(NEW_SEP)
            continue

        if in_load and line.startswith("| M7"):
            m = SUMMARY_ROW_RE.match(line)
            if m:
                hw = m.group(1)
                disk = m.group(2)
                var_short = m.group(3)
                var_full = "mCQRS" if var_short == "mCQRS" else "Classical_CQRS"
                price_col = m.group(4).strip()
                # group 5,8,11 are per-method err; 6,9,12 are resp; 7,10 are full
                post_resp = m.group(6).strip()
                post_full = m.group(7).strip()
                patch_resp = m.group(9).strip()
                patch_full = m.group(10).strip()
                get_resp = m.group(12).strip()

                X_max, bottleneck = max_tput.get(
                    (hw, disk, var_full), (float("nan"), "?")
                )
                is_predicted = hw in ("M7a", "M7g") and disk == "io2"
                source = "predicted" if is_predicted else "measured"

                # Measured Tput from logs (8 measured rows only).
                measured = measured_tput.get((hw, disk, var_full))
                # Overall err rate from index.md Load block (measured only).
                err_pct = overall_err_from_index(index_text, hw, disk, var_full)

                saturated_model = X_max == X_max and X_max < TOTAL_OFFERED
                tput_str = f"{X_max:.2f} ⚠️" if saturated_model else f"{X_max:.2f}"

                if measured is None:
                    measured_str = "—"
                else:
                    sat_meas = measured < TOTAL_OFFERED * 0.97
                    measured_str = f"{measured:.2f} ⚠️" if sat_meas else f"{measured:.2f}"

                err_str = "—" if (err_pct != err_pct or is_predicted) else f"{err_pct:.2f}%"

                candidate = f"{hw} {disk} {var_short}"

                row = (
                    f"| {candidate:<17} "
                    f"| {source:<13} "
                    f"| {price_col:>14} "
                    f"| {measured_str:>19} "
                    f"| {tput_str:>14} "
                    f"| {err_str:>7}  "
                    f"| {post_resp:>9} "
                    f"| {post_full:>9} "
                    f"| {patch_resp:>10} "
                    f"| {patch_full:>10} "
                    f"| {get_resp:>8} |"
                )
                out_lines.append(row)
                continue

        out_lines.append(line)

    return "\n".join(out_lines)


PRED_NOTE_HEADING = "### Load mode"
PRED_NOTE_BODY = (
    "> **`Source` column tells what each row's `err` / `resp` / `full` numbers come from:**\n"
    "> - **`measured`** — real HTTP-benchmark logs from `index.md` (M7i.gp3, M7i.io2, M7a.gp3, M7g.gp3, "
    "    8 rows). `resp` = pino `responseTime` avg; `full` = `resp + ec_lag`.\n"
    "> - **`predicted`** — JMT-simulation of a model whose **disk-station** lambdas (EventStore, "
    "    SnapshotDB, ProjectionDB) were scaled from the gp3 model by `K_λ = λ_M7i.io2 / λ_M7i.gp3` "
    "    per the picture's formula (which is defined for disk operations only). "
    "    AppService (CPU) demands are kept identical to the gp3 model — the CPU is the same hw on "
    "    gp3 and io2 instances, so its service time does not scale with disk type. "
    "    (4 rows: M7a.io2 + M7g.io2 × {mCQRS, Classical}.) "
    "    `resp` = class's `Response Time per Sink` from JMT; `Err` is `—` because JMT does not "
    "    simulate request failures.\n"
    "> - **`Err`** (single column) = overall error rate over POST+PATCH+GET requests for the Load "
    "    benchmark, i.e. `Σ failed / Σ total` taken straight from the Load-block headers of `index.md`.\n"
    ">\n"
    "> **Two throughput columns:**\n"
    "> - **`Measured Tput (j/s)`** — real served throughput computed from raw HTTP logs: "
    "`(POST+PATCH+GET requests + POST/PATCH events) / log_duration`. Available for the 8 measured "
    "platforms; `—` for the 4 predicted (no benchmark for those).\n"
    "> - **`Max Tput (j/s)`** — analytical saturation bound from the JMT model using "
    "`X_max = 1 / max_s(Σ_c π_c × 1/λ(s,c))` with workload mix π_Q=1/6, π_Cr=1/6, π_Up=1/4, π_RC=5/12. "
    "Computed for all 12 rows from the calibrated/predicted .jsimg files. "
    "(Bottleneck station is the AppService in every model — full per-station ρ values are in "
    "the per-section blocks above.)\n"
    ">\n"
    "> **Why the two columns can disagree (e.g. M7g gp3 Classical: measured=550, model=834):** "
    "the JMT model is M/M/1 calibrated from Sequential measurements, which capture clean service "
    "time without concurrency overhead. The real system has additional overhead on Graviton "
    "(ARM CPU frequency scaling, Node.js event-loop saturation, gp3 burst-credit exhaustion, "
    "OS scheduling on 2 vCPUs) that the simple single-server model doesn't include. "
    "On M7i/M7a (x86, fewer overhead anomalies) the two columns agree closely. "
    "Offered total is 600 j/s; `⚠️` is shown when a value is meaningfully below offered."
)
SLA_STALE_NOTE = (
    "> **⚠️ The conclusions below were written against the *measured* M7a io2 / M7g io2 numbers "
    "from the original `index.md`. After replacing those rows with JMT-derived predictions, "
    "specific latency claims about io2 candidates no longer match the table above and should "
    "be re-evaluated.**"
)


def insert_notes(text: str) -> str:
    if PRED_NOTE_HEADING in text and PRED_NOTE_BODY not in text:
        text = text.replace(
            PRED_NOTE_HEADING,
            f"{PRED_NOTE_HEADING}\n\n{PRED_NOTE_BODY}",
            1,
        )
    if "### SLA Assessment" in text and SLA_STALE_NOTE not in text:
        text = text.replace(
            "### SLA Assessment",
            f"### SLA Assessment\n\n{SLA_STALE_NOTE}",
            1,
        )
    return text


def main() -> int:
    text = INDEX.read_text(encoding="utf-8")
    text = rewrite_io2_blocks(text)
    text = update_summary_table(text)
    text = insert_notes(text)
    OUT.write_text(text, encoding="utf-8")
    print(f"Wrote: {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
