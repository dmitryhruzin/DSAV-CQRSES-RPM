<!-- markdownlint-disable MD013 MD024 MD040 -->

# JMT-prediction-v3 — три распределения + 10 s skip warm-up

## Что изменилось vs v2

Единственное логическое изменение: при парсинге каждого лог-файла находим `t0` = `startedAt` первого `http.request` спана, затем **игнорируем все спаны со `startedAt < t0 + 10000 ms`**. Это убирает warm-up период (cold-start, JIT-warmup, connection pool warm-up). Остальное (winsorized p95 mean, p98 variance, K_io2 scaling, 3 распределения Exp / HyperExp / Lognormal) идентично v2.

Measured baseline для MRE — из [apps/logs/analyz-10.md](apps/logs/analyz-10.md), также с 10 s skip.

## Sanity: CV² уменьшился

Per-(class, station) CV² (после p98 winsorisation) для M7i.gp3 seq:

| Class | Station | v2 CV² | v3 CV² |
|---|---|---:|---:|
| Stvor | AppService | 0.05 | 0.04 |
| Onovl | AppService | 0.07 | 0.06 |
| Onovl | SnapshotDB | 0.29 | 0.22 |
| RC | AppService | 0.20 | 0.17 |
| RC | ProjectionDB | 0.50 | 0.38 |
| Stvor | SnapshotDB (Classical) | 2.34 | 2.15 |

CV² ↓ → подтверждает, что 10 s skip действительно убирает cold-start outliers. HyperExp по-прежнему откатывается на Exp для большинства станций (CV² < 1.01).

## Predicted M7a.io2 (9 stats per class)

### mCQRS — Predicted (ms)

| Mode | Class | avg | med | p90 | p95 | min | max | range | var | std |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Exp | Q | 1.71 | 1.25 | 3.64 | 4.81 | 0.00 | 19.98 | 19.97 | 2.43 | 1.56 |
| Exp | Cr | 3.43 | 2.77 | 6.83 | 8.47 | 0.02 | 26.79 | 26.78 | 6.54 | 2.56 |
| Exp | Upd | 3.53 | 2.92 | 6.87 | 8.46 | 0.01 | 32.05 | 32.04 | 6.33 | 2.52 |
| Exp | RC | 2.86 | 2.33 | 5.68 | 7.03 | 0.00 | 25.27 | 25.27 | 4.59 | 2.14 |
| HE | Q | 1.72 | 1.26 | 3.63 | 4.79 | 0.00 | 21.79 | 21.79 | 2.43 | 1.56 |
| HE | Cr | 3.44 | 2.77 | 6.83 | 8.49 | 0.01 | 29.29 | 29.28 | 6.56 | 2.56 |
| HE | Upd | 3.53 | 2.92 | 6.87 | 8.44 | 0.03 | 27.41 | 27.38 | 6.33 | 2.52 |
| HE | RC | 2.85 | 2.32 | 5.68 | 7.05 | 0.00 | 22.62 | 22.62 | 4.59 | 2.14 |
| **LN** | Q | 1.43 | 1.13 | **2.58** | **3.20** | 0.33 | 12.48 | 12.15 | 0.75 | 0.87 |
| **LN** | Cr | 3.15 | 2.95 | **4.21** | **4.79** | 1.41 | 13.49 | 12.08 | 0.70 | 0.84 |
| **LN** | Upd | 3.25 | 3.07 | **4.37** | **4.94** | 1.18 | 14.85 | 13.66 | 0.79 | 0.89 |
| **LN** | RC | 2.57 | 2.33 | **4.09** | **4.75** | 0.33 | 15.06 | 14.73 | 1.32 | 1.15 |

### Classical CQRS — Predicted (ms)

| Mode | Class | avg | med | p90 | p95 | min | max | range | var | std |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Exp | Q | 1.27 | 1.02 | 2.52 | 3.17 | 0.00 | 14.15 | 14.15 | 0.96 | 0.98 |
| Exp | Cr | 2.39 | 1.99 | 4.60 | 5.64 | 0.02 | 24.63 | 24.62 | 2.82 | 1.68 |
| Exp | Upd | 3.13 | 2.75 | 5.64 | 6.76 | 0.02 | 23.31 | 23.29 | 3.58 | 1.89 |
| Exp | RC | 2.37 | 1.95 | 4.67 | 5.73 | 0.00 | 19.00 | 19.00 | 3.01 | 1.74 |
| HE | Q | 1.26 | 1.02 | 2.51 | 3.15 | 0.00 | 12.02 | 12.02 | 0.96 | 0.98 |
| HE | Cr | 2.39 | 1.99 | 4.60 | 5.65 | 0.01 | 20.82 | 20.80 | 2.82 | 1.68 |
| HE | Upd | 3.13 | 2.74 | 5.64 | 6.74 | 0.00 | 22.33 | 22.33 | 3.59 | 1.89 |
| HE | RC | 2.38 | 1.96 | 4.68 | 5.77 | 0.00 | 23.33 | 23.33 | 3.05 | 1.75 |
| **LN** | Q | 1.16 | 1.02 | **1.74** | **2.17** | 0.38 | 10.87 | 10.49 | 0.27 | 0.52 |
| **LN** | Cr | 2.09 | 1.92 | **2.90** | **3.32** | 0.91 | 12.04 | 11.13 | 0.39 | 0.62 |
| **LN** | Upd | 2.82 | 2.65 | **3.72** | **4.15** | 1.44 | 11.03 | 9.59 | 0.47 | 0.69 |
| **LN** | RC | 2.26 | 2.10 | **3.41** | **3.91** | 0.42 | 12.30 | 11.89 | 0.77 | 0.88 |

