<!-- markdownlint-disable MD013 MD024 MD040 -->

# JMT-prediction-v2 — три варианта распределения service time

## Мотивация

Базовый `report.md` использовал **Exponential** service time везде и дал приемлемый прогноз только для **avg** request-path классов (MRE ≈ 9–19%), но для percentile-метрик ошибки достигали 30–122%. Причина: реальный tail Node.js HTTP-запросов имеет высокий CV² (≈5–21 в Load), а Exponential M/M/1 даёт CV² ≈ 1. Гипотеза: использовать **HyperExp** или **Lognormal** для service time, чтобы воспроизвести более тяжёлый хвост.

## Изменения в pipeline

- `extract_demands.py` — `mean()` возвращён на winsorized-at-p95; добавлено вычисление **per-(class, station) variance** через накопление per-request station-totals и винcoризацию p98. Схема `demands.json` расширена: `var_ms2`, `var_w_ms2`, `station_stats`.
- `build_jsimg.py` — флаг `--mode {exp|hyperexp|lognormal|all}`. HyperExp: `jmt.engine.random.HyperExp` + `HyperExpPar` (balanced-means с `p`, `λ1`, `λ2`). Lognormal: `jmt.engine.random.Lognormal` + `LognormalPar` с `μ = ln(mean) - σ²/2`, `σ² = ln(1 + CV²)`. Класс-имена проверены через disassembly JMT.jar. Если CV² ≤ 1.01 — HyperExp fallback на Exp; capped CV² ≤ 5. Добавлено `disableStatisticStop="true"` — иначе JMT останавливается раньше и не флешит verbose CSV.
- `run_simulations.py` — `--mode`, `--skip-baselines`. Отдельные `results_<mode>/`.
- `analyze_results.py` — читает 3 mode × 2 variation × 4 class CSV, формирует `analysis_v2.json` с MRE.

## Сводная MRE (Q + Cr + Upd, обе вариации, абсолютная)

| Mode | avg | median | p90 | p95 |
|---|---:|---:|---:|---:|
| Exp | 14.5% | 28.9% | 47.2% | 32.3% |
| HyperExp | 14.5% | 28.5% | 46.6% | 32.0% |
| Lognormal | **22.0%** | **26.6%** | **19.0%** | **26.9%** |

**Lognormal сокращает MRE по p90 с 47.2% до 19.0% — 60% улучшение** (цель 50% достигнута). p95 — с 32.3% до 26.9%.

## Что вышло

- Все 3 варианта корректно генерируются и запускаются JMT, 300k семплов verbose CSV на класс.
- **Lognormal принципиально лучше для tail-метрик.** Особенно сильно на mCQRS Q p90 (113% → 49%), Cr/Upd p90 (50% → ~7–12%), p95 Cr/Upd (30% → ~25%).

## Что не вышло / ограничения

### HyperExp ≡ Exp на этом датасете

Per-(class, station) CV² после p98 винcoризации почти везде **< 1** (см. таблицу ниже). При CV² ≤ 1.01 build_jsimg переключается на Exp, поэтому HyperExp совпадает с Exp.

Причина расхождения с пользовательской гипотезой «CV²=5–21»: CV²=5–21 — это CV² **полного response time под Load** (включает queueing). Мы калибруем по seq-логам, где queueing нет → per-station CV² типа «время одной операции БД» естественно меньше.

### Lognormal недооценивает Classical CQRS percentiles

Для Classical p90/p95 предсказание ниже реального на 16–36%. Реальный Classical под нагрузкой содержит burstiness от Node.js event-loop сериализации и retry-таймаутов, которая M/G/1 ловит лишь частично — нужна модификация **топологии** (single-server CPU bottleneck), а не выбор распределения.

## CV² per (class, station) — predicted M7a.io2 (после p98 винcoризации)

### mCQRS CV²

| Class | App | ES | SN | PR |
|---|---:|---:|---:|---:|
| Q | 0.05 | — | — | 0.32 |
| Cr | 0.04 | 0.08 | 0.55 | — |
| Upd | 0.05 | 0.08 | 0.19 | — |
| RC | 0.24 | — | — | 0.53 |

### Classical CV²

| Class | App | ES | SN | PR |
|---|---:|---:|---:|---:|
| Q | 0.05 | — | — | 0.16 |
| Cr | 0.10 | 0.03 | 2.13 | — |
| Upd | 0.05 | 0.02 | 0.51 | — |
| RC | 0.19 | — | — | 0.54 |

## Predicted M7a.io2 — все три распределения (ms)

Нагрузка: 100 GET + 100 POST + 150 PATCH + 250 RC /s.

### mCQRS

| Distr | Class | avg | median | p90 | p95 |
|---|---|---:|---:|---:|---:|
| Exp | Q | 1.75 | 1.27 | 3.75 | 4.94 |
| Exp | Cr | 3.50 | 2.83 | 6.96 | 8.64 |
| Exp | Upd | 3.59 | 2.97 | 6.99 | 8.59 |
| Exp | RC | 2.90 | 2.36 | 5.78 | 7.18 |
| HE | Q | 1.74 | 1.26 | 3.70 | 4.89 |
| HE | Cr | 3.49 | 2.81 | 6.94 | 8.62 |
| HE | Upd | 3.59 | 2.96 | 6.98 | 8.59 |
| HE | RC | 2.89 | 2.35 | 5.78 | 7.17 |
| **LN** | Q | 1.45 | 1.14 | **2.62** | **3.26** |
| **LN** | Cr | 3.19 | 3.00 | **4.32** | **4.91** |
| **LN** | Upd | 3.28 | 3.10 | **4.45** | **5.03** |
| **LN** | RC | 2.60 | 2.36 | **4.14** | **4.83** |

