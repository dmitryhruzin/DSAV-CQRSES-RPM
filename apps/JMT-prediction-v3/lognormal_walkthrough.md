<!-- markdownlint-disable MD013 MD024 MD040 -->

# Полный walkthrough: Lognormal предсказание M7a.io2 mCQRS

Детальный разбор пайплайна с конкретными цифрами на каждом этапе.

## Шаг 1. Per-span метрики из Sequential логов (после 10s skip)

Из каждого `*-seq.log` парсятся все спаны после `t0 + 10000ms`, где `t0` — `startedAt` первого `http.request`. Затем по спанам считается winsorized-p95 mean и winsorized-p98 variance.

Пример для **m7a-gp3-m_cqrs-seq.log** (после skip осталось 4035 запросов):

| Span | count | avg (raw) | avg (wins p95) | var (wins p98) |
|---|---:|---:|---:|---:|
| `command.execute` (POST) | 588 | 2.95 | 2.838 | 0.183 |
| `db.eventstore.write` (POST) | 588 | 0.291 | 0.256 | 0.0017 |
| `db.snapshot.write` (POST) | 588 | 0.396 | 0.336 | 0.046 |
| `event.handle` (POST) | 686 | 1.964 | 1.926 | 0.443 |
| `db.projection.write` (POST) | 686 | 1.179 | 1.140 | 0.115 |
| `http.request` (POST) | 588 | 3.012 | 2.901 | 0.156 |
| `command.execute` (PATCH) | 2061 | 3.064 | 2.917 | 0.061 |
| `db.eventstore.write` (PATCH) | 2061 | 0.222 | 0.182 | 0.0014 |
| `db.snapshot.read` (PATCH) | 2240 | 0.418 | 0.358 | 0.0066 |
| `db.snapshot.write` (PATCH) | 2061 | 0.428 | 0.366 | 0.012 |
| `event.handle` (PATCH) | 2255 | 12.18 (с tails) | 2.49 | 0.413 |
| `db.projection.read` (PATCH, merge by H) | 2255 | 0.456 | 0.405 | 0.018 |
| `db.projection.write` (PATCH) | 2255 | 0.288 | 0.245 | 0.0014 |
| `http.request` (PATCH) | 2061 | 3.171 | 3.039 | 0.087 |
| `query.execute` (GET) | 1287 | 1.014 | 0.957 | 0.011 |
| `db.projection.read` (GET, summed) | 1287 | 0.660 | 0.608 | 0.014 |
| `http.request` (GET) | 1287 | 1.085 | 1.024 | 0.013 |

И аналогично для всех 6 baseline-логов (m7i-gp3, m7i-io2, m7a-gp3 × mCQRS, classical).

## Шаг 2. Service demands per (class, station)

Из спанов агрегируются per-request totals по каждой станции с правилами привязки спанов к станции. Все значения — **средние per-request** в **миллисекундах**, и **variance per-request** в **ms²**.

### M7a.gp3 mCQRS (baseline для масштабирования)

| Class | Station | mean (ms) | var (ms²) | CV² |
|---|---|---:|---:|---:|
| **Zapyty** (GET) | AppService | 0.457 | 0.008 | 0.04 |
|  | ProjectionDB | 0.564 | 0.018 | 0.06 |
| **Stvor** (POST) | AppService | 2.153 | 0.047 | 0.01 |
|  | EventStore | 0.256 | 0.002 | 0.03 |
|  | SnapshotDB | 0.434 | 0.046 | 0.25 |
| **Onovl** (PATCH) | AppService | 2.039 | 0.154 | 0.04 |
|  | EventStore | 0.187 | 0.002 | 0.06 |
|  | SnapshotDB | 0.722 | 0.018 | 0.03 |
| **RC** (handler) | AppService | 1.577 | 0.443 | 0.18 |
|  | ProjectionDB | 0.713 | 0.239 | 0.47 |

Правила:

- `AppService_demand = http.request_avg − Σ(DB demands)` для request-классов.
- Для RC: `AppService = event.handle_avg − ProjectionDB`, `ProjectionDB = projection.read + projection.write`.

### M7i.gp3 mCQRS (для числителя K)

| Class | Station | mean (ms) |
|---|---|---:|
| Zapyty | AppService | 0.552 |
|  | ProjectionDB | 0.628 |
| Stvor | AppService | 2.323 |
|  | EventStore | 0.293 |
|  | SnapshotDB | 0.510 |
| Onovl | AppService | 2.297 |
|  | EventStore | 0.237 |
|  | SnapshotDB | 0.812 |
| RC | AppService | 1.825 |
|  | ProjectionDB | 0.842 |

