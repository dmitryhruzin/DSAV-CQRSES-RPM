#!/usr/bin/env python3
"""
Calibrate each measured JMT model so JMT-simulated POST response time matches
the measured pino `responseTime` average from the Load benchmark.

Motivation: out-of-the-box Sequential-median calibration gives Max Tput just
slightly above offered 600 j/s, which puts the M/M/1 model near saturation
(util ≈ 0.94). At such utilization, RT = D / (1 − ρ) is 15-20× the service
demand, so JMT predicts 25-30 ms RT while the real M7a benchmark only saw
~9 ms. The real Node.js system has async-I/O parallelism and 2 vCPUs, so it
behaves better than single-server M/M/1 near saturation. We compensate by
shrinking AppService demands so the model reaches a similar RT at the same
offered load.

For each (hw, disk, variation):
  1. Parse measured POST pino `responseTime` avg from index.md (Load block).
  2. Read current AppService λ from the .jsimg.
  3. Solve: f × D_create / (1 − f × ρ_app_orig) = measured_RT
     where ρ_app_orig = Σ_c π_c × D_app_c × TOTAL_OFFERED (per-second arrival)
  4. Scale ALL AppService lambdas by 1/f (i.e. divide demands by 1/f, or
     equivalently multiply demands by f).
  5. Save back.

Disk-station demands (EventStore, SnapshotDB, ProjectionDB) are left alone
— their calibration is fine because disk-spans are measured directly.

Run AFTER calibration & consolidation, BEFORE predict_io2_jmt.py.
"""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Optional


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from predict_io2_jmt import (  # type: ignore[import-not-found]
    STATION_UA,
    find_station_node,
    iter_server_strategies,
    extract_lambdas,
)

MODELS = HERE / "calibrated_models"
INDEX = HERE / "index.md"

# 8 measured (hw, disk, var_in_filename, var_label_in_index.md)
MEASURED = [
    ("M7i", "gp3", "mCQRS",          "mCQRS"),
    ("M7i", "io2", "mCQRS",          "mCQRS"),
    ("M7a", "gp3", "mCQRS",          "mCQRS"),
    ("M7g", "gp3", "mCQRS",          "mCQRS"),
    ("M7i", "gp3", "Classical_CQRS", "Classical CQRS"),
    ("M7i", "io2", "Classical_CQRS", "Classical CQRS"),
    ("M7a", "gp3", "Classical_CQRS", "Classical CQRS"),
    ("M7g", "gp3", "Classical_CQRS", "Classical CQRS"),
]

OFFERED = {"Query": 100, "CreateCommand": 100, "UpdateCommand": 150, "ReachConsistency": 250}
TOTAL = float(sum(OFFERED.values()))
PI = {c: w / TOTAL for c, w in OFFERED.items()}

UA_TO_CANON = {
    "Запити": "Query",
    "Команди створення": "CreateCommand",
    "Команди оновлення": "UpdateCommand",
    "Процеси досягнення узгодженості": "ReachConsistency",
}
APP_SERVICE_UA = STATION_UA["AppService"]


def measured_post_rt(text: str, hw: str, disk: str, var_label: str) -> Optional[float]:
    """Extract POST pino responseTime avg (ms) from index.md Load block."""
    sec_re = re.compile(rf"^## {re.escape(hw)}\.large {disk}\s*$", re.M)
    m = sec_re.search(text)
    if not m:
        return None
    s, e = m.end(), len(text)
    nxt = re.search(r"^## M7", text[s:], re.M)
    if nxt:
        e = s + nxt.start()
    section = text[s:e]

    sub_re = re.compile(rf"^#### {re.escape(var_label)} Load\s*$", re.M)
    m2 = sub_re.search(section)
    if not m2:
        return None
    ss, se = m2.end(), len(section)
    nxt2 = re.search(r"^####", section[ss:], re.M)
    if nxt2:
        se = ss + nxt2.start()
    sub_text = section[ss:se]

    # Find POST block, then "(pino) responseTime ... avg" — pino is in column 3 (count, avg)
    post_re = re.search(r"═══\s+POST.*?═══", sub_text, re.S)
    if not post_re:
        return None
    rest = sub_text[post_re.end():]
    end_re = re.search(r"═══\s+(PATCH|GET)", rest)
    post_section = rest[:end_re.start()] if end_re else rest

    rt_line = re.search(
        r"\(pino\)\s+responseTime\s+(\d+)\s+(\d+(?:\.\d+)?)",
        post_section,
    )
    if not rt_line:
        return None
    return float(rt_line.group(2))


