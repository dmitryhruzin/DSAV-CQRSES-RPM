#!/usr/bin/env python3
"""
Run JMT simulations on every calibrated model and collect Utilization +
Throughput per system / per class.

For each .jsimg in calibrated_models/:
  1. Inject Throughput (station) + per-class Throughput (at Sink) measures.
  2. Drop any <results> from a prior run.
  3. Reduce maxSamples so sims converge in seconds, not hours.
  4. Run jmt.commandline.Jmt sim ... with -Xmx4g.
  5. Parse <results> and append to summary.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


JMT_JAR = "/Applications/Java Modelling Tools/JMT.jar"

CLASS_NAMES = {
    "Query": "Запити",
    "CreateCommand": "Команди створення",
    "UpdateCommand": "Команди оновлення",
    "ReachConsistency": "Процеси досягнення узгодженості",
}

STATION_NAMES = {
    "AppService": "Сервер",
    "EventStore": "Сховище подій",
    "SnapshotDB": "База даних знімків",
    "ProjectionDB": "База даних проєкцій",
}

SINK_NAME = "Стоп"


def local_name(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def strip_results(root: ET.Element) -> None:
    for results in list(root):
        if local_name(results.tag) == "results":
            root.remove(results)


def has_measure(sim: ET.Element, name: str) -> bool:
    for m in sim:
        if local_name(m.tag) == "measure" and m.attrib.get("name") == name:
            return True
    return False


def make_measure(name: str, ref_node: str, ref_class: str, mtype: str) -> ET.Element:
    e = ET.Element("measure")
    e.set("alpha", "0.01")
    e.set("name", name)
    e.set("nodeType", "station")
    e.set("precision", "0.05")
    e.set("referenceNode", ref_node)
    e.set("referenceUserClass", ref_class)
    e.set("type", mtype)
    e.set("verbose", "false")
    return e


def find_sim(root: ET.Element) -> ET.Element:
    for child in root:
        if local_name(child.tag) == "sim":
            return child
    raise RuntimeError("no <sim> element")


def find_connection_index(sim: ET.Element) -> int:
    for i, child in enumerate(sim):
        if local_name(child.tag) == "connection":
            return i
    return len(sim)


def add_throughput_measures(sim: ET.Element) -> int:
    insert_at = find_connection_index(sim)
    added = 0

    for station in STATION_NAMES.values():
        name = f"{station}_Throughput"
        if has_measure(sim, name):
            continue
        sim.insert(insert_at, make_measure(name, station, "", "Throughput"))
        insert_at += 1
        added += 1

    for cls in CLASS_NAMES.values():
        name = f"{SINK_NAME}_{cls}_Throughput per Sink"
        if has_measure(sim, name):
            continue
        sim.insert(insert_at, make_measure(name, SINK_NAME, cls, "Throughput per Sink"))
        insert_at += 1
        added += 1

    return added


def prepare_model(src: Path, dst: Path, max_samples: int) -> None:
    tree = ET.parse(src)
    root = tree.getroot()
    strip_results(root)
    sim = find_sim(root)
    sim.set("maxSamples", str(max_samples))
    sim.set("disableStatisticStop", "false")
    add_throughput_measures(sim)
    dst.parent.mkdir(parents=True, exist_ok=True)
    tree.write(dst, encoding="ISO-8859-1", xml_declaration=True)


def run_jmt(model_path: Path, max_sim_time: int, heap: str = "4g") -> Tuple[int, str]:
    cmd = [
        "java", f"-Xmx{heap}",
        "-cp", JMT_JAR,
        "jmt.commandline.Jmt", "sim", str(model_path),
        "-maxtime", str(max_sim_time),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=max_sim_time * 4 + 120)
    return proc.returncode, (proc.stdout + proc.stderr)[-2000:]


def parse_results(model_path: Path) -> List[Dict[str, Any]]:
    """
    JMT writes simulation output to <model_path>-result.jsim alongside the
    rewritten model file. The .jsim is a <solutions> root with <measure>
    children that use attributes meanValue / measureType / station / class.
    """
    out: List[Dict[str, Any]] = []
    candidates = [
        model_path.with_suffix(model_path.suffix + "-result.jsim"),
        Path(str(model_path) + "-result.jsim"),
    ]
    result_file = next((p for p in candidates if p.exists()), None)
    if result_file is None:
        return out

    tree = ET.parse(result_file)
    root = tree.getroot()
    for m in root:
        if local_name(m.tag) != "measure":
            continue
        try:
            mean = float(m.attrib.get("meanValue", "nan"))
        except ValueError:
            mean = float("nan")
        out.append({
            "name": _build_name(m),
            "station": m.attrib.get("station", ""),
            "class": m.attrib.get("class", ""),
            "type_id": m.attrib.get("measureType", ""),
            "final_value": mean,
            "samples": int(m.attrib.get("analyzedSamples", "0")),
            "successful": m.attrib.get("successful", "") == "true",
        })
    return out


def _build_name(m: ET.Element) -> str:
    station = m.attrib.get("station", "")
    cls = m.attrib.get("class", "")
    mtype = m.attrib.get("measureType", "")
    if cls:
        return f"{station}_{cls}_{mtype}"
    return f"{station}_{mtype}"


def process_model(
    src: Path,
    work_dir: Path,
    max_samples: int,
    max_sim_time: int,
) -> Dict[str, Any]:
    work = work_dir / src.name
    prepare_model(src, work, max_samples)
    rc, log = run_jmt(work, max_sim_time)
    measures = parse_results(work)
    return {
        "model": src.stem,
        "path": str(work),
        "rc": rc,
        "log_tail": log[-400:],
        "measures": measures,
    }


def summarise(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    rows = []
    for r in results:
        row: Dict[str, Any] = {"model": r["model"], "rc": r["rc"]}
        for m in r["measures"]:
            label = m["name"]
            row[label] = m["final_value"]
        rows.append(row)
    return {"rows": rows}


def write_csv(rows: List[Dict[str, Any]], path: Path) -> None:
    if not rows:
        path.write_text("model\n")
        return
    keys = ["model", "rc"]
    extra = sorted({k for r in rows for k in r.keys() if k not in keys})
    keys.extend(extra)
    with path.open("w", encoding="utf-8") as f:
        f.write(",".join(keys) + "\n")
        for r in rows:
            vals = []
            for k in keys:
                v = r.get(k, "")
                if isinstance(v, float):
                    vals.append(f"{v:.6f}")
                else:
                    vals.append(str(v).replace(",", " "))
            f.write(",".join(vals) + "\n")


def write_markdown(results: List[Dict[str, Any]], path: Path) -> None:
    lines: List[str] = []
    lines.append("# JMT simulation results")
    lines.append("")
    lines.append("Load: 100 GET/s, 100 POST/s, 150 PATCH/s (ReachConsistency = 250 events/s).")
    lines.append("")

    lines.append("## Overview — bottleneck at the AppService (Сервер)")
    lines.append("")
    lines.append("Server util ≈ 1.0 means the AppService can't keep up with the offered load and queue backs up.")
    lines.append("System throughput is the total per-class throughput observed at the sink.")
    lines.append("")
    lines.append("Calibration: AppService demand = Sequential-mode median(`command.execute`/`query.execute`) ")
    lines.append("− Sequential-mode median DB-span times. Sequential mode runs one request at a time, so the ")
    lines.append("measured numbers are close to pure service time without queue delays — the right input for ")
    lines.append("a queueing model. (Load-mode benchmarks already include queue delays and badly distort the ")
    lines.append("calibration on weaker instances; M7g.large in particular reads as ~2.5 s `command.execute` ")
    lines.append("under Load, which would force the model into permanent saturation.)")
    lines.append("")
    lines.append("| Model | Сервер util | Server throughput (jobs/s) | Σ system throughput (jobs/s) | Status |")
    lines.append("|---|---|---|---|---|")
    for r in sorted(results, key=lambda x: x["model"]):
        srv_util = next((m for m in r["measures"]
                         if m["type_id"] == "Utilization" and m["station"] == STATION_NAMES["AppService"]),
                        None)
        srv_thr = next((m for m in r["measures"]
                        if m["type_id"] == "Throughput" and m["station"] == STATION_NAMES["AppService"]),
                       None)
        sink_total = sum(
            m["final_value"] for m in r["measures"]
            if m["type_id"] == "Throughput per Sink"
        )
        if srv_util is None:
            lines.append(f"| {r['model']} | — | — | — | failed |")
            continue
        u = srv_util["final_value"]
        status = "saturated" if u >= 0.99 else "OK"
        lines.append(
            f"| {r['model']} | {u:.4f} | "
            f"{srv_thr['final_value']:.2f} | "
            f"{sink_total:.2f} | {status} |"
        )
    lines.append("")

    for r in sorted(results, key=lambda x: x["model"]):
        lines.append(f"## {r['model']}")
        lines.append("")
        if r["rc"] != 0 and not r["measures"]:
            lines.append(f"Failed (rc={r['rc']}). Log tail:")
            lines.append("```")
            lines.append(r["log_tail"])
            lines.append("```")
            lines.append("")
            continue

        util = [m for m in r["measures"] if m["type_id"] == "Utilization"]
        thr_station = [m for m in r["measures"] if m["type_id"] == "Throughput"]
        thr_sink = [m for m in r["measures"] if m["type_id"] == "Throughput per Sink"]
        rt_sink = [m for m in r["measures"] if m["type_id"] == "Response Time per Sink"]

        def stamp(m: Dict[str, Any]) -> str:
            return "" if m["successful"] else "  ⚠️ not converged"

        if util:
            lines.append("### Utilization")
            lines.append("")
            lines.append("| Station | Utilization | samples |")
            lines.append("|---|---|---|")
            for m in sorted(util, key=lambda x: x["station"]):
                lines.append(
                    f"| {m['station']} | {m['final_value']:.4f}{stamp(m)} | {m['samples']} |"
                )
            lines.append("")

        if thr_station:
            lines.append("### Throughput per station (jobs/s)")
            lines.append("")
            lines.append("| Station | Throughput | samples |")
            lines.append("|---|---|---|")
            for m in sorted(thr_station, key=lambda x: x["station"]):
                lines.append(
                    f"| {m['station']} | {m['final_value']:.4f}{stamp(m)} | {m['samples']} |"
                )
            lines.append("")

        if thr_sink:
            lines.append("### System throughput per class (jobs/s, measured at sink)")
            lines.append("")
            lines.append("| Class | Throughput | samples |")
            lines.append("|---|---|---|")
            for m in sorted(thr_sink, key=lambda x: x["class"]):
                lines.append(
                    f"| {m['class']} | {m['final_value']:.4f}{stamp(m)} | {m['samples']} |"
                )
            lines.append("")

        if rt_sink:
            lines.append("### Response time per class (s, source→sink)")
            lines.append("")
            lines.append("| Class | Response time | samples |")
            lines.append("|---|---|---|")
            for m in sorted(rt_sink, key=lambda x: x["class"]):
                lines.append(
                    f"| {m['class']} | {m['final_value']:.6f}{stamp(m)} | {m['samples']} |"
                )
            lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", default="calibrated_models")
    parser.add_argument("--work-dir", default="sim_runs")
    parser.add_argument("--max-samples", type=int, default=50000)
    parser.add_argument("--max-sim-time", type=int, default=200)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--summary-md", default="sim_runs/summary.md")
    parser.add_argument("--summary-csv", default="sim_runs/summary.csv")
    args = parser.parse_args()

    in_dir = Path(args.input_dir)
    work_dir = Path(args.work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    models = sorted(in_dir.glob("*.jsimg"))
    if not models:
        print(f"no models in {in_dir}", file=sys.stderr)
        return 1

    results: List[Dict[str, Any]] = []
    print(f"Running {len(models)} models with {args.workers} workers, "
          f"max_samples={args.max_samples}, max_sim_time={args.max_sim_time}s")

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {
            ex.submit(process_model, m, work_dir, args.max_samples, args.max_sim_time): m
            for m in models
        }
        for fut in as_completed(futures):
            m = futures[fut]
            try:
                r = fut.result()
            except Exception as e:
                print(f"  [ERR] {m.name}: {e}", file=sys.stderr)
                results.append({"model": m.stem, "rc": -1,
                                "log_tail": str(e), "measures": []})
                continue
            n = len(r["measures"])
            print(f"  [OK ] {r['model']}: rc={r['rc']}, measures={n}")
            results.append(r)

    write_markdown(results, Path(args.summary_md))
    rows = summarise(results)["rows"]
    write_csv(rows, Path(args.summary_csv))
    print(f"\nWrote: {args.summary_md}")
    print(f"Wrote: {args.summary_csv}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