### M7i.io2 mCQRS (для знаменателя K)

| Class | Station | mean (ms) |
|---|---|---:|
| Zapyty | AppService | 0.509 |
|  | ProjectionDB | 0.594 |
| Stvor | AppService | 1.876 |
|  | EventStore | 0.274 |
|  | SnapshotDB | 0.481 |
| Onovl | AppService | 1.854 |
|  | EventStore | 0.231 |
|  | SnapshotDB | 0.758 |
| RC | AppService | 1.486 |
|  | ProjectionDB | 0.705 |

## Шаг 3. K-коэффициенты (метод Brunnert)

Формула:

```text
K_op^io2 = S_op^{M7i, io2} / S_op^{M7i, gp3}
```

Применяется только для **DB-станций**. Для **AppService** K принудительно = 1.0 (CPU не масштабируется при смене диска).

| Class | Station | M7i.gp3 mean | M7i.io2 mean | K = io2/gp3 |
|---|---|---:|---:|---:|
| Zapyty | AppService | 0.552 | 0.509 | **1.000** (forced) |
|  | ProjectionDB | 0.628 | 0.594 | **0.9465** |
| Stvor | AppService | 2.323 | 1.876 | **1.000** (forced) |
|  | EventStore | 0.293 | 0.274 | **0.9335** |
|  | SnapshotDB | 0.510 | 0.481 | **0.9431** |
| Onovl | AppService | 2.297 | 1.854 | **1.000** (forced) |
|  | EventStore | 0.237 | 0.231 | **0.9734** |
|  | SnapshotDB | 0.812 | 0.758 | **0.9332** |
| RC | AppService | 1.825 | 1.486 | **1.000** (forced) |
|  | ProjectionDB | 0.842 | 0.705 | **0.8372** |

## Шаг 4. Применение K к M7a.gp3 → M7a.io2 predicted demands

```text
S^{M7a, io2}_op = S^{M7a, gp3}_op × K^io2_op
```

| Class | Station | M7a.gp3 mean | K | **M7a.io2 predicted mean** |
|---|---|---:|---:|---:|
| Zapyty | AppService | 0.457 | 1.000 | **0.457** |
|  | ProjectionDB | 0.564 | 0.9465 | **0.534** |
| Stvor | AppService | 2.153 | 1.000 | **2.153** |
|  | EventStore | 0.256 | 0.9335 | **0.239** |
|  | SnapshotDB | 0.434 | 0.9431 | **0.409** |
| Onovl | AppService | 2.039 | 1.000 | **2.039** |
|  | EventStore | 0.187 | 0.9734 | **0.182** |
|  | SnapshotDB | 0.722 | 0.9332 | **0.673** |
| RC | AppService | 1.577 | 1.000 | **1.577** |
|  | ProjectionDB | 0.713 | 0.8372 | **0.597** |

Variance масштабируется как **K²** (т.к. CV² сохраняется):

| Class | Station | var^{M7a.gp3} | K² | **var^{M7a.io2} predicted** |
|---|---|---:|---:|---:|
| Zapyty.ProjectionDB | | 0.018 | 0.896 | **0.0912** |
| Stvor.EventStore | | 0.002 | 0.872 | **0.0036** |
| Stvor.SnapshotDB | | 0.046 | 0.889 | **0.0859** |
| Onovl.EventStore | | 0.002 | 0.947 | **0.0025** |
| Onovl.SnapshotDB | | 0.018 | 0.871 | **0.0833** |
| RC.ProjectionDB | | 0.239 | 0.701 | **0.189** |

## Шаг 5. Lognormal-специфичная калибровка

В отличие от Exp (которая использует только mean → `λ = 1/mean`), Lognormal требует **двух параметров** μ и σ, фитуемых под (mean, variance).

**Формулы:**

```text
CV² = var / mean²
σ² = ln(1 + CV²)
σ = √σ²
μ = ln(mean) − σ²/2
```

В отличие от HyperExp, Lognormal **не требует CV² > 1** (работает для любого CV² > 0), поэтому fallback на Exp не происходит ни на одной станции.

**Capping:** CV² capped at 5, чтобы избежать вырожденных параметров при экстремальных хвостах. В нашем случае ни одна станция не имеет CV² > 1, так что капп не сработал.

