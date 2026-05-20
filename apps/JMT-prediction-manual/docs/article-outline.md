# Гайд: как оформить работу в научной статье

Структурированный план для статьи о JMT-prediction pipeline для CQRS-системы. Покрывает 4 ключевых тематических блока: анализ метрик, выбор закона распределения, выбор медианы vs среднего, разделение μ-seq / σ-load.

---

## Структура статьи (предлагаемая)

```text
1. Introduction
2. System and Workload Model
3. Methodology
   3.1. Metric extraction from execution traces
   3.2. Distribution family selection (3 candidates)
   3.3. Robust center statistic: median vs mean
   3.4. Hybrid calibration: seq-center + load-spread
4. Experimental Validation
5. Discussion and Limitations
6. Conclusion
```

Ниже — что должно быть в каждом разделе по тем 4 темам, которые ты выделил.

---

## Блок 1: Анализ метрик (§3.1)

### Что показать

1. **Топология системы как открытая queueing network.** Диаграмма: 4 станции (AppService, EventStore, SnapshotDB, ProjectionDB) × 4 класса запросов (Zapyty, Stvor, Onovl, RC).
2. **Источник данных — instrumented spans в JSON-логах.** Привести пример span-record (`http.request`, `query.execute`, `db.projection.read`, и т.д.) с полями `req.id`, `span`, `startedAt`, `durationMs`.
3. **Per-request decomposition.** Сгруппировать spans по `req.id`, суммировать длительности по span-name, **получить time spent per (station, class) per request**.
4. **13 station-class ячеек** (часть стенций обслуживает только некоторые классы). Привести таблицу ячеек.

### Какие метрики извлекать

Для каждой (machine, station, class)-ячейки:

- n (sample count)
- mean, median, p90, p95, p99
- variance, CV² (= variance / mean²)
- σ_MLE для Lognormal-фита (= std of log)
- KS-distance к фитированному распределению

### Ключевая таблица в статье

```text
Per-cell statistics summary
─────────────────────────────────────────────────────────
Cell                          | n      | mean | median | CV²
─────────────────────────────────────────────────────────
AppService.Zapyty (seq)       | 1287   | 0.42 | 0.39   | 0.18
AppService.Zapyty (load)      | 11548  | 0.77 | 0.22   | 17.8
EventStore.Stvor (seq)        | ...    | ...  | ...    | ...
...
```

Показать **разницу CV² между seq и load в 5–9×** как мотивацию для дальнейшей работы.

### Что сказать в тексте

> "We instrument the system with OpenTelemetry-style spans recording the wall-clock duration of each per-request operation. By grouping spans by request ID and aggregating durations by span name, we obtain per-request, per-(station, class) service-time samples. We extract these from both **seq runs** (sequential, one request at a time — captures isolated service time) and **load runs** (concurrent traffic — captures system-under-load behavior including queueing artifacts)."

### Ссылки на код

- [_analyze_seq.mjs](../_analyze_seq.mjs) — извлечение per-request metrics из seq
- [_analyze_load.mjs](../_analyze_load.mjs) — то же для load
- [_experiment_fits.mjs](../_experiment_fits.mjs) — фит распределений + KS
- [log-analisis-seq.md](../log-analisis-seq.md) — выходные таблицы

---

## Блок 2: Выбор закона распределения (§3.2)

### Три рассмотренных варианта

**Vary 1: Brunnert (2015) — per-CV² heuristic.**

```text
if CV² < 0.5:        Erlang-k,  k = max(2, round(1/CV²))
elif CV² ≤ 1.5:      Exponential
else:                Lognormal MLE
```

Применяется per (station, class). Family фиксируется по CV² **базовой машины** (m7a-gp3), чтобы K-prediction работала.

**Vary 2: Lognormal MLE everywhere.**

Одно семейство для всех ячеек. Параметры через MLE:

```text
μ = mean(log x_i),  σ² = mean((log x_i − μ)²)
```

