#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Generate calibrated JMT / JSIMgraph models from a template .jsimg and index.md.

Usage:
    python generate_calibrated_jmt_models.py \
      --template mCQRS.jsimg \
      --report index.md \
      --out calibrated_models

Optional:
    --update-arrivals
        Update arrival rates in Source/Start station.
        If your template already has correct arrival rates, do not use this flag.

    --stat avg
        Which statistic from index.md to use for service demand.
        Default: avg.
        Allowed: avg, median, p95.
"""

from __future__ import annotations

import argparse
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


# ============================================================
# 1. Canonical names and aliases in your JMT model
# ============================================================

CLASS_ALIASES: Dict[str, List[str]] = {
    "Query": [
        "Query",
        "Запити",
    ],
    "CreateCommand": [
        "CreateCommand",
        "Команди створення",
    ],
    "UpdateCommand": [
        "UpdateCommand",
        "Команди оновлення",
    ],
    "ReachConsistency": [
        "ReachConsistency",
        "Процеси досягнення узгодженості",
    ],
}

STATION_ALIASES: Dict[str, List[str]] = {
    "AppService": [
        "AppService",
        "Server",
        "Сервер",
    ],
    "EventStore": [
        "EventStore",
        "Сховище подій",
    ],
    "SnapshotDB": [
        "SnapshotDB",
        "База даних знімків",
    ],
    "ProjectionDB": [
        "ProjectionDB",
        "База даних проєкцій",
        "База даних проекцій",
    ],
}

CLASS_ORDER = [
    "Query",
    "CreateCommand",
    "UpdateCommand",
    "ReachConsistency",
]

RESOURCE_ORDER = [
    "AppService",
    "SnapshotDB",
    "EventStore",
    "ProjectionDB",
]

DEFAULT_ARRIVAL_RATES = {
    "Query": 100.0,
    "CreateCommand": 100.0,
    "UpdateCommand": 150.0,
    "ReachConsistency": 250.0,
}


# ============================================================
# 2. Helpers
# ============================================================

def local_name(tag: str) -> str:
    """Return XML local tag name without namespace."""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def text_of(elem: Optional[ET.Element]) -> str:
    if elem is None or elem.text is None:
        return ""
    return elem.text.strip()


def normalize_name(value: str) -> str:
    return value.strip()


def safe_nonnegative(value: float) -> float:
    if value < 0:
        return 0.0
    return value


def resolve_alias(existing_names: Iterable[str], aliases: List[str]) -> Optional[str]:
    existing_set = set(existing_names)
    for alias in aliases:
        if alias in existing_set:
            return alias
    return None


def collect_names(root: ET.Element) -> List[str]:
    """
    Collect possible class/station names from attributes and <refClass> text.
    This makes alias resolution more robust.
    """
    names = set()

    for elem in root.iter():
        name_attr = elem.attrib.get("name")
        if name_attr:
            names.add(name_attr.strip())

        if local_name(elem.tag) == "refClass":
            t = text_of(elem)
            if t:
                names.add(t)

    return sorted(names)


# ============================================================
# 3. Parsing index.md
# ============================================================

def parse_metric_line(line: str) -> Optional[Dict[str, Any]]:
    """
    Parses lines like:

        db.eventstore.write  12319  1.30  0.81  3.95  0.16  23.67
        ★ eventual_consistency_lag  12319  11.82  2.64  63.03  0.18  245.08
    """

    pattern = (
        r"^\s*(?:★\s*)?"
        r"(.+?)\s+"
        r"(\d+)\s+"
        r"(-?\d+(?:\.\d+)?)\s+"
        r"(-?\d+(?:\.\d+)?)\s+"
        r"(-?\d+(?:\.\d+)?)\s+"
        r"(-?\d+(?:\.\d+)?)\s+"
        r"(-?\d+(?:\.\d+)?)\s*$"
    )

    m = re.match(pattern, line)
    if not m:
        return None

    return {
        "name": m.group(1).strip(),
        "count": int(m.group(2)),
        "avg": float(m.group(3)),
        "median": float(m.group(4)),
        "p95": float(m.group(5)),
        "min": float(m.group(6)),
        "max": float(m.group(7)),
    }


def parse_ok_count_from_header(header_text: str) -> Optional[int]:
    """
    Supports:
        ─ 12319 total / 12319 ok / 0 failed
        ─ 600 ok
        ─ 2100 ok / 100 failed
    """

    m = re.search(
        r"(\d+)\s+total\s*/\s*(\d+)\s+ok\s*/\s*(\d+)\s+failed",
        header_text,
    )
    if m:
        return int(m.group(2))

    m = re.search(r"(\d+)\s+ok", header_text)
    if m:
        return int(m.group(1))

    return None


def extract_request_blocks(metrics_code_block: str) -> Dict[str, Any]:
    """
    Extract POST/PATCH/GET tables from a single ```...``` metrics block.
    """

    result: Dict[str, Any] = {}

    req_re = re.compile(
        r"═══\s+(POST|PATCH|GET)\s+(.*?)═══\s*\n"
        r"(.*?)(?=\n═══\s+(?:POST|PATCH|GET)\s+|\Z)",
        re.S,
    )

    for req, header_rest, body in req_re.findall(metrics_code_block):
        ok_count = parse_ok_count_from_header(header_rest)

        metrics: Dict[str, Dict[str, Any]] = {}
        for line in body.splitlines():
            parsed = parse_metric_line(line)
            if parsed:
                metrics[parsed["name"]] = parsed

        if ok_count is None:
            if "(pino) responseTime" in metrics:
                ok_count = metrics["(pino) responseTime"]["count"]
            elif "command.execute" in metrics:
                ok_count = metrics["command.execute"]["count"]
            elif "query.execute" in metrics:
                ok_count = metrics["query.execute"]["count"]
            else:
                ok_count = 0

        result[req] = {
            "ok_count": ok_count,
            "metrics": metrics,
        }

    return result


def parse_index_md(text: str) -> Dict[Tuple[str, str, str], Dict[str, Any]]:
    """
    Returns:
        data[(hardware_key, variation, mode)] = request_blocks

    hardware_key:
        M7i_gp3, M7i_io2, M7a_gp3, M7a_io2, M7g_gp3, M7g_io2

    variation:
        mCQRS, Classical

    mode:
        Load or Sequential
    """

    data: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

    hw_header_re = re.compile(r"^##\s+(M7[agi])\.large\s+(gp3|io2)\s*$", re.M)
    hw_headers = list(hw_header_re.finditer(text))

    for idx, hw_match in enumerate(hw_headers):
        start = hw_match.start()
        end = hw_headers[idx + 1].start() if idx + 1 < len(hw_headers) else len(text)

        hw_section = text[start:end]

        instance = hw_match.group(1)
        disk = hw_match.group(2)
        hardware_key = f"{instance}_{disk}"

        metric_block_re = re.compile(
            r"####\s+(mCQRS|Classical CQRS)\s+(Sequential|Load)\s*"
            r"\n\s*```(.*?)```",
            re.S,
        )

        for mb in metric_block_re.finditer(hw_section):
            variation_raw = mb.group(1)
            mode = mb.group(2)
            code_block = mb.group(3)

            variation = "mCQRS" if variation_raw == "mCQRS" else "Classical"

            request_blocks = extract_request_blocks(code_block)

            if not request_blocks:
                continue

            data[(hardware_key, variation, mode)] = request_blocks

    return data


# ============================================================
# 4. Demand calculation
# ============================================================

def metric_value(
    block: Dict[str, Any],
    req: str,
    name: str,
    stat: str,
    default: float = 0.0,
) -> float:
    try:
        return float(block[req]["metrics"][name][stat])
    except KeyError:
        return default


def metric_count(
    block: Dict[str, Any],
    req: str,
    name: str,
    default: int = 0,
) -> int:
    try:
        return int(block[req]["metrics"][name]["count"])
    except KeyError:
        return default


def ok_count(block: Dict[str, Any], req: str) -> int:
    try:
        return int(block[req]["ok_count"])
    except KeyError:
        return 0


def calculate_demands_ms(
    block: Dict[str, Any],
    variation: str,
    stat: str = "avg",
) -> Dict[Tuple[str, str], float]:
    """
    Calculate service demands in milliseconds.

    Returned key:
        (class, resource) -> demand_ms
    """

    d: Dict[Tuple[str, str], float] = {}

    # -----------------------------
    # Query
    # -----------------------------
    q_exec = metric_value(block, "GET", "query.execute", stat)
    q_projection_read = metric_value(block, "GET", "db.projection.read", stat)

    d[("Query", "AppService")] = safe_nonnegative(q_exec - q_projection_read)
    d[("Query", "ProjectionDB")] = q_projection_read
    d[("Query", "SnapshotDB")] = 0.0
    d[("Query", "EventStore")] = 0.0

    # -----------------------------
    # CreateCommand
    # -----------------------------
    post_exec = metric_value(block, "POST", "command.execute", stat)
    post_n = ok_count(block, "POST")

    if variation == "mCQRS":
        eventstore_create = metric_value(block, "POST", "db.eventstore.write", stat)

        snapshot_read_count = metric_count(block, "POST", "db.snapshot.read")
        p_snapshot_read = snapshot_read_count / post_n if post_n else 0.0

        snapshot_create = (
            p_snapshot_read * metric_value(block, "POST", "db.snapshot.read", stat)
            + metric_value(block, "POST", "db.snapshot.write", stat)
        )

    else:
        eventstore_read_count = metric_count(block, "POST", "db.eventstore.read")
        snapshot_read_count = metric_count(block, "POST", "db.snapshot.read")

        p_eventstore_read = eventstore_read_count / post_n if post_n else 0.0
        p_snapshot_read = snapshot_read_count / post_n if post_n else 0.0

        eventstore_create = (
            p_eventstore_read * metric_value(block, "POST", "db.eventstore.read", stat)
            + metric_value(block, "POST", "db.eventstore.write", stat)
        )

        snapshot_create = (
            p_snapshot_read * metric_value(block, "POST", "db.snapshot.read", stat)
        )

    d[("CreateCommand", "AppService")] = safe_nonnegative(
        post_exec - eventstore_create - snapshot_create
    )
    d[("CreateCommand", "SnapshotDB")] = snapshot_create
    d[("CreateCommand", "EventStore")] = eventstore_create
    d[("CreateCommand", "ProjectionDB")] = 0.0

    # -----------------------------
    # UpdateCommand
    # -----------------------------
    patch_exec = metric_value(block, "PATCH", "command.execute", stat)
    patch_n = ok_count(block, "PATCH")

    if variation == "mCQRS":
        eventstore_update = metric_value(block, "PATCH", "db.eventstore.write", stat)

        snapshot_update = (
            metric_value(block, "PATCH", "db.snapshot.read", stat)
            + metric_value(block, "PATCH", "db.snapshot.write", stat)
        )

    else:
        eventstore_update = (
            metric_value(block, "PATCH", "db.eventstore.read", stat)
            + metric_value(block, "PATCH", "db.eventstore.write", stat)
        )

        snapshot_write_count = metric_count(block, "PATCH", "db.snapshot.write")
        p_snapshot_write = snapshot_write_count / patch_n if patch_n else 0.0

        snapshot_update = (
            metric_value(block, "PATCH", "db.snapshot.read", stat)
            + p_snapshot_write * metric_value(block, "PATCH", "db.snapshot.write", stat)
        )

    d[("UpdateCommand", "AppService")] = safe_nonnegative(
        patch_exec - eventstore_update - snapshot_update
    )
    d[("UpdateCommand", "SnapshotDB")] = snapshot_update
    d[("UpdateCommand", "EventStore")] = eventstore_update
    d[("UpdateCommand", "ProjectionDB")] = 0.0

    # -----------------------------
    # ReachConsistency
    # -----------------------------
    post_publish = metric_value(block, "POST", "event.publishAll", stat)
    post_lag = metric_value(block, "POST", "eventual_consistency_lag", stat)
    post_projection = metric_value(block, "POST", "db.projection.write", stat)

    post_reach_total = post_publish + post_lag
    post_reach_app = safe_nonnegative(post_reach_total - post_projection)

    patch_publish = metric_value(block, "PATCH", "event.publishAll", stat)
    patch_lag = metric_value(block, "PATCH", "eventual_consistency_lag", stat)
    patch_projection = (
        metric_value(block, "PATCH", "db.projection.read", stat)
        + metric_value(block, "PATCH", "db.projection.write", stat)
    )

    patch_reach_total = patch_publish + patch_lag
    patch_reach_app = safe_nonnegative(patch_reach_total - patch_projection)

    total_writes = post_n + patch_n
    w_post = post_n / total_writes if total_writes else 0.0
    w_patch = patch_n / total_writes if total_writes else 0.0

    d[("ReachConsistency", "AppService")] = (
        w_post * post_reach_app + w_patch * patch_reach_app
    )
    d[("ReachConsistency", "ProjectionDB")] = (
        w_post * post_projection + w_patch * patch_projection
    )
    d[("ReachConsistency", "SnapshotDB")] = 0.0
    d[("ReachConsistency", "EventStore")] = 0.0

    return d


# ============================================================
# 5. JMT XML update helpers
# ============================================================

def find_lambda_parameter_value_node(elem: ET.Element) -> Optional[ET.Element]:
    """
    Find <subParameter name="lambda"> ... <value>...</value> ... </subParameter>
    inside a given distribution/strategy element.
    """

    for candidate in elem.iter():
        if candidate.attrib.get("name") != "lambda":
            continue

        # Prefer direct child <value>
        for child in list(candidate):
            if local_name(child.tag) == "value":
                return child

        # Fallback: any nested <value>
        for child in candidate.iter():
            if local_name(child.tag) == "value":
                return child

    return None


def set_exponential_mean_seconds(strategy_elem: ET.Element, mean_seconds: float) -> bool:
    """
    JMT Exponential distribution stores lambda, not mean.

    mean_seconds = service demand in seconds
    lambda = 1 / mean_seconds

    For zero service demand we use a very high lambda value.
    """

    if mean_seconds <= 0.0:
        lambda_value = 1.0e12
    else:
        lambda_value = 1.0 / mean_seconds

    value_node = find_lambda_parameter_value_node(strategy_elem)
    if value_node is None:
        return False

    value_node.text = f"{lambda_value:.10f}"
    return True


def find_station_elements(root: ET.Element, station_name: str) -> List[ET.Element]:
    """
    Finds JMT station nodes by name.
    To avoid matching performance index nodes, we require that the element contains sections.
    """

    result = []

    for elem in root.iter():
        if elem.attrib.get("name") != station_name:
            continue

        has_section = any(local_name(child.tag) == "section" for child in list(elem))
        if has_section:
            result.append(elem)

    return result


def find_service_strategy_parameters(station_elem: ET.Element) -> List[ET.Element]:
    """
    Finds ServiceStrategy parameters inside a station.
    """

    result = []

    for elem in station_elem.iter():
        if elem.attrib.get("name") == "ServiceStrategy":
            result.append(elem)

    return result


def strategy_after_refclass(service_strategy_param: ET.Element, class_name: str) -> Optional[ET.Element]:
    """
    In JSIMG files, ServiceStrategy is usually encoded as:

        <parameter name="ServiceStrategy">
            <refClass>Запити</refClass>
            <subParameter ...> ... lambda ... </subParameter>
            <refClass>Команди створення</refClass>
            <subParameter ...> ... lambda ... </subParameter>
            ...
        </parameter>

    This function returns the subParameter immediately after a matching refClass.
    """

    children = list(service_strategy_param)

    for i, child in enumerate(children):
        if local_name(child.tag) != "refClass":
            continue

        if text_of(child) != class_name:
            continue

        for j in range(i + 1, len(children)):
            next_child = children[j]

            # If we hit another refClass, there is no strategy for this class.
            if local_name(next_child.tag) == "refClass":
                break

            # The first non-refClass element after refClass is the strategy.
            return next_child

    return None


def update_service_time(
    root: ET.Element,
    station_name: str,
    class_name: str,
    mean_seconds: float,
) -> Tuple[bool, str]:
    """
    Update exactly one pair:
        station_name + class_name

    Returns (changed, status):
        status in {"updated", "disabled", "missing"}.

    Important:
        - does not update all classes in the station;
        - writes lambda = 1 / mean_seconds;
        - works only with Exponential strategies that contain name="lambda".
    """

    station_elems = find_station_elements(root, station_name)
    if not station_elems:
        return False, "missing"

    for station_elem in station_elems:
        for service_strategy_param in find_service_strategy_parameters(station_elem):
            strategy_elem = strategy_after_refclass(service_strategy_param, class_name)

            if strategy_elem is None:
                continue

            if local_name(strategy_elem.tag) == "subParameter" and (
                "Disabled" in strategy_elem.attrib.get("classPath", "")
                or "Disabled" in strategy_elem.attrib.get("name", "")
            ):
                return False, "disabled"

            ok = set_exponential_mean_seconds(strategy_elem, mean_seconds)
            return ok, ("updated" if ok else "missing")

    return False, "missing"


def find_source_elements(root: ET.Element) -> List[ET.Element]:
    """
    Finds likely source/start stations: any node that contains a RandomSource
    or SourceSection.
    """

    candidates = []

    source_section_classes = {"RandomSource", "SourceSection", "Source"}

    for elem in root.iter():
        if local_name(elem.tag) != "node":
            continue

        for child in list(elem):
            if local_name(child.tag) != "section":
                continue
            if child.attrib.get("className") in source_section_classes:
                candidates.append(elem)
                break

    return candidates


def find_arrival_distribution_parameters(source_elem: ET.Element) -> List[ET.Element]:
    """
    Find per-class arrival distribution parameters inside a Source node.

    In a JSIMG RandomSource, this is a parameter array named "ServiceStrategy"
    that holds Exponential distributions per refClass (lambda = arrival rate).
    Some JMT versions also expose firingTimeDistribution / InterarrivalTimeDistribution.
    """

    result = []

    allowed_names = {
        "ServiceStrategy",
        "firingTimeDistribution",
        "FiringTimeDistribution",
        "InterarrivalTimeDistribution",
        "interarrivalTimeDistribution",
    }

    for section in source_elem.iter():
        if local_name(section.tag) != "section":
            continue

        if section.attrib.get("className") not in {"RandomSource", "SourceSection", "Source"}:
            continue

        for elem in section.iter():
            if elem.attrib.get("name") in allowed_names:
                result.append(elem)

    return result


def update_arrival_rate(
    root: ET.Element,
    class_name: str,
    arrival_rate: float,
) -> bool:
    """
    For Exponential arrivals JMT also stores lambda.

    Here lambda is the arrival rate itself, not 1/rate.
    """

    changed = False

    for source_elem in find_source_elements(root):
        for param in find_arrival_distribution_parameters(source_elem):
            strategy_elem = strategy_after_refclass(param, class_name)

            if strategy_elem is None:
                continue

            value_node = find_lambda_parameter_value_node(strategy_elem)
            if value_node is not None:
                value_node.text = f"{arrival_rate:.10f}"
                changed = True

    return changed


# ============================================================
# 6. Model generation
# ============================================================

def generate_model(
    template_path: Path,
    output_path: Path,
    demands_ms: Dict[Tuple[str, str], float],
    update_arrivals: bool,
    arrival_rates: Dict[str, float],
) -> Dict[str, Any]:
    tree = ET.parse(template_path)
    root = tree.getroot()

    existing_names = collect_names(root)

    resolved_classes: Dict[str, str] = {}
    for canonical, aliases in CLASS_ALIASES.items():
        resolved = resolve_alias(existing_names, aliases)
        if not resolved:
            raise RuntimeError(
                f"Cannot resolve class {canonical}. "
                f"Available names: {existing_names}"
            )
        resolved_classes[canonical] = resolved

    resolved_stations: Dict[str, str] = {}
    for canonical, aliases in STATION_ALIASES.items():
        resolved = resolve_alias(existing_names, aliases)
        if not resolved:
            raise RuntimeError(
                f"Cannot resolve station {canonical}. "
                f"Available names: {existing_names}"
            )
        resolved_stations[canonical] = resolved

    report: Dict[str, Any] = {
        "output": str(output_path),
        "classes": resolved_classes,
        "stations": resolved_stations,
        "updated": [],
        "not_updated": [],
        "skipped_disabled": [],
        "arrival_updated": [],
        "arrival_not_updated": [],
    }

    for cls in CLASS_ORDER:
        for res in RESOURCE_ORDER:
            demand_ms = demands_ms.get((cls, res), 0.0)
            demand_seconds = demand_ms / 1000.0

            station_name = resolved_stations[res]
            class_name = resolved_classes[cls]

            changed, status = update_service_time(
                root=root,
                station_name=station_name,
                class_name=class_name,
                mean_seconds=demand_seconds,
            )

            item = {
                "class": cls,
                "resource": res,
                "station_name": station_name,
                "class_name": class_name,
                "demand_ms": demand_ms,
                "demand_seconds": demand_seconds,
                "lambda": (1.0e12 if demand_seconds <= 0 else 1.0 / demand_seconds),
                "status": status,
            }

            if changed:
                report["updated"].append(item)
            elif status == "disabled":
                report["skipped_disabled"].append(item)
            else:
                report["not_updated"].append(item)

    if update_arrivals:
        for cls, rate in arrival_rates.items():
            class_name = resolved_classes[cls]
            changed = update_arrival_rate(root, class_name, rate)

            item = {
                "class": cls,
                "class_name": class_name,
                "arrival_rate": rate,
            }

            if changed:
                report["arrival_updated"].append(item)
            else:
                report["arrival_not_updated"].append(item)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        ET.indent(tree, space="  ")
    except AttributeError:
        pass

    tree.write(output_path, encoding="utf-8", xml_declaration=True)

    return report


# ============================================================
# 7. Output files
# ============================================================

def write_service_demands_csv(
    path: Path,
    all_demands: Dict[str, Dict[Tuple[str, str], float]],
) -> None:
    with path.open("w", encoding="utf-8") as f:
        f.write("model,class,resource,demand_ms,demand_seconds,lambda\n")

        for model_name, demands in sorted(all_demands.items()):
            for cls in CLASS_ORDER:
                for res in RESOURCE_ORDER:
                    ms = demands.get((cls, res), 0.0)
                    seconds = ms / 1000.0
                    lambda_value = 1.0e12 if seconds <= 0 else 1.0 / seconds

                    f.write(
                        f"{model_name},{cls},{res},"
                        f"{ms:.10f},{seconds:.12f},{lambda_value:.10f}\n"
                    )


def write_generation_report(
    path: Path,
    reports: Dict[str, Dict[str, Any]],
) -> None:
    with path.open("w", encoding="utf-8") as f:
        for model_name, report in sorted(reports.items()):
            f.write(f"=== {model_name} ===\n")
            f.write(f"Output: {report['output']}\n")
            f.write(f"Resolved classes: {report['classes']}\n")
            f.write(f"Resolved stations: {report['stations']}\n")
            f.write(f"Updated service times: {len(report['updated'])}\n")
            f.write(
                f"Skipped (disabled in template, demand=0 expected): "
                f"{len(report.get('skipped_disabled', []))}\n"
            )
            f.write(f"NOT updated service times: {len(report['not_updated'])}\n")

            if report["not_updated"]:
                f.write("Not updated items:\n")
                for item in report["not_updated"]:
                    f.write(
                        "  - "
                        f"{item['class']} / {item['resource']} "
                        f"station={item['station_name']} "
                        f"class={item['class_name']} "
                        f"demand_ms={item['demand_ms']:.10f} "
                        f"status={item.get('status', '?')}\n"
                    )

            if report["arrival_updated"] or report["arrival_not_updated"]:
                f.write(f"Updated arrivals: {len(report['arrival_updated'])}\n")
                f.write(f"NOT updated arrivals: {len(report['arrival_not_updated'])}\n")

                if report["arrival_not_updated"]:
                    f.write("Not updated arrivals:\n")
                    for item in report["arrival_not_updated"]:
                        f.write(
                            "  - "
                            f"{item['class']} "
                            f"class={item['class_name']} "
                            f"rate={item['arrival_rate']:.10f}\n"
                        )

            f.write("\n")


# ============================================================
# 8. Main
# ============================================================

def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--template",
        default="mCQRS.jsimg",
        help="Template JSIMG file.",
    )

    parser.add_argument(
        "--report",
        default="index.md",
        help="Experiment report markdown file.",
    )

    parser.add_argument(
        "--out",
        default="calibrated_models",
        help="Output directory.",
    )

    parser.add_argument(
        "--mode",
        default="Load",
        choices=["Load", "Sequential"],
        help="Which experiment mode to use from index.md.",
    )

    parser.add_argument(
        "--stat",
        default="avg",
        choices=["avg", "median", "p95"],
        help="Metric statistic used as service demand.",
    )

    parser.add_argument(
        "--no-update-arrivals",
        dest="update_arrivals",
        action="store_false",
        help="Do not overwrite Source/Start arrival rates (keep template values).",
    )
    parser.set_defaults(update_arrivals=True)

    args = parser.parse_args()

    template_path = Path(args.template)
    report_path = Path(args.report)
    out_dir = Path(args.out)

    if not template_path.exists():
        raise FileNotFoundError(f"Template file not found: {template_path}")

    if not report_path.exists():
        raise FileNotFoundError(f"Report file not found: {report_path}")

    text = report_path.read_text(encoding="utf-8")
    parsed = parse_index_md(text)

    # M7a_io2 and M7g_io2 are NOT calibrated from raw measurements; instead
    # they are produced by predict_io2_jmt.py by scaling M7a_gp3 / M7g_gp3
    # models using the M7i io2/gp3 ratio. Hence only 8 calibrated models here.
    expected_hardware = [
        "M7i_gp3",
        "M7i_io2",
        "M7a_gp3",
        "M7g_gp3",
    ]

    expected_variations = [
        "mCQRS",
        "Classical",
    ]

    all_demands: Dict[str, Dict[Tuple[str, str], float]] = {}
    reports: Dict[str, Dict[str, Any]] = {}

    generated_count = 0

    for hardware in expected_hardware:
        for variation in expected_variations:
            key = (hardware, variation, args.mode)

            if key not in parsed:
                print(f"[WARN] No block found for {key}; skipped.")
                continue

            demands_ms = calculate_demands_ms(
                block=parsed[key],
                variation=variation,
                stat=args.stat,
            )

            variation_for_filename = (
                "mCQRS" if variation == "mCQRS" else "Classical_CQRS"
            )

            model_name = f"{hardware}_{variation_for_filename}"
            output_path = out_dir / f"{model_name}.jsimg"

            print(f"[INFO] Generating {output_path}")

            report = generate_model(
                template_path=template_path,
                output_path=output_path,
                demands_ms=demands_ms,
                update_arrivals=args.update_arrivals,
                arrival_rates=DEFAULT_ARRIVAL_RATES,
            )

            all_demands[model_name] = demands_ms
            reports[model_name] = report
            generated_count += 1

            if report["not_updated"]:
                print(f"[WARN] {model_name}: some service times were NOT updated.")
                for item in report["not_updated"]:
                    print(
                        "  - "
                        f"{item['class']} / {item['resource']} "
                        f"({item['demand_ms']:.6f} ms, status={item['status']})"
                    )

            if report["arrival_not_updated"]:
                print(f"[WARN] {model_name}: some arrival rates were NOT updated.")
                for item in report["arrival_not_updated"]:
                    print(
                        "  - "
                        f"{item['class']} "
                        f"({item['arrival_rate']:.4f}/s)"
                    )

    out_dir.mkdir(parents=True, exist_ok=True)

    write_service_demands_csv(
        path=out_dir / "service_demands.csv",
        all_demands=all_demands,
    )

    write_generation_report(
        path=out_dir / "generation_report.txt",
        reports=reports,
    )

    print()
    print("Done.")
    print(f"Generated models: {generated_count}")
    print(f"Output directory: {out_dir}")
    print(f"Service demand table: {out_dir / 'service_demands.csv'}")
    print(f"Generation report: {out_dir / 'generation_report.txt'}")

    expected_count = len(expected_hardware) * len(expected_variations)
    if generated_count != expected_count:
        print()
        print(
            f"[WARN] Expected {expected_count} models, but generated {generated_count}. "
            f"Check generation_report.txt and whether index.md contains all required Load blocks."
        )


if __name__ == "__main__":
    main()
    