**Единицы:** JMT внутренне использует **секунды**, поэтому mean конвертируется (ms → s = ÷1000), variance (ms² → s² = ÷10⁶).

### Параметры μ, σ для M7a.io2 mCQRS Lognormal

| Class | Station | mean_ms | var_ms² | CV² | mean_s | σ² | σ | μ |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Zapyty | AppService | 0.457 | 0.0088 | 0.042 | 0.000457 | 0.04120 | 0.20297 | **−7.71185** |
| Zapyty | ProjectionDB | 0.534 | 0.0912 | 0.320 | 0.000534 | 0.27774 | 0.52701 | **−7.67465** |
| Stvor | AppService | 2.153 | 0.1257 | 0.027 | 0.002153 | 0.02676 | 0.16360 | **−6.15430** |
| Stvor | EventStore | 0.239 | 0.0036 | 0.064 | 0.000239 | 0.06178 | 0.24855 | **−8.37159** |
| Stvor | SnapshotDB | 0.409 | 0.0859 | 0.514 | 0.000409 | 0.41443 | 0.64376 | **−8.00886** |
| Onovl | AppService | 2.039 | 0.2113 | 0.051 | 0.002039 | 0.04959 | 0.22269 | **−6.22017** |
| Onovl | EventStore | 0.182 | 0.0025 | 0.077 | 0.000182 | 0.07402 | 0.27206 | **−8.65049** |
| Onovl | SnapshotDB | 0.673 | 0.0833 | 0.184 | 0.000673 | 0.16869 | 0.41072 | **−7.38746** |
| RC | AppService | 1.577 | 0.5783 | 0.232 | 0.001577 | 0.20899 | 0.45715 | **−6.55646** |
| RC | ProjectionDB | 0.597 | 0.1890 | 0.530 | 0.000597 | 0.42510 | 0.65199 | **−7.63571** |

Эти (μ, σ) пары встроились в `.jsimg` XML примерно так:

```xml
<subParameter classPath="jmt.engine.random.Lognormal" name="Lognormal"/>
<subParameter classPath="jmt.engine.random.LognormalPar" name="distrPar">
  <subParameter classPath="java.lang.Double" name="mu"><value>-7.71185</value></subParameter>
  <subParameter classPath="java.lang.Double" name="sigma"><value>0.20297</value></subParameter>
</subParameter>
```

### Что специфично для LN (помимо μ/σ) vs Exp

1. **classPath** — `jmt.engine.random.Lognormal` (вместо `Exponential`).
2. **Параметризация двумя моментами** — нужна `variance` в `demands.json` (для Exp не нужна).
3. **Нет fallback** — Lognormal работает при любых CV², в отличие от HyperExp (CV² > 1).
4. **Variance скалируется K²** при применении прогноза, чтобы CV² оставался константой между gp3 и io2.
5. Класс JMT `jmt.engine.random.LognormalPar` — обнаружен через `javap` дизассемблирование JMT.jar (имена полей `mu`, `sigma` без логарифма базы).

## Шаг 6. JMT-симуляция

`.jsimg` файл: [models_lognormal/m7a-io2_m_cqrs_predicted.jsimg](models_lognormal/m7a-io2_m_cqrs_predicted.jsimg)

**Топология:** 5 станций (Старт RandomSource → Сервер AppService 2-server → EventStore / SnapshotDB / ProjectionDB → Стоп JobSink), 4 открытых класса.

**Источник заявок** — Exponential interarrival с λ:

- Запити (GET):  λ = 100/s
- Команди створення (POST): λ = 100/s
- Команди оновлення (PATCH): λ = 150/s
- Процеси досягнення узгодженості (RC): λ = 250/s

**Маршрутизация:**

- Q: Source → AppService → ProjectionDB → Sink
- POST: Source → AppService → EventStore → SnapshotDB → Sink
- PATCH: Source → AppService → EventStore → SnapshotDB → Sink
- RC: Source → AppService → ProjectionDB → Sink

**Performance Index:** Response Time per Sink с `verbose="true"` для дампа всех семплов в CSV.

**`maxSamples=300000`** per class, **`disableStatisticStop=true`** (чтобы JMT не остановилась досрочно по precision criterion).

Команда запуска:

```bash
java -cp "/Applications/Java Modelling Tools/JMT.jar" jmt.commandline.Jmt sim \
  models_lognormal/m7a-io2_m_cqrs_predicted.jsimg
```

Вывод: 4 CSV-файла (один на класс) в `jmt_logs/lognormal/m7a-io2_m_cqrs_predicted/`, каждый ≈300k строк `TIMESTAMP,SAMPLE,WEIGHT`.

