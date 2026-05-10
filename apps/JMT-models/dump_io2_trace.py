#!/usr/bin/env python3
"""
Dump every coefficient and parameter used in the io2 prediction:

  1. λ extracted from the calibrated M7i.large gp3 + io2 .jsimg files (the
     control pair). Service demand S = 1/λ is shown next to it.
  2. K coefficients per (variation, class, station):
        K_λ        = λ_M7i.io2 / λ_M7i.gp3     (lambda ratio)
        K_demand   = 1 / K_λ                    (service-demand ratio)
  3. λ extracted from M7a_gp3 / M7g_gp3 calibrated models.
  4. Predicted λ = λ_target.gp3 × K_λ, with the resulting predicted demand.

Output:  prediction_traces.md
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict, List, Tuple

# Reuse the production code's extractor — that way the trace can't drift
# from what predict_io2_jmt.py actually does.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from predict_io2_jmt import (  # type: ignore[import-not-found]
    SRC_DIR,
    STATION_UA,
    CLASS_UA,
    VARIATIONS,
    GP3_TARGETS,
    extract_lambdas,
)


HERE = Path(__file__).resolve().parent
OUT_PATH = HERE / "prediction_traces.md"


def fmt_lambda(lam: float) -> str:
    return f"{lam:>14.4f}"


def fmt_demand(lam: float) -> str:
    if lam <= 0:
        return "       —     "
    return f"{1000.0 / lam:>10.4f} ms"


def section_lambdas(title: str, lambdas: Dict[Tuple[str, str], float]) -> List[str]:
    out = [f"### {title}", ""]
    out.append("| station                | class                                 |"
               "         λ |       S = 1000/λ (ms) |")
    out.append("|------------------------|---------------------------------------|"
               "----------:|----------------------:|")
    for (st, cls) in sorted(lambdas):
        out.append(
            f"| {st:<22} | {cls:<37} |"
            f"{fmt_lambda(lambdas[(st, cls)])} |"
            f" {fmt_demand(lambdas[(st, cls)])}      |"
        )
    out.append("")
    return out


def section_K(
    title: str,
    m7i_gp3: Dict[Tuple[str, str], float],
    m7i_io2: Dict[Tuple[str, str], float],
) -> List[str]:
    out = [f"### {title}", ""]
    out.append("`K_λ = λ_M7i.io2 / λ_M7i.gp3` &nbsp; · &nbsp; `K_demand = 1 / K_λ`")
    out.append("")
    out.append("| station                | class                                 |"
               "  λ_M7i.gp3 |  λ_M7i.io2 |     K_λ |  K_demand | demand_M7i.gp3 (ms) | demand_M7i.io2 (ms) |")
    out.append("|------------------------|---------------------------------------|"
               "-----------:|-----------:|--------:|----------:|--------------------:|--------------------:|")
    for k in sorted(m7i_gp3):
        if k not in m7i_io2:
            continue
        st, cls = k
        l_gp3 = m7i_gp3[k]
        l_io2 = m7i_io2[k]
        K_l = l_io2 / l_gp3 if l_gp3 else float("nan")
        K_d = 1.0 / K_l if K_l else float("nan")
        d_gp3 = 1000.0 / l_gp3 if l_gp3 else float("nan")
        d_io2 = 1000.0 / l_io2 if l_io2 else float("nan")
        out.append(
            f"| {st:<22} | {cls:<37} |"
            f"{l_gp3:>11.4f} |{l_io2:>11.4f} |"
            f"{K_l:>8.4f} |{K_d:>10.4f} |"
            f" {d_gp3:>17.4f}   |"
            f" {d_io2:>17.4f}   |"
        )
    out.append("")
    return out


def section_predicted(
    title: str,
    target_gp3: Dict[Tuple[str, str], float],
    m7i_gp3: Dict[Tuple[str, str], float],
    m7i_io2: Dict[Tuple[str, str], float],
) -> List[str]:
    out = [f"### {title}", ""]
    out.append(
        "Per-key formula: `λ_predicted = λ_target.gp3 × (λ_M7i.io2 / λ_M7i.gp3)`."
    )
    out.append("")
    out.append("| station                | class                                 |"
               " λ_target.gp3 |     K_λ | λ_predicted | demand_target.gp3 (ms) | demand_predicted (ms) |")
    out.append("|------------------------|---------------------------------------|"
               "-------------:|--------:|------------:|-----------------------:|----------------------:|")
    for k in sorted(target_gp3):
        if k not in m7i_gp3 or k not in m7i_io2 or m7i_gp3[k] == 0:
            continue
        st, cls = k
        l_t_gp3 = target_gp3[k]
        K_l = m7i_io2[k] / m7i_gp3[k]
        l_t_io2 = l_t_gp3 * K_l
        d_t_gp3 = 1000.0 / l_t_gp3 if l_t_gp3 else float("nan")
        d_t_io2 = 1000.0 / l_t_io2 if l_t_io2 else float("nan")
        out.append(
            f"| {st:<22} | {cls:<37} |"
            f"{l_t_gp3:>13.4f} |{K_l:>8.4f} |{l_t_io2:>12.4f} |"
            f" {d_t_gp3:>20.4f}   |"
            f" {d_t_io2:>18.4f}    |"
        )
    out.append("")
    return out


def main() -> int:
    lines: List[str] = []
    lines.append("# io2 prediction — full parameter trace")
    lines.append("")
    lines.append(
        "Документ для ручной проверки. Каждая строка таблицы соответствует одной "
        "паре (class × station) внутри `<parameter name=\"ServiceStrategy\">` секции "
        "`<section className=\"Server\">` JMT-модели (`.jsimg`). "
        "Значения λ читаются прямо из XML, демонтируются в service demand `S = 1000/λ` (ms)."
    )
    lines.append("")
    lines.append("Источник всех λ — каталог `calibrated_models/`. Скрипт извлечения — "
                 "`predict_io2_jmt.py:extract_lambdas`.")
    lines.append("")

    for variation in VARIATIONS:
        lines.append(f"## Variation: `{variation}`")
        lines.append("")

        m7i_gp3_path = SRC_DIR / f"M7i_gp3_{variation}.jsimg"
        m7i_io2_path = SRC_DIR / f"M7i_io2_{variation}.jsimg"
        if not m7i_gp3_path.exists() or not m7i_io2_path.exists():
            lines.append(f"*пропущено: нет файлов M7i_{{gp3,io2}}_{variation}.jsimg*")
            lines.append("")
            continue

        m7i_gp3 = extract_lambdas(m7i_gp3_path)
        m7i_io2 = extract_lambdas(m7i_io2_path)

        lines += section_lambdas(
            f"1. λ из `{m7i_gp3_path.name}`", m7i_gp3
        )
        lines += section_lambdas(
            f"2. λ из `{m7i_io2_path.name}`", m7i_io2
        )
        lines += section_K(
            "3. K-коэффициенты (контрольная пара M7i.gp3 ↔ M7i.io2)",
            m7i_gp3, m7i_io2,
        )

        for hw in GP3_TARGETS:
            target_path = SRC_DIR / f"{hw}_{variation}.jsimg"
            if not target_path.exists():
                continue
            target_gp3 = extract_lambdas(target_path)
            lines += section_lambdas(
                f"4.{hw}.a — λ из `{target_path.name}` (вход)", target_gp3
            )
            target_io2_name = hw.replace("gp3", "io2")
            lines += section_predicted(
                f"4.{hw}.b — предсказанные λ для `{target_io2_name}_{variation}.jsimg` (выход)",
                target_gp3, m7i_gp3, m7i_io2,
            )

        lines.append("---")
        lines.append("")

    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
