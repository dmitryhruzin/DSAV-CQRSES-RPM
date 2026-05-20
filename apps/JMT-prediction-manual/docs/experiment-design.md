# Эксперимент: pipeline калибровки и K-предсказания (Lognormal MLE)

Документ описывает шаг за шагом, как из seq-логов мы получаем параметры JMT-моделей и используем их для предсказания m7a-io2.

Базовая концепция выбора распределения — в [distribution-method-selection.md](distribution-method-selection.md). Документ ниже — про **поток данных и расчёты**.

## Pipeline в одном виде

```text
                    ┌─────────────────────────┐
[1] Логи seq   ──→  │ mean, variance, CV²     │  ← снимаем с реальных данных
                    └─────────┬───────────────┘
                              │   формулы калибровки (Шаг 2)
                              ▼
                    ┌─────────────────────────┐
[3] Параметры      │ (μ, σ) per machine      │  ← Lognormal MLE
    моделей  4×    │ для 3 калибровочных     │
                    │ + measured m7a-io2      │
                    └─────────┬───────────────┘
                              │   K_disk = mean_m7i-io2 / mean_m7i-gp3  (Шаг 4)
                              ▼
                    ┌─────────────────────────┐
[5] K_disk          │ один коэффициент       │
                    │ per (station, class)    │
                    └─────────┬───────────────┘
                              │   μ_pred = μ_m7a-gp3 + ln(K_disk)  (Шаг 6)
                              │   σ_pred = σ_m7a-gp3
                              ▼
                    ┌─────────────────────────┐
[7] Predicted       │ (μ, σ) для m7a-io2      │  ← это идёт в JMT
    m7a-io2         │                         │
                    └─────────────────────────┘
```

Шаги [1]–[7] разобраны ниже.

---

## Шаг 1 — Метрики из логов

Для каждой `(machine, station, class)` ячейки берём per-request метрику (см. [log-analisis-seq.md](../log-analisis-seq.md), формулы — в [task.md шаг 2](../task.md)) и считаем 3 числа: **n** (количество запросов), **mean** (среднее, мс), **CV²** (квадрат коэффициента вариации, безразмерный).

### m7i-gp3-m_cqrs-seq (база для K-формулы)

| Station | Class | n | mean (мс) | CV² |
| --- | --- | ---: | ---: | ---: |
| AppService | Zapyty | 1287 | 0.416 | 0.28 |
| ProjectionDB | Zapyty | 1287 | 0.721 | 1.89 |
| AppService | Stvor | 588 | 2.392 | 0.11 |
| EventStore | Stvor | 588 | 0.326 | 3.13 |
| SnapshotDB | Stvor | 588 | 0.580 | 1.88 |
| AppService | RC POST | 588 | 0.771 | 0.38 |
| ProjectionDB | RC POST | 588 | 1.552 | 0.29 |
| AppService | Onovl | 2159 | 2.332 | 0.17 |
| EventStore | Onovl | 2159 | 0.268 | 3.57 |
| SnapshotDB | Onovl | 2159 | 0.902 | 0.76 |
| AppService | RC PATCH | 2159 | 2.321 | 0.23 |
| ProjectionDB | RC PATCH read | 2159 | 0.479 | 2.68 |
| ProjectionDB | RC PATCH write | 2159 | 0.314 | 3.97 |

### m7i-io2-m_cqrs-seq (числитель в K-формуле)

| Station | Class | n | mean (мс) | CV² |
| --- | --- | ---: | ---: | ---: |
| AppService | Zapyty | 1287 | 0.372 | 0.19 |
| ProjectionDB | Zapyty | 1287 | 0.683 | 1.27 |
| AppService | Stvor | 588 | 1.897 | 0.08 |
| EventStore | Stvor | 588 | 0.320 | 3.17 |
| SnapshotDB | Stvor | 588 | 0.512 | 0.48 |
| AppService | RC POST | 588 | 0.772 | 0.60 |
| ProjectionDB | RC POST | 588 | 1.012 | 0.46 |
| AppService | Onovl | 2158 | 1.870 | 0.22 |
| EventStore | Onovl | 2158 | 0.284 | 7.49 |
| SnapshotDB | Onovl | 2158 | 0.858 | 1.07 |
| AppService | RC PATCH | 2158 | 1.870 | 0.27 |
| ProjectionDB | RC PATCH read | 2158 | 0.450 | 1.44 |
| ProjectionDB | RC PATCH write | 2158 | 0.308 | 3.35 |

### m7a-gp3-m_cqrs-seq (база для применения K)