## Шаг 7. Результаты симуляции (Lognormal predicted M7a.io2 mCQRS)

Из CSV-семплов считаются 9 статистик per class:

| Class | avg | median | p90 | p95 | min | max | range | var | std |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Q | 1.43 | 1.13 | 2.58 | 3.20 | 0.33 | 12.48 | 12.15 | 0.75 | 0.87 |
| Cr | 3.15 | 2.95 | 4.21 | 4.79 | 1.41 | 13.49 | 12.08 | 0.70 | 0.84 |
| Upd | 3.25 | 3.07 | 4.37 | 4.94 | 1.18 | 14.85 | 13.66 | 0.79 | 0.89 |
| RC | 2.57 | 2.33 | 4.09 | 4.75 | 0.33 | 15.06 | 14.73 | 1.32 | 1.15 |

## Шаг 8. MRE — расчёт ошибки

**Формула:**

```text
MRE_cell = |predicted − measured| / measured × 100%
```

**Measured baseline** — из [../logs/analyz-10.md](../logs/analyz-10.md) (M7a.io2 mCQRS Load, post-10s skip):

| Class | meas avg | meas med | meas p90 | meas p95 |
|---|---:|---:|---:|---:|
| Q (GET req) | 1.00 | 0.73 | 1.65 | 2.25 |
| Cr (POST req) | 2.85 | 2.29 | 4.34 | 5.65 |
| Upd (PATCH req) | 3.12 | 2.53 | 4.76 | 6.02 |

### Поячеечная MRE — M7a.io2 mCQRS Lognormal

| Class | Stat | pred | meas | MRE |
|---|---|---:|---:|---:|
| Q | avg | 1.43 | 1.00 | \|1.43−1.00\|/1.00 = **43.0%** |
| Q | med | 1.13 | 0.73 | **54.8%** |
| Q | p90 | 2.58 | 1.65 | **56.4%** |
| Q | p95 | 3.20 | 2.25 | **42.2%** |
| Cr | avg | 3.15 | 2.85 | **10.5%** |
| Cr | med | 2.95 | 2.29 | **28.8%** |
| Cr | p90 | 4.21 | 4.34 | **3.0%** |
| Cr | p95 | 4.79 | 5.65 | **15.2%** |
| Upd | avg | 3.25 | 3.12 | **4.2%** |
| Upd | med | 3.07 | 2.53 | **21.3%** |
| Upd | p90 | 4.37 | 4.76 | **8.2%** |
| Upd | p95 | 4.94 | 6.02 | **17.9%** |

### Aggregate MRE — Lognormal по обеим вариациям

Берём Q + Cr + Upd × (mCQRS + Classical) = 6 точек на статистику, усредняем:

| Stat | mean abs MRE |
|---|---:|
| avg | **13.8%** |
| median | 27.0% |
| **p90** | **17.0%** |
| **p95** | **22.7%** |

## Сводка

| Этап | Что вход | Что выход |
|---|---|---|
| 1. Парсинг логов | sequential logs (после 10s skip) | per-span dictionary с avg + var |
| 2. Сборка demands | per-span данные | (mean, var) per (class, station) |
| 3. K-коэффициенты | demands M7i.gp3 и M7i.io2 | K_op^io2 для DB станций |
| 4. Прогнозные demands | M7a.gp3 demands × K | M7a.io2 predicted (mean+var) |
| 5. LN параметризация | (mean, var) per station | (μ, σ) для каждого `<Lognormal>` блока в jsimg |
| 6. JMT симуляция | 8 `.jsimg`, открытые классы λ=100/100/150/250 /s | CSV семплов response time |
| 7. Стат-обработка | CSV (300k семплов на класс) | avg/med/p90/p95/min/max/range/var/std |
| 8. MRE | predicted + measured | per-cell MRE и aggregate |

Все артефакты:

- [demands.json](demands.json) — шаги 1-2
- [K_io2.json](K_io2.json) — шаг 3
- [predicted_demands_m_cqrs.json](predicted_demands_m_cqrs.json) — шаг 4
- [models_lognormal/m7a-io2_m_cqrs_predicted.jsimg](models_lognormal/m7a-io2_m_cqrs_predicted.jsimg) — шаг 5
- `jmt_logs/lognormal/m7a-io2_m_cqrs_predicted/*.csv` — шаги 6-7
- [analysis_v3.json](analysis_v3.json) — шаг 8
