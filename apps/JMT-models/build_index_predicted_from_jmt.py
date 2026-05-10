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
    if rho_by_station:
        bottleneck = max(rho_by_station, key=rho_by_station.get)
        X_max = 1.0 / rho_by_station[bottleneck]
        lines.append(
            f"Max system throughput (saturation bound, workload mix 100:100:150:250): "
            f"**{X_max:.2f} j/s** — bottleneck: {STATION_UA[bottleneck]} ({bottleneck})."
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


def update_summary_table(text: str) -> str:
    """1) Replace M7a io2 / M7g io2 rows with JMT-derived resp/full values.
    2) Insert a new 'Sys Tput (j/s)' column for ALL rows, sourced from JMT
       (sum of Throughput per Sink across the 4 classes).
    """

    # Predicted-row RT cache (for the predicted M7a/M7g io2 rows only).
    predicted_cache: Dict[Tuple[str, str], Dict] = {}
    for hw in ("M7a", "M7g"):
        for var_full, var_short in (("mCQRS", "mCQRS"), ("Classical_CQRS", "Classical")):
            result_path = PREDICTED_RUNS_DIR / f"{hw}_io2_{var_full}.jsimg-result.jsim"
            predicted_cache[(hw, var_short)] = sim_results(result_path)

    # Max-throughput (saturation bound) cache for ALL 12 models.
    max_tput = compute_all_max_throughputs()

    # Step 1: replace M7a io2 / M7g io2 rows (resp / full from JMT).
    def repl(m: re.Match) -> str:
        hw = m.group(1)
        disk = m.group(2)
        var_short = m.group(3)
        price_col = m.group(4)

        if hw not in ("M7a", "M7g") or disk != "io2":
            return m.group(0)

        sim = predicted_cache.get((hw, var_short), {})
        per = sim.get("per_class", {})

        q_rt = per.get("Query", {}).get("rt_ms", float("nan")) or float("nan")
        c_rt = per.get("CreateCommand", {}).get("rt_ms", float("nan")) or float("nan")
        u_rt = per.get("UpdateCommand", {}).get("rt_ms", float("nan")) or float("nan")
        rc_rt = per.get("ReachConsistency", {}).get("rt_ms", float("nan")) or float("nan")

        candidate = f"{hw} {disk} {var_short}"

        return (
            f"| {candidate:<17} |{price_col}|"
            f"     —    | {c_rt:>9.2f} | {c_rt + rc_rt:>9.2f} |"
            f"      —    | {u_rt:>10.2f} | {u_rt + rc_rt:>10.2f} |"
            f"    —    | {q_rt:>8.2f} |"
        )

    text = SUMMARY_ROW_RE.sub(repl, text)

    # Step 2: insert system throughput column into header, separator and every row.
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
            # Insert "Source" before Price, and "Max Tput" + "Bottleneck" after Price.
            new_line = line.replace(
                "| Price (USD/mo) |",
                "| Source        | Price (USD/mo) | Max Tput (j/s) | Bottleneck   |",
                1,
            )
            out_lines.append(new_line)
            continue

        if in_load and line.startswith("|-------------------|"):
            new_line = line.replace(
                "|---------------:|",
                "|:--------------|---------------:|---------------:|:-------------|",
                1,
            )
            out_lines.append(new_line)
            continue

        if in_load and line.startswith("| M7"):
            m = SUMMARY_ROW_RE.match(line)
            if m:
                hw = m.group(1)
                disk = m.group(2)
                var_short = m.group(3)
                var_full = "mCQRS" if var_short == "mCQRS" else "Classical_CQRS"
                X_max, bottleneck = max_tput.get(
                    (hw, disk, var_full), (float("nan"), "?")
                )
                is_predicted = hw in ("M7a", "M7g") and disk == "io2"
                source = "predicted" if is_predicted else "measured"
                parts = line.split("|")
                # parts: ["", " Candidate ", " Price ", " err ", ...]
                cell_source = f" {source:<13} "
                cell_tput = f" {X_max:>14.2f} "
                cell_bn = f" {bottleneck:<12} "
                # Layout: ['', Candidate, Source, Price, MaxTput, Bottleneck, err, ...]
                new_parts = (
                    parts[:2]
                    + [cell_source, parts[2], cell_tput, cell_bn]
                    + parts[3:]
                )
                out_lines.append("|".join(new_parts))
                continue

        out_lines.append(line)

    return "\n".join(out_lines)


PRED_NOTE_HEADING = "### Load mode"
PRED_NOTE_BODY = (
    "> **`Source` column tells what each row's `err` / `resp` / `full` numbers come from:**\n"
    "> - **`measured`** — real HTTP-benchmark logs from `index.md` (M7i.gp3, M7i.io2, M7a.gp3, M7g.gp3, "
    "    8 rows). `resp` = pino `responseTime` avg; `full` = `resp + ec_lag`.\n"
    "> - **`predicted`** — JMT-simulation of a model whose every (class × station) lambda was "
    "    scaled from the corresponding gp3 calibrated model by `K_λ = λ_M7i.io2 / λ_M7i.gp3` "
    "    (4 rows: M7a.io2 + M7g.io2 × {mCQRS, Classical}). `resp` = class's `Response Time per Sink` "
    "    from JMT (does NOT include HTTP framework overhead); `err` is shown as `—` because JMT "
    "    does not simulate request failures.\n"
    ">\n"
    "> `Max Tput (j/s)` and `Bottleneck` are derived **analytically** from the JMT model for ALL "
    "12 rows (no simulation needed):\n"
    "> ```\n"
    ">    X_max = 1 / max_s ( Σ_c π_c × 1/λ(s,c) )\n"
    ">    Bottleneck = argmax_s ( Σ_c π_c × 1/λ(s,c) )\n"
    "> ```\n"
    "> where the workload mix is `π_Q=1/6, π_Cr=1/6, π_Up=1/4, π_RC=5/12`. Offered total is 600 j/s; "
    "if `Max Tput` ≥ 600 the system can serve the workload, otherwise it saturates."
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
