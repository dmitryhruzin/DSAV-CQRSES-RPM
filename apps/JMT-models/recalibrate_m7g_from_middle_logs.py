#!/usr/bin/env python3
"""
Re-calibrate M7g_gp3 JMT models using newly captured middle-load logs:
    apps/logs/m7g-gp3-m_cqrs-middle-load.log
    apps/logs/m7g-gp3-classical_cqrs-middle-load.log

Middle-load = ~50 POST + ~75 PATCH + ~100 GET req/s (≈64% of the full
100/100/150 target). At this rate M7g still serves the load (0 failed),
so per-span durations reflect actual service time under concurrency
without being polluted by the full saturation queue.

For each (variation, request_method, span), compute the *median* of the
observed durations. Then use the existing calibration logic to derive
JMT ServiceStrategy lambdas, and patch M7g_gp3_<variation>.jsimg in place.

Other 6 calibrated models (M7i, M7a) are untouched.
"""

from __future__ import annotations

import json
import statistics
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Dict, List


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from generate_calibrated_jmt_models import (  # type: ignore[import-not-found]
    CLASS_ALIASES,
    CLASS_ORDER,
    DEFAULT_ARRIVAL_RATES,
    RESOURCE_ORDER,
    STATION_ALIASES,
    calculate_demands_ms,
    collect_names,
    resolve_alias,
    update_arrival_rate,
    update_service_time,
)


LOGS_DIR = HERE.parent / "logs"
MODELS_DIR = HERE / "calibrated_models"

# (variation_full_in_filename, calibration_variation_keyword, stat, log_filename)
#
# Per-variation stat choice on M7g middle-load measurements:
#   - mCQRS has larger handler demand (median POST cmd.execute ≈ 3.7 ms);
#     median is robust and gives X_max ≈ 476 vs measured ≈ 547 (13% pessimism).
#   - Classical has small handler demand (median POST cmd.execute ≈ 2.5 ms);
#     median underestimates the load-time service time relative to avg, so the
#     M/M/1 X_max blows up (732). avg captures the queue-relevant tail and
#     yields X_max ≈ 524 — within 5% of measured ≈ 550.
TARGETS = [
    ("mCQRS",          "mCQRS",     "median", "m7g-gp3-m_cqrs-middle-load.log"),
    ("Classical_CQRS", "Classical", "avg",    "m7g-gp3-classical_cqrs-middle-load.log"),
]

# Spans we care about for calibration. event.handle is used as proxy for
# eventual_consistency_lag (the time-to-projection-update metric is derived
# in the same way: it captures the async event handler cost, which is what
# calculate_demands_ms needs in ReachConsistency at AppService).
SPANS_OF_INTEREST = {
    "command.execute",
    "query.execute",
    "db.eventstore.read",
    "db.eventstore.write",
    "db.snapshot.read",
    "db.snapshot.write",
    "db.projection.read",
    "db.projection.write",
    "event.publishAll",
    "event.handle",
}