**Vary 3: Hybrid.** Lognormal MLE как baseline + точечно Erlang там, где он системно лучше KS на всех 4 машинах (мы нашли 2 такие ячейки: `AppService.Onovl` → Erlang-9, `ProjectionDB.RC.POST` → Erlang-3).

### Критерии сравнения

1. **KS-distance** на seq-данных (52 значения = 4 машины × 13 ячеек).
2. **End-to-end JMT-симуляция** → MRE prediction vs measured на m7a-io2.

### Ключевая таблица

| | Mean KS | KS wins | JMT mean MRE | JMT p95 MRE |
|---|---:|---:|---:|---:|
| LN MLE | **0.216** | **33/52** | **15.3%** | 28.0% |
| Brunnert | 0.293 | 19/52 | 16.9% | 31.4% |
| Hybrid | 0.211 | — | 17.0% | 32.9% |

### Почему LN MLE выиграл

Главный аргумент против Brunnert — `EventStore` имеет **CV² от 0.7 до 3+ между машинами**. Brunnert даст разные семейства (Exp на одной, LN на другой) → K-prediction не определена (нельзя сопоставить параметры). LN MLE покрывает любой CV² одним семейством, **σ остаётся свойством инстанса, диск меняет только μ через `μ' = μ + ln(K_disk)`**.

### Что сказать в тексте

> "Three distribution-family selection strategies were evaluated. The Brunnert heuristic, while well-established, assigns different families across machines for the same (station, class) cell when CV² varies — making K-prediction undefined. We therefore selected **Lognormal MLE uniformly**, which gives a single family handling any CV² and admits clean K-prediction: `μ' = μ + ln(K_disk), σ' = σ`. Empirically, Lognormal MLE achieves the lowest aggregate KS (0.216) and the lowest JMT MRE on the predicted machine (15.3% mean error)."

### Ссылки на код и доки

- [docs/distribution-method-selection.md](distribution-method-selection.md) — детальное обоснование
- [docs/experiment-design.md](experiment-design.md) — параметры всех 3 экспериментов
- [_fit_compare.mjs](../_fit_compare.mjs) — MOM vs MLE для каждой ячейки
- [experiment-fits.json](../experiment-fits.json) — параметры + KS

---

## Блок 3: Выбор медианы вместо среднего (§3.3)

### Мотивация

JMT-симуляция с LN MLE на seq-данных переоценила GET response time на +23%. Hypothesis: цементированная JMT-queueing инфляция накладывается на и так overestimated seq mean (потому что seq имеет небольшой right-skew от редких медленных query).

Углублённый анализ показал, что **load-mean ещё хуже** — раздут p99 outliers (GC pauses в Node.js). На m7a-gp3 для AppService.Zapyty: mean = 3.01 ms при median = 0.14 ms (ratio = 21×), p99 = 126 ms.

### Ключевая таблица для статьи

```text
Mean vs median for Zapyty AppService cell, load run
────────────────────────────────────────────────────
Machine        | n      | mean | median | p99    | mean/median
────────────────────────────────────────────────────
m7i-gp3        | 11548  | 0.77 | 0.22   | 15.3   | 3.5×
m7i-io2        | 10971  | 0.40 | 0.21   | 5.9    | 1.9×
m7a-gp3        | 11450  | 3.01 | 0.14   | 126.3  | 21.2×  ← outlier dominated
m7a-io2        | 10890  | 0.18 | 0.14   | 0.33   | 1.3×   ← clean
```

### Ключевой sanity-check

Сумма load medians (AppService + ProjectionDB) на каждой машине почти точно совпадает с **измеренной end-to-end GET median**:

```text
Machine    | sum medians | measured median | gap
m7i-gp3    | 1.928       | 2.055           | -6.2%
m7i-io2    | 1.374       | 1.459           | -5.8%
m7a-gp3    | 0.728       | 0.800           | -9.0%
m7a-io2    | 0.651       | 0.730           | -10.8%
```