## Aggregate MRE (Q+Cr+Upd × обе вариации, abs)

| Mode | avg | median | p90 | p95 | min | max | range | var | std |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Exp | 25.3% | 28.9% | 54.2% | 47.3% | 99.0% | 33.1% | 31.4% | 22.5% | 10.5% |
| HyperExp | 25.2% | 28.8% | 53.9% | 47.0% | 99.1% | 37.6% | 36.1% | 22.5% | 10.5% |
| **Lognormal** | **13.8%** | 27.0% | **17.0%** | **22.7%** | 15.7% | 62.7% | 64.4% | 77.1% | 53.7% |

## v3 vs v2 — что изменилось

| Stat | Mode | v2 | v3 | Δ |
|---|---|---:|---:|---:|
| avg | Exp | 14.5% | 25.3% | +10.8 pp ❌ |
| avg | HE | 14.5% | 25.2% | +10.7 pp ❌ |
| avg | **LN** | 22.0% | **13.8%** | **−8.2 pp ✅** |
| median | Exp | 28.9% | 28.9% | ~0 |
| median | HE | 28.5% | 28.8% | +0.3 pp |
| median | LN | 26.6% | 27.0% | +0.4 pp |
| p90 | Exp | 47.2% | 54.2% | +7.0 pp ❌ |
| p90 | HE | 46.6% | 53.9% | +7.3 pp ❌ |
| p90 | **LN** | 19.0% | **17.0%** | **−2.0 pp ✅** |
| p95 | Exp | 32.3% | 47.3% | +15.0 pp ❌ |
| p95 | HE | 32.0% | 47.0% | +15.0 pp ❌ |
| p95 | **LN** | 26.9% | **22.7%** | **−4.2 pp ✅** |

## Интерпретация

**Lognormal: 10 s skip — стрикт-победа.** Avg MRE 22.0% → 13.8%, p90 19.0% → 17.0%, p95 26.9% → 22.7%. Чистая steady-state калибровка лучше для распределения с тяжёлым хвостом.

**Exp / HyperExp: MRE формально *выросла*.** Причина: 10 s skip убирает cold-start outliers из **measured baseline** (POST mCQRS avg 3.67→2.85, PATCH 4.21→3.12, GET 1.63→1.00). Калиброванные демандэ тоже падают, но не так сильно (винcoризация в v2 уже частично снимала cold-start). Итог: v2 Exp/HE **переоценивали** реальный отклик, и это переоценивание "маскировалось" cold-start хвостом в measured. v3 убирает маскировку → переоценивание проявляется чище.

То есть v3 не сделал Exp/HE хуже — он **показал их реальную ошибку**, которую v2 скрывал.

**Финальный вывод по выбору модели:**
- Calibration baseline должен быть **steady-state** (≥10 s skip) — иначе MRE искусственно занижен из-за сглаживания cold-start обоих сторон уравнения.
- **Lognormal** остаётся лучшим выбором для предсказания percentiles: MRE p90 = 17%, p95 = 23%.
- Min/max/var/std всё ещё плохие у LN (62–77% MRE) — это структурный лимит: реальный max содержит ~30–60 ms outliers, которые M/G/1 mixture не воспроизводит даже с lognormal-tail. Дальше нужна модификация топологии (single-thread event-loop bottleneck).

## Структура папки

```text
apps/JMT-prediction-v3/
├── extract_demands.py            # с 10s skip
├── compute_k.py
├── build_jsimg.py                # 3 distribution modes
├── run_simulations.py
├── analyze_results.py            # measured из analyz-10
├── demands.json                  # mean + var (post-skip)
├── analysis_v3.json              # полное ⟨pred, meas, MRE⟩
├── models_{exp,hyperexp,lognormal}/   # 8 .jsimg each
├── results_{exp,hyperexp,lognormal}/  # JMT result XMLs
├── jmt_logs/{exp,hyperexp,lognormal}/ # 300k-sample CSVs
└── run_summary_{exp,hyperexp,lognormal}.json
```

## Воспроизведение

```bash
cd apps/JMT-prediction-v3/
python3 extract_demands.py
python3 compute_k.py
python3 build_jsimg.py
python3 run_simulations.py --skip-baselines
python3 analyze_results.py
```