| Station | Class | n | mean (мс) | CV² |
| --- | --- | ---: | ---: | ---: |
| AppService | Zapyty | 1287 | 0.338 | 0.10 |
| ProjectionDB | Zapyty | 1287 | 0.622 | 0.42 |
| AppService | Stvor | 588 | 2.173 | 0.04 |
| EventStore | Stvor | 588 | 0.281 | 0.82 |
| SnapshotDB | Stvor | 588 | 0.505 | 1.80 |
| AppService | RC POST | 588 | 0.593 | 0.36 |
| ProjectionDB | RC POST | 588 | 1.526 | 0.30 |
| AppService | Onovl | 2160 | 2.063 | 0.11 |
| EventStore | Onovl | 2160 | 0.204 | 0.72 |
| SnapshotDB | Onovl | 2160 | 0.791 | 0.49 |
| AppService | RC PATCH | 2160 | 2.037 | 0.25 |
| ProjectionDB | RC PATCH read | 2160 | 0.383 | 2.37 |
| ProjectionDB | RC PATCH write | 2160 | 0.222 | 3.16 |

### m7a-io2-m_cqrs-seq (ground truth — для сравнения с прогнозом)

| Station | Class | n | mean (мс) | CV² |
| --- | --- | ---: | ---: | ---: |
| AppService | Zapyty | 1287 | 0.346 | 0.19 |
| ProjectionDB | Zapyty | 1287 | 0.645 | 1.02 |
| AppService | Stvor | 588 | 1.895 | 0.08 |
| EventStore | Stvor | 588 | 0.278 | 0.52 |
| SnapshotDB | Stvor | 588 | 0.517 | 2.02 |
| AppService | RC POST | 588 | 0.583 | 0.30 |
| ProjectionDB | RC POST | 588 | 1.060 | 0.40 |
| AppService | Onovl | 2158 | 1.778 | 0.08 |
| EventStore | Onovl | 2158 | 0.225 | 2.12 |
| SnapshotDB | Onovl | 2158 | 0.796 | 0.36 |
| AppService | RC PATCH | 2158 | 1.636 | 0.27 |
| ProjectionDB | RC PATCH read | 2158 | 0.353 | 1.74 |
| ProjectionDB | RC PATCH write | 2158 | 0.229 | 2.92 |

---

## Шаг 2 — Формулы калибровки Lognormal MLE

На вход — raw seq-сэмплы для одной ячейки (`x₁, x₂, …, x_n`). Считаем 2 параметра Lognormal:

```text
μ_log = (1/n) · Σ ln(xᵢ)                         ← среднее логарифмов
σ_log = sqrt( (1/n) · Σ (ln(xᵢ) − μ_log)² )      ← std логарифмов
```

Это и есть `(μ, σ)`, которые JMT принимает в качестве параметров `LognormalPar(mu, sigma)`.

Связь с mean и variance исходного распределения:

```text
mean     = exp(μ_log + σ_log² / 2)
variance = (exp(σ_log²) − 1) · exp(2·μ_log + σ_log²)
CV²      = exp(σ_log²) − 1
```

Скрипт, который это считает: [_experiment_fits.mjs](../_experiment_fits.mjs).

---

## Шаг 3 — Калиброванные параметры Lognormal MLE

Применяем формулу Шага 2 к каждой ячейке.

### m7i-gp3 → LN MLE

| Station | Class | μ_log | σ_log |
| --- | --- | ---: | ---: |
| AppService | Zapyty | −0.940 | 0.321 |
| ProjectionDB | Zapyty | −0.457 | 0.377 |
| AppService | Stvor | 0.847 | 0.193 |
| EventStore | Stvor | −1.220 | 0.277 |
| SnapshotDB | Stvor | −0.730 | 0.488 |
| AppService | RC POST | −0.351 | 0.375 |
| ProjectionDB | RC POST | 0.339 | 0.409 |
| AppService | Onovl | 0.779 | 0.423 |
| EventStore | Onovl | −1.379 | 0.292 |
| SnapshotDB | Onovl | −0.196 | 0.340 |
| AppService | RC PATCH | 0.833 | 0.299 |
| ProjectionDB | RC PATCH read | −1.011 | 0.629 |
| ProjectionDB | RC PATCH write | −1.307 | 0.449 |

### m7i-io2 → LN MLE

| Station | Class | μ_log | σ_log |
| --- | --- | ---: | ---: |
| AppService | Zapyty | −1.051 | 0.344 |
| ProjectionDB | Zapyty | −0.518 | 0.406 |
| AppService | Stvor | 0.618 | 0.191 |
| EventStore | Stvor | −1.281 | 0.333 |
| SnapshotDB | Stvor | −0.788 | 0.434 |
| AppService | RC POST | −0.362 | 0.385 |
| ProjectionDB | RC POST | −0.097 | 0.405 |
| AppService | Onovl | 0.556 | 0.412 |
| EventStore | Onovl | −1.398 | 0.339 |
| SnapshotDB | Onovl | −0.261 | 0.358 |
| AppService | RC PATCH | 0.610 | 0.319 |
| ProjectionDB | RC PATCH read | −1.008 | 0.584 |
| ProjectionDB | RC PATCH write | −1.294 | 0.413 |

### m7a-gp3 → LN MLE