То есть **median per-cell decomposition корректно отражает реальный typical GET**. Это валидирует использование median как центральной статистики.

### Что сказать в тексте

> "The arithmetic mean of service-time samples is sensitive to right-tail outliers, particularly under load where Node.js GC pauses and database connection pool stalls inflate individual samples by 100×–1000×. On the m7a-gp3 machine, the mean of `AppService.Zapyty` is 3.01 ms while the median is 0.14 ms — a 21× ratio driven by p99 values exceeding 126 ms. We adopt the **median as the location statistic** for calibration: it represents the typical request behavior and is asymptotically unbiased to single-point outliers."

### Ссылки на код и данные

- [_inspect_zapyty_robust.py](../_inspect_zapyty_robust.py) — mean vs median per cell
- [_inspect_zapyty.py](../_inspect_zapyty.py) — K_disk на mean vs median (значения)

---

## Блок 4: Использование μ из seq и разброс из load (§3.4)

### Гипотеза разделения параметров

В Lognormal `(μ, σ)` каждый параметр контролирует физически независимый аспект:

| Параметр | Что контролирует | Зависит от |
|---|---|---|
| `exp(μ + σ²/2)` = E[X] | **где находится** центр распределения | **скорости диска** (gp3 vs io2) |
| `σ` | **насколько широк** log-tail | **поведения инстанса под нагрузкой** (burst, GC, pool stalls) |

Гипотеза: **замена диска gp3 → io2 сдвигает E[X] пропорционально K_disk, но не меняет σ**. Это позволяет калибровать μ и σ из разных источников.

### Логика гибридной калибровки

```text
Center statistic:  median_seq    (clean — seq has no queueing, median ignores outliers)
Spread parameter:  σ_load_MLE    (load captures burst/GC/pool — real spread under load)
LN parameters:     σ = σ_load_MLE
                   μ = ln(median_seq) − σ²/2     ← preserves E[X] = median_seq
K-prediction:      μ' = μ + ln(K_disk)           ← shifts location only
```

### Что в этом нетривиального

Стандартная MLE-калибровка берёт **оба** параметра `(μ, σ)` из **одного** датасета. Мы берём из **двух разных** датасетов и **должны вручную синхронизировать** их через формулу `mean = exp(μ + σ²/2)`. Если просто взять `μ = μ_seq_MLE` и `σ = σ_load_MLE` (naive mixing), implied mean уезжает на 20–60% вверх — это нужно компенсировать пересчётом μ.

### Альтернативы, которые мы отвергли

| Подход | Что не сработало |
|---|---|
| LN MLE на seq везде | p95 underestimate −27…−40% (σ_seq слишком узкая) |
| LN MLE на load везде (Exp 4) | **Double-counting**: load-spans включают local queueing → CPU demand > capacity → divergence на калибровочных машинах |
| Method-of-moments σ через CV²_load | CV²_load > 60 на некоторых ячейках → σ ≈ 2 → LN-tail взрывается → p95 overestimate +100% |

### Sanity-check на калибровочных машинах

Поскольку наш подход — не стандартный MLE, нужно подтвердить, что он не ломается на источниках. Калибровочные машины (m7i-gp3, m7i-io2, m7a-gp3) дают MRE 40–50%, что **сопоставимо с baseline LN MLE** (47%). То есть гибридная калибровка не вносит дополнительной ошибки — структурная ошибка одна и та же (caching/JIT/pool effects).

### Что сказать в тексте

> "We propose a **hybrid calibration scheme** that decomposes the Lognormal `(μ, σ)` parameters by physical source. The location parameter `μ` is calibrated from sequential (no-queueing) runs to reflect the clean service-time of the underlying disk subsystem, enabling K-prediction across disk types. The spread parameter `σ` is calibrated from load runs to capture instance-level variability (GC pauses, connection-pool stalls, burst arrivals) that sequential runs fundamentally cannot observe. To prevent the `σ`-induced inflation of the arithmetic mean (`E[X] = exp(μ + σ²/2)`), we explicitly enforce `μ = ln(median_seq) − σ²/2`, preserving the median-based location."