def parse_log(path: Path) -> Dict[str, Dict]:
    """Returns {method: {ok_count, metrics: {span: stats}}}, mirroring
    extract_request_blocks() output from generate_calibrated_jmt_models.py."""
    durations: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))
    ok_counts: Dict[str, int] = defaultdict(int)
    req_method: Dict[str, str] = {}  # req_id -> method

    # Pass 1: collect every span duration, keyed by (method, span).
    # Strategy: spans synchronously inside the HTTP handler are tagged with
    # req.method. event.handle / event.publishAll / db.projection.* run in
    # the async event handler but the log message still includes the
    # originating req (since the handler context propagates req_id).
    with path.open() as f:
        for line in f:
            try:
                j = json.loads(line)
            except Exception:
                continue
            req = j.get("req")
            if not isinstance(req, dict):
                continue
            method = req.get("method")
            req_id = req.get("id")

            if "request completed" in j.get("msg", "") and method in ("POST", "PATCH", "GET"):
                ok_counts[method] += 1
                rt = j.get("responseTime")
                if rt is not None:
                    durations[method]["(pino) responseTime"].append(float(rt))

            span = j.get("span")
            dur = j.get("durationMs")
            if span and dur is not None and span in SPANS_OF_INTEREST and method in ("POST", "PATCH", "GET"):
                durations[method][span].append(float(dur))

    # Pass 2: build the block dict.
    out: Dict[str, Dict] = {}
    for method in ("POST", "PATCH", "GET"):
        metrics: Dict[str, Dict] = {}
        for span, values in durations[method].items():
            if not values:
                continue
            metrics[span] = {
                "count": len(values),
                "avg": sum(values) / len(values),
                "median": statistics.median(values),
                "p95": _q(values, 0.95),
                "min": min(values),
                "max": max(values),
            }
        # eventual_consistency_lag is not a span we emit ourselves; the
        # calibration formula uses it as the time the projection waits.
        # event.handle is the most accurate proxy we have.
        if "event.handle" in metrics:
            metrics["eventual_consistency_lag"] = dict(metrics["event.handle"])
        out[method] = {
            "ok_count": ok_counts[method],
            "metrics": metrics,
        }
    return out


def _q(values: List[float], q: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    s = sorted(values)
    idx = q * (len(s) - 1)
    lo = int(idx)
    hi = min(lo + 1, len(s) - 1)
    frac = idx - lo
    return s[lo] * (1 - frac) + s[hi] * frac


def recalibrate(target_jsimg: Path, demands_ms: Dict, log_total: Dict[str, int]) -> Dict:
    tree = ET.parse(target_jsimg)
    root = tree.getroot()
    existing_names = collect_names(root)

    resolved_classes = {c: resolve_alias(existing_names, a) for c, a in CLASS_ALIASES.items()}
    resolved_stations = {s: resolve_alias(existing_names, a) for s, a in STATION_ALIASES.items()}

    n_updated = 0
    n_skipped = 0
    for cls in CLASS_ORDER:
        for res in RESOURCE_ORDER:
            demand_ms = demands_ms.get((cls, res), 0.0)
            demand_sec = demand_ms / 1000.0
            changed, status = update_service_time(
                root=root,
                station_name=resolved_stations[res],
                class_name=resolved_classes[cls],
                mean_seconds=demand_sec,
            )
            if changed:
                n_updated += 1
            elif status == "disabled":
                n_skipped += 1

    tree.write(target_jsimg, encoding="utf-8", xml_declaration=True)
    return {
        "updated": n_updated,
        "skipped_disabled": n_skipped,
        "demands": demands_ms,
        "log_total": log_total,
    }


def main() -> int:
    for var_full, var_calib, stat, log_name in TARGETS:
        log_path = LOGS_DIR / log_name
        target = MODELS_DIR / f"M7g_gp3_{var_full}.jsimg"

        if not log_path.exists():
            print(f"[skip] missing log {log_path}")
            continue
        if not target.exists():
            print(f"[skip] missing model {target}")
            continue

        print(f"\n=== {var_full} ===  log: {log_name}  stat: {stat}")
        block = parse_log(log_path)
        for m, d in block.items():
            print(f"  {m:5s} ok={d['ok_count']}, spans counted: " +
                  ", ".join(f"{k}={v['count']}" for k, v in list(d["metrics"].items())[:5]) + " …")

        demands_ms = calculate_demands_ms(block=block, variation=var_calib, stat=stat)
        print(f"\n  derived service demands (ms):")
        for (cls, res), d in sorted(demands_ms.items()):
            if d > 0:
                print(f"    {cls:<20} @ {res:<14}  {d:>10.4f} ms")

        result = recalibrate(target, demands_ms, {m: d["ok_count"] for m, d in block.items()})
        print(f"\n  patched {target.name}: updated={result['updated']}, "
              f"skipped_disabled={result['skipped_disabled']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