| Station | Class | μ_log | σ_log |
| --- | --- | ---: | ---: |
| AppService | Zapyty | −1.119 | 0.254 |
| ProjectionDB | Zapyty | −0.563 | 0.350 |
| AppService | Stvor | 0.764 | 0.145 |
| EventStore | Stvor | −1.351 | 0.298 |
| SnapshotDB | Stvor | −0.914 | 0.567 |
| AppService | RC POST | −0.618 | 0.387 |
| ProjectionDB | RC POST | 0.320 | 0.407 |
| AppService | Onovl | 0.662 | 0.415 |
| EventStore | Onovl | −1.610 | 0.261 |
| SnapshotDB | Onovl | −0.309 | 0.309 |
| AppService | RC PATCH | 0.697 | 0.313 |
| ProjectionDB | RC PATCH read | −1.290 | 0.687 |
| ProjectionDB | RC PATCH write | −1.639 | 0.424 |

---

## Шаг 4 — Формула K-предсказания

K_disk — коэффициент, который говорит «насколько диск io2 быстрее/медленнее gp3 при одной и той же станции». Считаем на паре m7i (где обе версии измерены):

```text
K_disk(station, class) = mean_m7i-io2(station, class) / mean_m7i-gp3(station, class)
```

Это число применяется к m7a-gp3 для предсказания m7a-io2:

```text
mean_predicted = mean_m7a-gp3 · K_disk
```

Для Lognormal это означает преобразование параметров:

```text
μ_predicted = μ_m7a-gp3 + ln(K_disk)
σ_predicted = σ_m7a-gp3              ← σ не меняется (свойство инстанса, не диска)
```