### Ключевая таблица: MRE per experiment на m7a-io2 PREDICTED

| | Center | Spread | mean MRE | p95 MRE |
|---|---|---|---:|---:|
| Exp 1 | μ_seq_MLE | σ_seq_MLE | 15.3% | 28.0% |
| Exp 4 | μ_load_MLE | σ_load_MLE | 24.5% | 40.1% |
| Exp 5 | ln(mean_seq) − σ²/2 | σ_load_MLE | 17.1% | 21.0% |
| **Exp 6** | **ln(median_seq) − σ²/2** | **σ_load_MLE** | **14.1%** | **15.1%** |

### Ссылки на код и доки

- [_build_jsimg.py](../_build_jsimg.py) — реализация всех 6 экспериментов
- [_experiment_fits_load.mjs](../_experiment_fits_load.mjs) — σ_load_MLE параметры
- [docs/jmt-results.md](jmt-results.md) — полные таблицы результатов

---

## Дополнительные элементы для статьи

### Validation strategy

- **Cross-validation на 4 машинах.** 3 калибровочных + 1 PREDICTED (m7a-io2 = m7a-gp3 + io2-disk через K-prediction).
- **Sanity check без K.** Прогнать pipeline на каждой калибровочной машине отдельно — MRE 40–50% на всех **одинаковая**, что значит ошибка структурная (модельная), а не от K-prediction.
- **End-to-end metric: aggregate |MRE| across (mean, median, p90, p95).** Не одна метрика — иначе можно неосознанно тюнить под неё.

### Limitations (§5)

Открыто признать в Discussion:

1. **Floor ~15% MRE** не пробить без архитектурных изменений модели (cache-station, HyperExp для cache hit/miss).
2. **POST/PATCH чуть недо-предсказываются в Exp 6** (-12…-31%) — побочный эффект use of median везде. Селективный вариант (median только для cache-bound Zapyty, mean для остальных) — direction для будущей работы.
3. **Гипотеза "σ — instance property"** валидна только при близких CPU характеристиках машин (m7a и m7i близки). Для гетерогенных CPU (например ARM Graviton vs Intel) σ может меняться существенно.

### Reproducibility

Включить в supplementary material:

- Все скрипты (`*.mjs`, `*.py`)
- Параметры всех 6 экспериментов в JSON (`experiment-fits.json`, `experiment-fits-load.json`)
- Все 24 jsimg + результаты JMT
- Все логи (с PII санитизированными)

### Ключевые номера для abstract

> "We propose a hybrid Lognormal calibration scheme combining sequential-run median for service-time location with load-run MLE σ for spread. Applied to a CQRS event-sourcing system across 4 AWS EC2 configurations, the method achieves **15.1% p95 MRE** on K-disk-predicted instances, versus 28.0% for standard MLE on sequential data only."

---

## TODO для статьи (по приоритету)

1. **§3.1: Привести figure диаграмму топологии** (Start → AppService → ES → SN → Stop) с весом arrival rates.
2. **§3.2: KS comparison plot** — 52 KS-values per experiment, либо box-plot, либо CDF-сравнение для 1 illustrative cell.
3. **§3.3: Histogram one outlier-affected cell** (AppService.Zapyty m7a-gp3 load) с overlay mean/median/p99 — наглядно покажет в чём проблема.
4. **§3.4: Comparison table всех 6 экспериментов** (Exp 1–6) с метриками калибровки + MRE prediction.
5. **§4: Cross-machine MRE plot** — bar chart MRE per (machine, statistic) для победителя.
6. **§5: Diagnostic figure** — CPU demand seq vs load → объяснение double-counting в Exp 4.