def appservice_demands_ms(jsimg: Path) -> Dict[str, float]:
    """{class_canon: demand_ms} for AppService."""
    lambdas = extract_lambdas(jsimg)
    out: Dict[str, float] = {}
    for (st, cls_ua), lam in lambdas.items():
        if st == APP_SERVICE_UA and lam > 0:
            canon = UA_TO_CANON.get(cls_ua)
            if canon:
                out[canon] = 1000.0 / lam
    return out


def all_demands_ms(jsimg: Path) -> Dict[str, Dict[str, float]]:
    """{station_ua: {class_canon: demand_ms}}."""
    lambdas = extract_lambdas(jsimg)
    out: Dict[str, Dict[str, float]] = {}
    for (st, cls_ua), lam in lambdas.items():
        if lam <= 0:
            continue
        canon = UA_TO_CANON.get(cls_ua)
        if canon:
            out.setdefault(st, {})[canon] = 1000.0 / lam
    return out


def disk_rt_contribution_for_create_ms(all_d: Dict[str, Dict[str, float]]) -> float:
    """RT contribution from disk stations (EventStore, SnapshotDB) for a
    CreateCommand request, assuming standard M/M/1 RT = D/(1-ρ).

    ρ at each disk station is computed from offered arrival rates."""
    rt = 0.0
    for st, demands_by_class in all_d.items():
        if st == APP_SERVICE_UA:
            continue
        d_create = demands_by_class.get("CreateCommand")
        if d_create is None:
            continue
        # ρ at this station = Σ_c λ_c × D_c (only classes that visit it)
        rho = sum(
            OFFERED[c] * (d / 1000.0) for c, d in demands_by_class.items()
        )
        if rho >= 1.0:
            rho = 0.999  # avoid div-by-zero, treat as nearly saturated
        rt += d_create / (1.0 - rho)
    return rt


def scale_appservice(jsimg: Path, f: float) -> int:
    """Multiply AppService demands by f (= divide lambdas by f)."""
    tree = ET.parse(jsimg)
    root = tree.getroot()
    node = find_station_node(root, APP_SERVICE_UA)
    if node is None:
        return 0
    n = 0
    for cls_ua, val in iter_server_strategies(node):
        cur = float(val.text)
        val.text = f"{cur / f:.10f}"
        n += 1
    tree.write(jsimg, encoding="utf-8", xml_declaration=True)
    return n


def main() -> int:
    text = INDEX.read_text(encoding="utf-8")
    print("=== Calibrating AppService demands to match measured POST RT ===\n")
    for hw, disk, var_full, var_label in MEASURED:
        jsimg = MODELS / f"{hw}_{disk}_{var_full}.jsimg"
        if not jsimg.exists():
            print(f"[skip] missing model {jsimg.name}")
            continue
        meas_rt_ms = measured_post_rt(text, hw, disk, var_label)
        if meas_rt_ms is None:
            print(f"[skip] could not parse measured POST RT for {hw}.{disk}.{var_label}")
            continue

        all_d = all_demands_ms(jsimg)
        app_d = all_d.get(APP_SERVICE_UA, {})
        if "CreateCommand" not in app_d:
            print(f"[skip] no CreateCommand AppService demand in {jsimg.name}")
            continue

        # ρ_app at AppService under offered 600 j/s.
        rho_app = sum(OFFERED[c] * (d / 1000.0) for c, d in app_d.items())
        D_create_app = app_d["CreateCommand"]  # ms

        # Disk-station RT contribution to the Create class.
        disk_rt = disk_rt_contribution_for_create_ms(all_d)

        # Target AppService RT = measured total RT − disk contribution.
        target_app_rt = meas_rt_ms - disk_rt
        if target_app_rt <= 0:
            print(f"  [skip] {hw}_{disk}_{var_full:<19} meas={meas_rt_ms:.2f} ≤ disk_rt={disk_rt:.2f} — cannot shrink AppService into negative")
            continue

        # Solve f × D / (1 − f × ρ) = target_app_rt for f (scale AppService demands by f).
        # → f = target / (D + target × ρ)
        denom = D_create_app + target_app_rt * rho_app
        if denom <= 0:
            print(f"[skip] bad denom for {jsimg.name}")
            continue
        f = target_app_rt / denom

        new_rho = f * rho_app
        warn = " ⚠️" if new_rho >= 0.99 else ""
        n = scale_appservice(jsimg, f)
        print(
            f"  {hw}_{disk}_{var_full:<19}  "
            f"meas={meas_rt_ms:7.2f}  "
            f"disk_RT={disk_rt:6.2f}  "
            f"target_app_RT={target_app_rt:6.2f}  "
            f"D_app {D_create_app:6.3f}→{D_create_app*f:6.3f}ms  "
            f"ρ_app {rho_app:.3f}→{new_rho:.3f}{warn}  "
            f"f={f:.4f}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