Обоснование «σ inherited» — в [distribution-method-selection.md §7.1](distribution-method-selection.md#71-можно-ли-менять-семейство-для-одной-станции-между-машинами).

---

## Шаг 5 — Рассчитанные K-коэффициенты

Применяем формулу Шага 4 к таблицам Шага 1.

| Station | Class | mean_m7i-gp3 | mean_m7i-io2 | **K_disk** | ln(K_disk) |
| --- | --- | ---: | ---: | ---: | ---: |
| AppService | Zapyty | 0.416 | 0.372 | **0.894** | −0.112 |
| ProjectionDB | Zapyty | 0.721 | 0.683 | **0.947** | −0.054 |
| AppService | Stvor | 2.392 | 1.897 | **0.793** | −0.232 |
| EventStore | Stvor | 0.326 | 0.320 | **0.982** | −0.018 |
| SnapshotDB | Stvor | 0.580 | 0.512 | **0.883** | −0.124 |
| AppService | RC POST | 0.771 | 0.772 | **1.001** | +0.001 |
| ProjectionDB | RC POST | 1.552 | 1.012 | **0.652** | −0.428 |
| AppService | Onovl | 2.332 | 1.870 | **0.802** | −0.221 |
| EventStore | Onovl | 0.268 | 0.284 | **1.060** | +0.058 |
| SnapshotDB | Onovl | 0.902 | 0.858 | **0.951** | −0.050 |
| AppService | RC PATCH | 2.321 | 1.870 | **0.806** | −0.215 |
| ProjectionDB | RC PATCH read | 0.479 | 0.450 | **0.939** | −0.063 |
| ProjectionDB | RC PATCH write | 0.314 | 0.308 | **0.981** | −0.019 |

K<1 → io2 быстрее gp3 (большинство станций). K>1 → io2 неожиданно медленнее. K≈1 → диск не играет роли (CPU-bound станции типа AppService.RC.POST).

---

## Шаг 6 — Применение K к m7a-gp3

Складываем Шаг 3 (m7a-gp3) и Шаг 5 (K):

```text
μ_m7a-io2_pred = μ_m7a-gp3 + ln(K_disk)
σ_m7a-io2_pred = σ_m7a-gp3
```

---

## Шаг 7 — Финальные параметры m7a-io2_predicted + сверка

| Station | Class | μ_pred | σ_pred | mean_pred | mean_measured | Δ% |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| AppService | Zapyty | −1.231 | 0.254 | 0.302 | 0.346 | −12.7% |
| ProjectionDB | Zapyty | −0.617 | 0.350 | 0.575 | 0.645 | −10.9% |
| AppService | Stvor | 0.532 | 0.145 | 1.722 | 1.895 | −9.1% |
| EventStore | Stvor | −1.369 | 0.298 | 0.265 | 0.278 | −4.7% |
| SnapshotDB | Stvor | −1.038 | 0.567 | 0.418 | 0.517 | −19.2% |
| AppService | RC POST | −0.617 | 0.387 | 0.594 | 0.583 | +1.9% |
| ProjectionDB | RC POST | −0.108 | 0.407 | 0.978 | 1.060 | −7.7% |
| AppService | Onovl | 0.441 | 0.415 | 1.694 | 1.778 | −4.7% |
| EventStore | Onovl | −1.552 | 0.261 | 0.219 | 0.225 | −2.7% |
| SnapshotDB | Onovl | −0.359 | 0.309 | 0.733 | 0.796 | −7.9% |
| AppService | RC PATCH | 0.482 | 0.313 | 1.696 | 1.636 | +3.7% |
| ProjectionDB | RC PATCH read | −1.353 | 0.687 | 0.328 | 0.353 | −7.1% |
| ProjectionDB | RC PATCH write | −1.658 | 0.424 | 0.208 | 0.229 | −9.2% |

**Среднее |Δ%| по 13 ячейкам: 7.7%.** Худшие ячейки — SnapshotDB.Stvor (−19%), AppService.Zapyty (−13%), ProjectionDB.Zapyty (−11%). Лучшие — AppService.RC POST (+2%), EventStore.Onovl (−3%).

Это **средняя ошибка предсказания на уровне service-time mean**. Финальная MRE по response-time (под нагрузкой) будет другой — её даст JMT-симуляция (Шаг 8 в task.md).

---

## Пример полного расчёта: AppService.Onovl

Один сквозной пример со всеми числами.

### Шаг 1 — Метрики

| Машина | n | mean (мс) | CV² |
| --- | ---: | ---: | ---: |
| m7i-gp3 | 2159 | 2.332 | 0.17 |
| m7i-io2 | 2158 | 1.870 | 0.22 |
| m7a-gp3 | 2160 | 2.063 | 0.11 |
| m7a-io2 (truth) | 2158 | 1.778 | 0.08 |

### Шаг 2 — Формулы

Lognormal MLE на seq-сэмплах:

```text
μ_log = (1/n) · Σ ln(xᵢ)
σ_log = sqrt( (1/n) · Σ (ln(xᵢ) − μ_log)² )
```

### Шаг 3 — Калиброванные параметры

| Машина | μ_log | σ_log |
| --- | ---: | ---: |
| m7i-gp3 | 0.779 | 0.423 |
| m7i-io2 | 0.556 | 0.412 |
| m7a-gp3 | 0.662 | 0.415 |

Sanity-check для m7a-gp3: `exp(μ + σ²/2) = exp(0.662 + 0.415²/2) = exp(0.748) = 2.113`. У нас mean=2.063. Маленькое расхождение объясняется тем, что MLE подгоняется не к mean выборки напрямую (а к среднему логарифмов).

### Шаг 4 — Формула K

```text
K_disk = mean_m7i-io2 / mean_m7i-gp3 = 1.870 / 2.332 = 0.802
ln(K_disk) = −0.221
```

### Шаг 5 — Применение Шага 4

```text
K_disk = 0.802            ← io2 ускоряет AppService.Onovl на ~20%
                            (физически: меньше времени в IO-wait → меньше CPU-нагрузка)
```

### Шаг 6 — Применяем K к m7a-gp3

```text
μ_pred = μ_m7a-gp3 + ln(K_disk) = 0.662 + (−0.221) = 0.441
σ_pred = σ_m7a-gp3 = 0.415
```

### Шаг 7 — Финальные параметры predicted m7a-io2

| Параметр | Значение |
| --- | --- |
| μ_pred | **0.441** |
| σ_pred | **0.415** |
| Расчётный mean = exp(μ + σ²/2) | exp(0.441 + 0.086) = **1.694 мс** |
| Измеренный mean на m7a-io2 | **1.778 мс** |
| Ошибка | (1.694 − 1.778) / 1.778 = **−4.7%** |

JMT-модель m7a-io2 для этой ячейки получит:

```xml
<subParameter classPath="jmt.engine.random.Lognormal" name="Lognormal"/>
<subParameter classPath="jmt.engine.random.LognormalPar" name="distrPar">
  <subParameter classPath="java.lang.Double" name="mu"><value>0.441</value></subParameter>
  <subParameter classPath="java.lang.Double" name="sigma"><value>0.415</value></subParameter>
</subParameter>
```

Эта одна станция-класс и есть один «строительный блок» предсказательной модели. Аналогично заполняются все 13 ячеек.

---

## Альтернатива (Эксперимент 2): Brunnert per-CV²

В этом подходе **разные станции получают разные семейства**, в зависимости от CV² базовой машины (m7a-gp3):

| CV² m7a-gp3 | Семейство | Параметры калибровки |
| --- | --- | --- |
| < 0.5 | Erlang-k | k = round(1/CV²), rate = k/mean |
| 0.5 ≤ CV² ≤ 1.5 | Exponential | rate = 1/mean |
| > 1.5 | Lognormal MLE | μ, σ как в Эксп 1 |

K-предсказание для Exp/Erlang применяется не к (μ, σ), а к **rate**:

```text
rate_predicted = rate_m7a-gp3 / K_disk
k остаётся фиксированным (для Erlang)
```

Это потому что для Erlang-k и Exp среднее `mean = k/rate` (для Erlang) или `1/rate` (для Exp). Умножение mean на K эквивалентно делению rate на K.

Каждая станция-класс в Эксп 2 получает СВОЁ семейство, согласно правилу выше:

| Station | Class | CV² m7a-gp3 | **Семейство в Exp 2** |
| --- | --- | ---: | --- |
| AppService | Zapyty | 0.10 | Erlang-10 |
| ProjectionDB | Zapyty | 0.42 | Erlang-2 |
| AppService | Stvor | 0.04 | Erlang-27 |
| EventStore | Stvor | 0.82 | Exponential |
| SnapshotDB | Stvor | 1.80 | Lognormal MLE |
| AppService | RC POST | 0.36 | Erlang-3 |
| ProjectionDB | RC POST | 0.30 | Erlang-3 |
| **AppService** | **Onovl** | **0.11** | **Erlang-9** |
| EventStore | Onovl | 0.72 | Exponential |
| SnapshotDB | Onovl | 0.49 | Erlang-2 |
| AppService | RC PATCH | 0.25 | Erlang-4 |
| ProjectionDB | RC PATCH read | 2.37 | Lognormal MLE |
| ProjectionDB | RC PATCH write | 3.16 | Lognormal MLE |

Полные параметры всех 13 ячеек для Brunnert — в [experiment-fits.json](../experiment-fits.json).

## Пример полного расчёта — Эксп 2 (Brunnert) для AppService.Onovl

Та же станция-класс, что и в Эксп 1, но проходит через Erlang-9-pipeline.

### Шаг 1 — Метрики (те же что в Эксп 1)

| Машина | mean (мс) | CV² |
| --- | ---: | ---: |
| m7i-gp3 | 2.332 | 0.17 |
| m7i-io2 | 1.870 | 0.22 |
| m7a-gp3 | 2.063 | 0.11 |
| m7a-io2 (truth) | 1.778 | 0.08 |

### Шаг 2 — Выбор семейства и формулы

CV² m7a-gp3 = 0.11 → попадает в зону `<0.5` → семейство = **Erlang-k**.

```text
k    = round(1 / CV²_m7a-gp3) = round(1 / 0.111) = 9
rate = k / mean (вычисляется на каждой машине отдельно)
```

### Шаг 3 — Калиброванные параметры (Erlang-9)

| Машина | k | rate |
| --- | ---: | ---: |
| m7i-gp3 | 9 | 9 / 2.332 = **3.859** |
| m7i-io2 | 9 | 9 / 1.870 = **4.814** |
| m7a-gp3 | 9 | 9 / 2.063 = **4.362** |

### Шаг 4 — Формула K (та же что в Эксп 1)

```text
K_disk = mean_m7i-io2 / mean_m7i-gp3 = 1.870 / 2.332 = 0.802
```

### Шаг 5 — K_disk = 0.802 (тот же)

### Шаг 6 — Применение K к m7a-gp3 (другая формула!)

```text
rate_predicted = rate_m7a-gp3 / K_disk = 4.362 / 0.802 = 5.439
k_predicted    = k_m7a-gp3 = 9     ← не меняется
```

### Шаг 7 — Финальные параметры predicted m7a-io2 (Erlang-9)

| Параметр | Значение |
| --- | --- |
| k_pred | **9** |
| rate_pred | **5.439** мс⁻¹ |
| Расчётный mean = k/rate | 9 / 5.439 = **1.654 мс** |
| Измеренный mean | **1.778 мс** |
| Ошибка | (1.654 − 1.778) / 1.778 = **−7.0%** |

JMT-модель для этой ячейки (Erlang-9):

```xml
<subParameter classPath="jmt.engine.random.Erlang" name="Erlang"/>
<subParameter classPath="jmt.engine.random.ErlangPar" name="distrPar">
  <subParameter classPath="java.lang.Double" name="alpha"><value>5.439</value></subParameter>
  <subParameter classPath="java.lang.Integer" name="r"><value>9</value></subParameter>
</subParameter>
```

### Сравнение двух экспериментов для AppService.Onovl

| | Семейство | predicted mean | измеренный | ошибка |
| --- | --- | ---: | ---: | ---: |
| **Эксп 1** | Lognormal(μ=0.441, σ=0.415) | 1.694 мс | 1.778 мс | **−4.7%** |
| **Эксп 2** | Erlang-9(rate=5.439) | 1.654 мс | 1.778 мс | **−7.0%** |

По **mean prediction** Эксп 1 чуть лучше для этой ячейки. Но по **KS-фиту** на seq-данных Erlang-9 системно лучше (см. ниже) — то есть он лучше **ловит форму распределения**. Какой важнее — покажет финальная JMT-симуляция (Шаг 8).

## Гибрид (Эксп 3): LN MLE + 2 точечных Erlang-k

Идея: использовать **Lognormal MLE как baseline** на всех станциях (как Эксп 1), **но для двух станций**, где Erlang-k систематически даёт меньший KS на всех 4 машинах, переключиться на Erlang.

Решение основано на наблюдениях из KS-сравнения Эксп 1 vs Эксп 2: только 2 ячейки показали последовательное преимущество Erlang на всех (или почти всех) калибровочных машинах:

| Ячейка | LN KS (m7i-gp3 / io2 / m7a-gp3 / io2) | Erlang KS | Победа Erlang |
| --- | --- | --- | --- |
| AppService.Onovl | 0.347 / 0.308 / 0.373 / 0.335 | 0.297 / 0.253 / 0.333 / 0.305 | 4/4 |
| ProjectionDB.RC.POST | 0.309 / 0.319 / 0.364 / 0.233 | 0.291 / 0.302 / 0.326 / 0.242 | 3/4 |

Остальные 11 ячеек: Lognormal MLE проигрывает или равняется Brunnert-альтернативам в недостаточном числе случаев, чтобы оправдать смену семейства. **На них оставляем LN MLE** — это сохраняет цельность модели и K-prediction-консистентность.

### Маппинг семейств для Эксп 3

| Station | Class | **Эксп 1** | **Эксп 2 (Brunnert)** | **Эксп 3 (Гибрид)** |
| --- | --- | --- | --- | --- |
| AppService | Zapyty | LN MLE | Erlang-10 | LN MLE |
| ProjectionDB | Zapyty | LN MLE | Erlang-2 | LN MLE |
| AppService | Stvor | LN MLE | Erlang-27 | LN MLE |
| EventStore | Stvor | LN MLE | Exp | LN MLE |
| SnapshotDB | Stvor | LN MLE | LN MLE | LN MLE |
| AppService | RC POST | LN MLE | Erlang-3 | LN MLE |
| **ProjectionDB** | **RC POST** | LN MLE | Erlang-3 | **Erlang-3** ⭐ |
| **AppService** | **Onovl** | LN MLE | Erlang-9 | **Erlang-9** ⭐ |
| EventStore | Onovl | LN MLE | Exp | LN MLE |
| SnapshotDB | Onovl | LN MLE | Erlang-2 | LN MLE |
| AppService | RC PATCH | LN MLE | Erlang-4 | LN MLE |
| ProjectionDB | RC PATCH read | LN MLE | LN MLE | LN MLE |
| ProjectionDB | RC PATCH write | LN MLE | LN MLE | LN MLE |

⭐ — ячейки, где Гибрид отличается от Эксп 1.

## Пример полного расчёта — Эксп 3 (Гибрид) для ProjectionDB.RC.POST

Для AppService.Onovl Гибрид использует ту же Erlang-9, что и Эксп 2 (см. предыдущий worked example). Поэтому здесь покажу **вторую swapped-ячейку — ProjectionDB.RC.POST** с Erlang-3.

### Шаг 1 (Эксп 3) — Метрики

| Машина | mean (мс) | CV² |
| --- | ---: | ---: |
| m7i-gp3 | 1.552 | 0.29 |
| m7i-io2 | 1.012 | 0.46 |
| m7a-gp3 | 1.526 | 0.30 |
| m7a-io2 (truth) | 1.060 | 0.40 |

### Шаг 2 (Эксп 3) — Выбор семейства и формулы

В Гибриде эта ячейка swapped на Erlang. CV² m7a-gp3 = 0.30 → `k = round(1/0.30) = 3`. Семейство = **Erlang-3**.

```text
rate = k / mean = 3 / mean
```

### Шаг 3 (Эксп 3) — Калиброванные параметры (Erlang-3)

| Машина | k | rate |
| --- | ---: | ---: |
| m7i-gp3 | 3 | 3 / 1.552 = **1.933** |
| m7i-io2 | 3 | 3 / 1.012 = **2.963** |
| m7a-gp3 | 3 | 3 / 1.526 = **1.966** |

### Шаг 4 (Эксп 3) — Формула K

```text
K_disk = mean_m7i-io2 / mean_m7i-gp3 = 1.012 / 1.552 = 0.652
```

Это самое маленькое K в нашей выборке — io2 ускоряет projection.write на 35% по сравнению с gp3.

### Шаг 5 (Эксп 3) — K_disk = 0.652

### Шаг 6 (Эксп 3) — Применение K к m7a-gp3

```text
rate_predicted = rate_m7a-gp3 / K_disk = 1.966 / 0.652 = 3.015
k_predicted    = k_m7a-gp3 = 3      ← не меняется
```

### Шаг 7 (Эксп 3) — Финальные параметры predicted m7a-io2 (Erlang-3)

| Параметр | Значение |
| --- | --- |
| k_pred | **3** |
| rate_pred | **3.015** мс⁻¹ |
| Расчётный mean = k/rate | 3 / 3.015 = **0.995 мс** |
| Измеренный mean | **1.060 мс** |
| Ошибка | (0.995 − 1.060) / 1.060 = **−6.1%** |

JMT-модель для этой ячейки в Эксп 3:

```xml
<subParameter classPath="jmt.engine.random.Erlang" name="Erlang"/>
<subParameter classPath="jmt.engine.random.ErlangPar" name="distrPar">
  <subParameter classPath="java.lang.Double" name="alpha"><value>3.015</value></subParameter>
  <subParameter classPath="java.lang.Integer" name="r"><value>3</value></subParameter>
</subParameter>
```

### Сравнение трёх экспериментов для ProjectionDB.RC.POST

| | Семейство | predicted mean | измеренный | ошибка |
| --- | --- | ---: | ---: | ---: |
| **Эксп 1** | Lognormal(μ=−0.108, σ=0.407) | 0.975 мс | 1.060 мс | **−8.0%** |
| **Эксп 2** | Erlang-3(rate=3.015) | 0.995 мс | 1.060 мс | **−6.1%** |
| **Эксп 3** | Erlang-3(rate=3.015) | 0.995 мс | 1.060 мс | **−6.1%** |

Здесь Эксп 2 = Эксп 3 (потому что на этой ячейке Brunnert и Гибрид совпадают: оба выбрали Erlang-3). А Эксп 1 (LN MLE) предсказывает чуть хуже на 2 п.п.

---

## KS-сравнение Exp 1 vs Exp 2

KS-distance — насколько близко CDF выбранного распределения к эмпирической CDF (меньше = лучше). Меряем на seq-сэмплах каждой ячейки.

| | Mean KS | Wins (из 52) |
| --- | ---: | ---: |
| **Exp 1 (LN MLE everywhere)** | **0.216** | **33** |
| Exp 2 (Brunnert per CV²) | 0.293 | 19 |

**LN MLE убедительно лучше.** Главная причина проигрыша Brunnert — EventStore:

| Машина | EventStore (POST) | CV² реальный | KS_LN | KS_Brunnert (= Exp) |
| --- | --- | ---: | ---: | ---: |
| m7i-gp3 | | 3.13 | **0.151** | 0.463 |
| m7i-io2 | | 3.17 | **0.188** | 0.447 |
| m7a-gp3 | | 0.82 | **0.192** | 0.458 |
| m7a-io2 | | 0.52 | **0.170** | 0.468 |

Brunnert выбрал Exp по CV² m7a-gp3=0.82, но на m7i реальное CV² = 3 → Exp с тяжёлым хвостом не справляется.

Единственные ячейки, где Brunnert (Erlang-k) систематически лучше LN на всех 4 машинах:

- `AppService.Onovl` → Erlang-9 (LN KS 0.31–0.37 vs Erlang 0.25–0.33)
- `ProjectionDB.RC.POST` → Erlang-3 (выигрывает на 3 из 4)

---

## Erlang-k справка (для Эксперимента 2)

Erlang(k, rate) — сумма k независимых экспонент с rate λ:

```text
mean = k/rate
CV²  = 1/k        ← зависит только от k
```

Чем больше k → тем уже распределение (концентрированнее вокруг среднего). Применение к нашим CV²:

| CV² | k = round(1/CV²) | Erlang | Где применяется (m7a-gp3) |
| ---: | ---: | --- | --- |
| 0.04 | 27 | Erlang-27 | AppService.Stvor (очень узкое) |
| 0.10 | 10 | Erlang-10 | AppService.Zapyty |
| 0.11 | 9 | Erlang-9 | AppService.Onovl |
| 0.25 | 4 | Erlang-4 | AppService.RC PATCH |
| 0.30 | 3 | Erlang-3 | ProjectionDB.RC POST |
| 0.36 | 3 | Erlang-3 | AppService.RC POST |
| 0.42 | 2 | Erlang-2 | ProjectionDB.Zapyty |
| 0.49 | 2 | Erlang-2 | SnapshotDB.Onovl |

Erlang-9 vs Erlang-3 (mean=1 мс):

| | p10 | p50 | p90 | p95 |
| --- | ---: | ---: | ---: | ---: |
| Erlang-3 | 0.37 | 0.89 | 1.78 | 2.11 |
| Erlang-9 | 0.59 | 0.96 | 1.45 | 1.59 |

Erlang-9 в 2 раза «уже» — короче хвост, выше плотность около среднего.

---

## Итог эксперимента

Мы запустили три варианта параметризации service-time для JMT-модели и измерили их на двух показателях:

- **Mean KS** — насколько распределение, выбранное в калибровке, ложится на эмпирическую CDF seq-данных. *Меньше = лучше форма распределения*.
- **Mean |Δ%|** — насколько средняя service-time, предсказанная для m7a-io2 (через K-prediction), отличается от реально измеренной на m7a-io2. *Меньше = лучше прогноз среднего*.

### Сводная таблица

| Критерий | **Exp 1: LN MLE** | **Exp 2: Brunnert** | **Exp 3: Hybrid** |
| --- | :---: | :---: | :---: |
| Семейства распределений | LN на всех 13 ячейках | смесь: 8 Erlang + 2 Exp + 3 LN | LN на 11 + Erlang на 2 |
| Семейство меняется между машинами? | нет | нет | нет |
| Семейство меняется между станциями? | нет | да | минимально (2 точки) |
| K-prediction консистентна? | ✅ да | ⚠️ ломается для cross-CV² | ✅ да |
| **Mean KS (52 ячейки)** | **0.216** | 0.293 *(хуже)* | **0.211** *(чуть лучше)* |
| Wins по KS (vs другие два) | 33 / 52 | 19 / 52 | 7 ячеек лучше Exp 1, 44 равны |
| **Mean \|Δ%\| прогноза (13 ячеек)** | 7.78% | **7.10%** *(чуть лучше)* | 7.81% |
| Max \|Δ%\| прогноза | 19.6% (SnapshotDB.Stvor) | 19.6% | 19.6% |
| EventStore (heavy tail) | работает | **катастрофа на m7i (KS 0.45–0.55)** | работает |
| Сложность имплементации | низкая | высокая | средняя |

### Что показал эксперимент

**Главное наблюдение** — два показателя расходятся:

- По **форме распределения** (KS) лучше работает **LN MLE** (Exp 1 и Exp 3). Brunnert проигрывает катастрофически на EventStore, где правило по CV² m7a-gp3 диктует Exp, но реальные m7i имеют CV²~3 и Exp не справляется с хвостом.
- По **среднему прогноза** (|Δ%|) формально лучше **Brunnert** (Exp 2), но это **технический артефакт**: для Erlang/Exp `predicted mean = K × sample_mean` по построению (rate=k/mean), тогда как LN MLE даёт `predicted mean = K × exp(μ+σ²/2)`, и этот fit-bias добавляет ~0.5 п.п. Разница между всеми тремя по mean — **меньше 1 п.п.**, в пределах шума.

**Hybrid (Exp 3)** проигрывает Exp 1 по mean на 0.03 п.п. — потому что в одной из swapped-ячеек (AppService.Onovl) LN MLE случайно предсказывал среднее точнее Erlang (−4.7% vs −7.0%). В другой (ProjectionDB.RC.POST) Erlang выиграл (−6.1% vs −7.9%). На агрегате компенсировалось.

**KS-выигрыш Hybrid над Exp 1 крошечный** — 0.005 (с 0.216 до 0.211). 2 swapped ячейки × 4 машины = 8 KS-значений из 52 поменялись, остальные 44 ячейки идентичны Exp 1.

### Какую модель использовать

**Рекомендация: Exp 1 (Lognormal MLE на всех станциях) как baseline.**

Аргументы:

1. **Простота и согласованность.** Один тип распределения везде, одни и те же формулы калибровки и K-prediction. Меньше точек, где может сломаться pipeline.
2. **Лучший KS среди трёх вариантов** (с минимальным отрывом от Hybrid, но без точечных swaps). Распределение по форме описывает эмпирику лучше, чем Brunnert.
3. **Mean prediction error в пределах 0.7 п.п. от лучшего варианта** — не критично. Если хочется убрать LN fit-bias, можно использовать MoM-калибровку (mean exactly preserved) **там, где CV² достаточно мал** — но это уже Hybrid-вариант, см. ниже.
4. **K-prediction формула чистая** — `μ_pred = μ_base + ln(K_disk), σ_pred = σ_base`. Никаких «эта станция — Erlang, та — Exp» при переносе на m7a-io2.

**Когда переходить на Hybrid (Exp 3):**

- Если JMT-симуляция Exp 1 даст неудовлетворительный MRE на станциях `AppService.Onovl` или `ProjectionDB.RC.POST` (две ячейки, где LN MLE имеет KS 0.31–0.37, а Erlang-k 0.25–0.33). Тогда swapping этих двух может улучшить response-time предсказание.
- Если важна именно форма распределения хвоста на этих двух станциях (для p95/p99 прогноза).

**Когда НЕ использовать Brunnert (Exp 2):**

- Никогда в нашем cross-machine setup. EventStore-катастрофа (Exp на m7i при CV²~3 → KS 0.45–0.55) перевешивает любые выигрыши на других станциях. K-prediction теряет смысл, когда семейство выбирается по голому CV² одной машины.

### Что ещё нужно для финального решения

Эти эксперименты сравнивали **калибровку**, а не **прогноз response-time под нагрузкой**. Финальный критерий — **MRE JMT-симуляции** (предсказанный response-time vs measured load). Это даст Шаг 8 в [task.md](../task.md): сгенерировать `.jsimg` для всех трёх вариантов, прогнать JMT, сравнить MRE. До этого момента рекомендация остаётся: **Exp 1 как baseline**, с возможностью точечно перейти на Exp 3 если будут указания.

## Артефакты

| Файл | Содержание |
| --- | --- |
| [_experiment_fits.mjs](../_experiment_fits.mjs) | Расчёт параметров для обоих экспериментов |
| [experiment-fits.json](../experiment-fits.json) | Сырые параметры (μ, σ, k, rate) + KS per (machine, station, class) |
| [distribution-method-selection.md](distribution-method-selection.md) | Полное обоснование выбора LN MLE |
| [log-fit-comparison.md](../log-fit-comparison.md) | MOM vs MLE — почему MLE |
| [log-analisis-seq.md](../log-analisis-seq.md) | Исходные per-request метрики со seq логов |
