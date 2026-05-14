#!/usr/bin/env python3
"""Run JMT CLI on all models and capture results.

Supports three distribution modes (exp / hyperexp / lognormal) which live in
sibling model directories ``models_<mode>/``. Run with ``--mode all`` (default)
to run every mode end-to-end, or ``--mode hyperexp`` etc.

For each mode:
  Baselines (6 configs):
    - run at sequential rates (sanity check)
    - run at load rates (validation)
  Predicted (2 configs):
    - run at target load rates with verbose response-time samples.

Outputs go to ``results_<mode>/`` and a per-mode summary file
``run_summary_<mode>.json``.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
JMT_JAR = "/Applications/Java Modelling Tools/JMT.jar"

CALIB = [
    ("m7i-gp3", "m_cqrs"),
    ("m7i-gp3", "classical_cqrs"),
    ("m7i-io2", "m_cqrs"),
    ("m7i-io2", "classical_cqrs"),
    ("m7a-gp3", "m_cqrs"),
    ("m7a-gp3", "classical_cqrs"),
]


def run_jmt(model_path: Path, timeout=1800):
    cmd = ["java", "-cp", JMT_JAR, "jmt.commandline.Jmt", "sim", str(model_path)]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return res.returncode, res.stdout, res.stderr


def parse_result(result_xml: Path):
    if not result_xml.exists():
        return None
    tree = ET.parse(result_xml)
    root = tree.getroot()
    out = []
    for m in root.findall("measure"):
        out.append({
            "type": m.get("measureType"),
            "station": m.get("station"),
            "class": m.get("class") or "",
            "mean": float(m.get("meanValue")),
            "lower": float(m.get("lowerLimit")),
            "upper": float(m.get("upperLimit")),
            "samples": int(m.get("analyzedSamples")),
            "successful": m.get("successful"),
        })
    return out


def make_variant_with_arrivals(src_jsimg: Path, dst_jsimg: Path,
                               new_arrivals: dict, new_log_path: Path,
                               new_name: str | None = None):
    """Open src .jsimg, rewrite RandomSource Exponential lambdas (per-class
    arrival rates) and logPath, write to dst.

    new_arrivals: dict of logical-class-name (Zapyty/Stvor/Onovl/RC) → rate /s.

    The Start node ALWAYS uses Exponential interarrival regardless of service
    distribution, so the same regex works for all three variants.
    """
    text = src_jsimg.read_text(encoding="utf-8")
    text = re.sub(r'logPath="[^"]*"', f'logPath="{new_log_path}"', text)
    if new_name:
        text = re.sub(r'(<sim[^>]*\bname=")[^"]*(")', rf'\1{new_name}\2', text)
        text = re.sub(r'(<archive[^>]*\bname=")[^"]*(")', rf'\1{new_name}\2', text)

    rs_match = re.search(r'<section className="RandomSource">(.*?)</section>',
                         text, flags=re.DOTALL)
    if not rs_match:
        raise RuntimeError("RandomSource section not found")
    rs = rs_match.group(1)
    lams = list(re.finditer(
        r'(<subParameter classPath="jmt\.engine\.random\.ExponentialPar" name="distrPar">'
        r'<subParameter classPath="java\.lang\.Double" name="lambda"><value>)([0-9eE.+-]+)(</value>)',
        rs,
    ))
    classes_order = ["Zapyty", "Stvor", "Onovl", "RC"]
    rates = [new_arrivals[c] for c in classes_order]
    new_rs = rs
    for idx, mt in reversed(list(enumerate(lams))):
        start, end = mt.start(2), mt.end(2)
        new_rs = new_rs[:start] + f"{rates[idx]}" + new_rs[end:]
    text = (text[:rs_match.start()]
            + '<section className="RandomSource">' + new_rs + '</section>'
            + text[rs_match.end():])
    dst_jsimg.write_text(text, encoding="utf-8")


def _compute_load_arrivals():
    """Compute per-(mach, var) arrival rates from the *load* logs."""
    out = {}
    for mach, var in CALIB:
        path = HERE.parent / "logs" / f"{mach}-{var}-load.log"
        if not path.exists():
            continue
        t0 = None
        t1 = None
        method_n = defaultdict(int)
        eh_n = 0
        for line in path.open():
            try:
                e = json.loads(line)
            except Exception:
                continue
            sp = e.get("span")
            if sp == "http.request":
                rid = (e.get("req") or {}).get("id")
                m = (e.get("req") or {}).get("method")
                st = e.get("startedAt")
                d = e.get("durationMs", 0)
                if st is None:
                    continue
                end = st + d
                if t0 is None or st < t0:
                    t0 = st
                if t1 is None or end > t1:
                    t1 = end
                method_n[m] += 1
            elif sp == "event.handle":
                eh_n += 1
        dur_s = (t1 - t0) / 1000.0 if t0 else 1.0
        out[f"{mach}__{var}"] = {
            "Zapyty": method_n.get("GET", 0) / dur_s,
            "Stvor":  method_n.get("POST", 0) / dur_s,
            "Onovl":  method_n.get("PATCH", 0) / dur_s,
            "RC":     eh_n / dur_s,
            "_dur_s": dur_s,
            "_method_n": dict(method_n),
            "_eh_n": eh_n,
        }
    return out


def run_for_mode(mode: str, skip_baselines: bool = False):
    """Run all simulations for one distribution mode."""
    models = HERE / f"models_{mode}"
    jmt_logs = HERE / "jmt_logs" / mode
    results = HERE / f"results_{mode}"
    results.mkdir(parents=True, exist_ok=True)
    jmt_logs.mkdir(parents=True, exist_ok=True)
    summary = {}

    # ---------- Baselines (seq sanity) ----------
    if not skip_baselines:
        for mach, var in CALIB:
            m_name = f"{mach}_{var}.jsimg"
            m_path = models / m_name
            print(f"\n=== [{mode}] {mach} {var} (seq rates) ===")
            try:
                rc, so, se = run_jmt(m_path)
            except subprocess.TimeoutExpired:
                print("  TIMEOUT")
                continue
            if rc != 0:
                print("STDERR:", se[:500])
            result_xml = models / f"{m_name}-result.jsim"
            if not result_xml.exists():
                print(f"  no result.jsim produced (rc={rc})")
                continue
            new_xml = results / f"{mach}_{var}_seq-result.jsim"
            shutil.move(str(result_xml), str(new_xml))
            summary.setdefault(f"{mach}__{var}", {})["seq"] = parse_result(new_xml)
            print(f"  ok -> {new_xml.name}")

        # ---------- Baselines at load rate ----------
        load_arrivals_by_key = _compute_load_arrivals()
        (HERE / "load_arrivals.json").write_text(
            json.dumps(load_arrivals_by_key, indent=2)
        )
        for mach, var in CALIB:
            m_name = f"{mach}_{var}.jsimg"
            m_path = models / m_name
            key = f"{mach}__{var}"
            if key not in load_arrivals_by_key:
                continue
            load_rates = {k: v for k, v in load_arrivals_by_key[key].items()
                          if not k.startswith("_")}
            tmp_model = models / f"_tmp_{mach}_{var}_load.jsimg"
            tmp_log_dir = jmt_logs / f"{mach}_{var}_load_validation"
            tmp_log_dir.mkdir(exist_ok=True)
            make_variant_with_arrivals(m_path, tmp_model, load_rates, tmp_log_dir,
                                       new_name=tmp_model.name)
            print(f"\n=== [{mode}] {mach} {var} (load rates) ===")
            print("   arrivals:", {k: f"{v:.2f}/s" for k, v in load_rates.items()})
            try:
                rc, so, se = run_jmt(tmp_model)
            except subprocess.TimeoutExpired:
                print("  TIMEOUT")
                tmp_model.unlink(missing_ok=True)
                continue
            result_xml = models / f"{tmp_model.name}-result.jsim"
            if not result_xml.exists():
                print(f"  no result.jsim produced (rc={rc})")
                tmp_model.unlink(missing_ok=True)
                continue
            new_xml = results / f"{mach}_{var}_load-result.jsim"
            shutil.move(str(result_xml), str(new_xml))
            tmp_model.unlink(missing_ok=True)
            summary.setdefault(key, {})["load"] = parse_result(new_xml)
            print(f"  ok -> {new_xml.name}")

    # ---------- Predicted M7a.io2 ----------
    for var in ["m_cqrs", "classical_cqrs"]:
        m_name = f"m7a-io2_{var}_predicted.jsimg"
        m_path = models / m_name
        print(f"\n=== [{mode}] predicted m7a-io2 {var} ===")
        try:
            rc, so, se = run_jmt(m_path, timeout=3600)
        except subprocess.TimeoutExpired:
            print("  TIMEOUT")
            continue
        if rc != 0:
            print("STDERR:", se[:500])
        result_xml = models / f"{m_name}-result.jsim"
        if not result_xml.exists():
            print(f"  no result.jsim produced (rc={rc})")
            continue
        new_xml = results / f"m7a-io2_{var}_predicted-result.jsim"
        shutil.move(str(result_xml), str(new_xml))
        summary[f"m7a-io2__{var}"] = {"predicted": parse_result(new_xml)}
        print(f"  ok -> {new_xml.name}")

    (HERE / f"run_summary_{mode}.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False)
    )
    print(f"\nWrote run_summary_{mode}.json")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["exp", "hyperexp", "lognormal", "all"],
                        default="all")
    parser.add_argument("--skip-baselines", action="store_true",
                        help="Skip baseline seq/load runs (predicted only).")
    args = parser.parse_args()
    if args.mode == "all":
        for m in ("exp", "hyperexp", "lognormal"):
            run_for_mode(m, skip_baselines=args.skip_baselines)
    else:
        run_for_mode(args.mode, skip_baselines=args.skip_baselines)


if __name__ == "__main__":
    main()