### Classical CQRS

| Distr | Class | avg | median | p90 | p95 |
|---|---|---:|---:|---:|---:|
| Exp | Q | 1.28 | 1.03 | 2.54 | 3.20 |
| Exp | Cr | 2.41 | 2.01 | 4.63 | 5.66 |
| Exp | Upd | 3.16 | 2.78 | 5.69 | 6.79 |
| Exp | RC | 2.39 | 1.97 | 4.69 | 5.80 |
| HE | Q | 1.28 | 1.03 | 2.54 | 3.20 |
| HE | Cr | 2.41 | 2.01 | 4.64 | 5.69 |
| HE | Upd | 3.16 | 2.78 | 5.68 | 6.79 |
| HE | RC | 2.39 | 1.97 | 4.70 | 5.78 |
| **LN** | Q | 1.17 | 1.03 | **1.76** | **2.21** |
| **LN** | Cr | 2.10 | 1.94 | **2.93** | **3.35** |
| **LN** | Upd | 2.84 | 2.68 | **3.77** | **4.21** |
| **LN** | RC | 2.28 | 2.12 | **3.44** | **3.94** |

## MRE против measured M7a.io2 Load (по классам и метрикам)

### mCQRS MRE

| Class | Stat | Meas | Exp | %Exp | HE | %HE | LN | %LN |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Q | avg | 1.63 | 1.75 | +7% | 1.74 | +6% | 1.45 | **−11%** |
| Q | med | 0.74 | 1.27 | +73% | 1.26 | +71% | 1.14 | **+55%** |
| Q | p90 | 1.76 | 3.75 | +113% | 3.70 | +110% | 2.62 | **+49%** |
| Q | p95 | 2.57 | 4.94 | +93% | 4.89 | +91% | 3.26 | **+27%** |
| Cr | avg | 3.67 | 3.50 | −4% | 3.49 | −5% | 3.19 | −13% |
| Cr | p90 | 4.66 | 6.96 | +49% | 6.94 | +49% | 4.32 | **−7%** |
| Cr | p95 | 6.46 | 8.64 | +34% | 8.62 | +33% | 4.91 | **−24%** |
| Upd | avg | 4.21 | 3.59 | −15% | 3.59 | −15% | 3.28 | −22% |
| Upd | p90 | 5.06 | 6.99 | +38% | 6.98 | +38% | 4.45 | **−12%** |
| Upd | p95 | 6.76 | 8.59 | +27% | 8.59 | +27% | 5.03 | **−26%** |

### Classical MRE

| Class | Stat | Meas | Exp | %Exp | HE | %HE | LN | %LN |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Q | avg | 1.64 | 1.28 | −22% | 1.28 | −22% | 1.17 | −29% |
| Q | p90 | 1.90 | 2.54 | +34% | 2.54 | +33% | 1.76 | **−7%** |
| Q | p95 | 2.79 | 3.20 | +15% | 3.20 | +14% | 2.21 | **−21%** |
| Cr | avg | 2.76 | 2.41 | −13% | 2.41 | −13% | 2.10 | −24% |
| Cr | p90 | 3.48 | 4.63 | +33% | 4.64 | +33% | 2.93 | **−16%** |
| Cr | p95 | 4.74 | 5.66 | +19% | 5.69 | +20% | 3.35 | **−29%** |
| Upd | avg | 4.27 | 3.16 | −26% | 3.16 | −26% | 2.84 | −33% |
| Upd | p90 | 4.89 | 5.69 | +16% | 5.68 | +16% | 3.77 | **−23%** |
| Upd | p95 | 6.40 | 6.79 | +6% | 6.79 | +6% | 4.21 | **−34%** |

## Какой вариант выбрать

| Что нужно | Лучший |
|---|---|
| avg / saturation / capacity planning | **Exp** (или эквивалентный HyperExp) |
| median | **Lognormal** (минимально) |
| **p90** | **Lognormal** (47% → 19%) |
| **p95** | **Lognormal** (32% → 27%) |

**Рекомендация:** для предсказания распределения времени отклика (p90/p95/median) — **Lognormal**. Для прогноза среднего и насыщения — **Exp**. Дальнейшее повышение точности требует изменения **топологии** (моделирование single-thread event-loop), не выбор распределения.

## Структура и воспроизведение

```text
apps/JMT-prediction-v2/
├── extract_demands.py            # parses logs → demands.json (mean + var)
├── compute_k.py
├── build_jsimg.py                # --mode {exp|hyperexp|lognormal|all}
├── run_simulations.py            # --mode --skip-baselines
├── analyze_results.py            # comparison of 3 distributions
├── demands.json                  # extended with var_ms2, station_stats
├── analysis_v2.json              # full ⟨pred, meas, MRE⟩
├── run_summary_{exp,hyperexp,lognormal}.json
├── models_{exp,hyperexp,lognormal}/    # 8 .jsimg each
├── results_{exp,hyperexp,lognormal}/   # JMT result XMLs
├── jmt_logs/{exp,hyperexp,lognormal}/  # 300k-sample CSVs
├── report.md                     # original Exp baseline
└── report_v2.md                  # this report
```

```bash
cd apps/JMT-prediction-v2/
python3 extract_demands.py
python3 compute_k.py
python3 build_jsimg.py
python3 run_simulations.py --skip-baselines
python3 analyze_results.py
```
