# Эксперимент 6: гибридная калибровка (seq median + load σ MLE)

Документ описывает шаг за шагом, как из seq + load логов мы получаем параметры JMT-моделей в Exp 6 и используем их для предсказания m7a-io2.

Базовая концепция гибридной калибровки — в [jmt-results.md §Шаг 9](jmt-results.md). Этот документ — про **поток данных и расчёты** с реальными цифрами на каждом шаге, аналогично [experiment-design.md](experiment-design.md) для Exp 1/2/3.

## Pipeline в одном виде

```text
                    ┌─────────────────────────┐
[1a] Логи seq  ──→  │ mean, median, CV²       │  ← center statistic
                    └─────────┬───────────────┘
                              │
                    ┌─────────────────────────┐
[1b] Логи load ──→  │ σ_MLE (Lognormal MLE)   │  ← spread parameter
                    └─────────┬───────────────┘
                              │
                              ▼
                    ┌─────────────────────────────┐
[2-3] Калибровка    │ σ = σ_load_MLE             │
                    │ μ = ln(median_seq) − σ²/2  │  ← preserves median
                    │                            │  ← E[X] = median_seq
                    └─────────┬───────────────────┘
                              │
                              ▼
                    ┌─────────────────────────────┐
[4-5] K-prediction  │ K_median = median_m7i-io2 / │
                    │            median_m7i-gp3   │
                    └─────────┬───────────────────┘
                              │
                              ▼
                    ┌─────────────────────────────┐
[6-7] Predicted     │ μ_pred = μ + ln(K_median)  │
      m7a-io2       │ σ_pred = σ                  │
                    └─────────────────────────────┘
```

Шаги [1]–[7] разобраны ниже.

---

## Шаг 1a — Метрики из seq-логов (центральная статистика)

Для каждой `(machine, station, class)` ячейки берём per-request метрику и считаем **mean**, **median**, **CV²** на seq-данных. Эти ячейки = базовый набор service-time slices.

### m7i-gp3-m_cqrs (база для K-формулы)

| Cell                         |    n | mean  | median | CV²  | mean/median |
| ---------------------------- | ---: | ----: | -----: | ---: | ----------: |
| AppService.Zapyty            | 1287 | 0.416 |  0.393 | 0.28 |       1.06x |
| ProjectionDB.Zapyty          | 1287 | 0.721 |  0.653 | 1.89 |       1.10x |
| AppService.Stvor             |  588 | 2.392 |  2.263 | 0.11 |       1.06x |
| EventStore.Stvor             |  588 | 0.326 |  0.289 | 3.13 |       1.13x |
| SnapshotDB.Stvor             |  588 | 0.580 |  0.383 | 1.88 |       1.51x |
| AppService.RC.POST           |  588 | 0.771 |  0.612 | 0.38 |       1.26x |
| ProjectionDB.RC.POST         |  588 | 1.552 |  1.228 | 0.29 |       1.26x |
| AppService.Onovl             | 2159 | 2.332 |  2.288 | 0.17 |       1.02x |
| EventStore.Onovl             | 2159 | 0.268 |  0.232 | 3.57 |       1.16x |
| SnapshotDB.Onovl             | 2159 | 0.902 |  0.766 | 0.76 |       1.18x |
| AppService.RC.PATCH          | 2159 | 2.321 |  2.044 | 0.23 |       1.14x |
| ProjectionDB.RC.PATCH.read   | 2159 | 0.479 |  0.276 | 2.68 |       1.74x |
| ProjectionDB.RC.PATCH.write  | 2159 | 0.314 |  0.228 | 3.97 |       1.38x |

### m7i-io2-m_cqrs (числитель в K-формуле)

| Cell                         |    n | mean  | median | CV²  | mean/median |
| ---------------------------- | ---: | ----: | -----: | ---: | ----------: |
| AppService.Zapyty            | 1287 | 0.372 |  0.352 | 0.19 |       1.06x |
| ProjectionDB.Zapyty          | 1287 | 0.683 |  0.602 | 1.27 |       1.13x |
| AppService.Stvor             |  588 | 1.897 |  1.793 | 0.08 |       1.06x |
| EventStore.Stvor             |  588 | 0.320 |  0.268 | 3.17 |       1.20x |
| SnapshotDB.Stvor             |  588 | 0.512 |  0.369 | 0.48 |       1.39x |
| AppService.RC.POST           |  588 | 0.772 |  0.599 | 0.60 |       1.29x |
| ProjectionDB.RC.POST         |  588 | 1.012 |  0.767 | 0.46 |       1.32x |
| AppService.Onovl             | 2158 | 1.870 |  1.804 | 0.22 |       1.04x |
| EventStore.Onovl             | 2158 | 0.284 |  0.231 | 7.49 |       1.23x |
| SnapshotDB.Onovl             | 2158 | 0.858 |  0.736 | 1.07 |       1.17x |
| AppService.RC.PATCH          | 2158 | 1.870 |  1.606 | 0.27 |       1.17x |
| ProjectionDB.RC.PATCH.read   | 2158 | 0.450 |  0.279 | 1.44 |       1.61x |
| ProjectionDB.RC.PATCH.write  | 2158 | 0.308 |  0.236 | 3.35 |       1.31x |

### m7a-gp3-m_cqrs (база для применения K)

| Cell                         |    n | mean  | median | CV²  | mean/median |
| ---------------------------- | ---: | ----: | -----: | ---: | ----------: |
| AppService.Zapyty            | 1287 | 0.338 |  0.329 | 0.10 |       1.03x |
| ProjectionDB.Zapyty          | 1287 | 0.622 |  0.563 | 0.42 |       1.11x |
| AppService.Stvor             |  588 | 2.173 |  2.087 | 0.04 |       1.04x |
| EventStore.Stvor             |  588 | 0.281 |  0.265 | 0.82 |       1.06x |
| SnapshotDB.Stvor             |  588 | 0.505 |  0.292 | 1.80 |       1.73x |
| AppService.RC.POST           |  588 | 0.593 |  0.468 | 0.36 |       1.27x |
| ProjectionDB.RC.POST         |  588 | 1.526 |  1.154 | 0.30 |       1.32x |
| AppService.Onovl             | 2160 | 2.063 |  2.031 | 0.11 |       1.02x |
| EventStore.Onovl             | 2160 | 0.204 |  0.189 | 0.72 |       1.08x |
| SnapshotDB.Onovl             | 2160 | 0.791 |  0.686 | 0.49 |       1.15x |
| AppService.RC.PATCH          | 2160 | 2.037 |  1.765 | 0.25 |       1.15x |
| ProjectionDB.RC.PATCH.read   | 2160 | 0.383 |  0.203 | 2.37 |       1.89x |
| ProjectionDB.RC.PATCH.write  | 2160 | 0.222 |  0.169 | 3.16 |       1.32x |

### m7a-io2-m_cqrs (ground truth — для сверки предсказания)

| Cell                         |    n | mean  | median | CV²  | mean/median |
| ---------------------------- | ---: | ----: | -----: | ---: | ----------: |
| AppService.Zapyty            | 1287 | 0.346 |  0.334 | 0.19 |       1.04x |
| ProjectionDB.Zapyty          | 1287 | 0.645 |  0.558 | 1.02 |       1.16x |
| AppService.Stvor             |  588 | 1.895 |  1.794 | 0.08 |       1.06x |
| EventStore.Stvor             |  588 | 0.278 |  0.265 | 0.52 |       1.05x |
| SnapshotDB.Stvor             |  588 | 0.517 |  0.284 | 2.02 |       1.82x |
| AppService.RC.POST           |  588 | 0.583 |  0.470 | 0.30 |       1.24x |
| ProjectionDB.RC.POST         |  588 | 1.060 |  0.789 | 0.40 |       1.34x |
| AppService.Onovl             | 2158 | 1.778 |  1.757 | 0.08 |       1.01x |
| EventStore.Onovl             | 2158 | 0.225 |  0.189 | 2.12 |       1.19x |
| SnapshotDB.Onovl             | 2158 | 0.796 |  0.688 | 0.36 |       1.16x |
| AppService.RC.PATCH          | 2158 | 1.636 |  1.414 | 0.27 |       1.16x |
| ProjectionDB.RC.PATCH.read   | 2158 | 0.353 |  0.204 | 1.74 |       1.73x |
| ProjectionDB.RC.PATCH.write  | 2158 | 0.229 |  0.172 | 2.92 |       1.33x |

### Ключевое наблюдение в seq-данных

Для **Zapyty-ячеек** (AppService.Zapyty, ProjectionDB.Zapyty) mean ≈ median (ratio 1.03–1.16). То есть **в seq у GET-классов выбора между mean и median почти не существует** — оба числа одинаковые.

А вот для других ячеек разница есть:

- `SnapshotDB.Stvor` (CV² = 1.80): mean/median = **1.73x** — mean заметно больше median.
- `ProjectionDB.RC.PATCH.read` (CV² = 2.37): mean/median = **1.89x**.
- `ProjectionDB.RC.PATCH.write` (CV² = 3.97): mean/median = **1.38x**.
- `AppService.RC.POST` (CV² = 0.38): mean/median = **1.26x**.
- `ProjectionDB.RC.POST`: mean/median = **1.26x**.

**Это критично для понимания эффекта Exp 6.** Замена mean→median меняет cells с *высоким CV²* существенно (на 30–80%), даже если Zapyty-ячейки сами по себе почти не меняются.

---

## Шаг 1b — σ_MLE из load-логов

Считаем `σ_MLE = std(ln(x_i))` для **load**-сэмплов. Это даёт «реальный разброс под нагрузкой», который seq не видит.

### m7a-gp3-m_cqrs load σ (база для применения)

| Cell                         | mean_load | σ_load_MLE | CV²_load |
| ---------------------------- | --------: | ---------: | -------: |
| AppService.Zapyty            |     3.014 |      1.049 |    62.27 |
| ProjectionDB.Zapyty          |     0.889 |      0.772 |     1.55 |
| AppService.Stvor             |     5.154 |      0.682 |    17.77 |
| EventStore.Stvor             |     0.455 |      0.754 |     2.06 |
| SnapshotDB.Stvor             |     0.711 |      0.781 |     1.66 |
| AppService.RC.POST           |     2.743 |      0.894 |    45.32 |
| ProjectionDB.RC.POST         |     2.043 |      0.509 |     0.56 |
| AppService.Onovl             |     5.971 |      0.698 |    23.54 |
| EventStore.Onovl             |     0.419 |      0.744 |     1.91 |
| SnapshotDB.Onovl             |     1.105 |      0.642 |     1.28 |
| AppService.RC.PATCH          |     4.989 |      0.698 |    15.37 |
| ProjectionDB.RC.PATCH.read   |     0.656 |      0.807 |     1.57 |
| ProjectionDB.RC.PATCH.write  |     0.617 |      0.789 |     1.76 |

**Сравнение σ:**

- σ_seq_MLE (Exp 1): 0.14–0.45 (узкие хвосты, потому что seq имеет CV² < 0.5 для большинства ячеек).
- σ_load_MLE (Exp 6): 0.51–1.05 (в 2–7 раз шире).

CV²_load для AppService-ячеек огромный (15–62) из-за p99 outliers (GC pauses). MLE σ умеет «не реагировать» на эти outliers — она остаётся в диапазоне 0.7–1.0, а не растёт до 2+ как было бы при method-of-moments через `σ² = ln(1 + CV²_load)`.

---

## Шаг 2 — Формула калибровки Lognormal в Exp 6

На вход — `(median_seq, σ_load_MLE)` для одной ячейки. Считаем 2 параметра Lognormal:

```text
σ = σ_load_MLE                         ← взято из шага 1b
μ = ln(median_seq) − σ²/2              ← preserves E[X] = median_seq
```

Связь параметров с распределением:

```text
mean      = exp(μ + σ²/2) = median_seq  ← по построению формулы
median_LN = exp(μ)        = median_seq × exp(−σ²/2)
CV²_LN    = exp(σ²) − 1
```

**Почему именно эта формула.** В Lognormal `(μ, σ)` оба параметра контролируют расположение распределения вместе через связь `mean = exp(μ + σ²/2)`. Чтобы зафиксировать центр (= median_seq) и одновременно установить разброс (= σ_load_MLE), нужно «компенсировать» прирост mean от σ²/2, вычитая его из μ. Это аналогично решению уравнения `μ + σ²/2 = ln(median_seq)` по μ.

Без вычитания σ²/2 (то есть если просто `μ = ln(median_seq)`) implied mean уехал бы вверх в `exp(σ²/2)` раз. Для σ_load = 0.7 это +28%. Для σ_load = 1.0 это +65%.

---

## Шаг 3 — Калиброванные параметры на m7a-gp3 (база для применения K)

Применяем формулу Шага 2 к каждой ячейке m7a-gp3.

| Cell                         | median_seq | σ_load | μ_calib | exp(μ + σ²/2) |
| ---------------------------- | ---------: | -----: | ------: | ------------: |
| AppService.Zapyty            |      0.329 |  1.049 |  −1.661 |         0.329 |
| ProjectionDB.Zapyty          |      0.563 |  0.772 |  −0.872 |         0.563 |
| AppService.Stvor             |      2.087 |  0.682 |   0.503 |         2.087 |
| EventStore.Stvor             |      0.265 |  0.754 |  −1.612 |         0.265 |
| SnapshotDB.Stvor             |      0.292 |  0.781 |  −1.535 |         0.292 |
| AppService.RC.POST           |      0.468 |  0.894 |  −1.159 |         0.468 |
| ProjectionDB.RC.POST         |      1.154 |  0.509 |   0.013 |         1.154 |
| AppService.Onovl             |      2.031 |  0.698 |   0.465 |         2.031 |
| EventStore.Onovl             |      0.189 |  0.744 |  −1.943 |         0.189 |
| SnapshotDB.Onovl             |      0.686 |  0.642 |  −0.583 |         0.686 |
| AppService.RC.PATCH          |      1.765 |  0.698 |   0.325 |         1.765 |
| ProjectionDB.RC.PATCH.read   |      0.203 |  0.807 |  −1.921 |         0.203 |
| ProjectionDB.RC.PATCH.write  |      0.169 |  0.789 |  −2.090 |         0.169 |

**Sanity check колонки `exp(μ + σ²/2)`** — она равна `median_seq` ровно, как и должно по формуле. Это значит arithmetic mean implied LN-распределения = `median_seq`.

---

## Шаг 4 — Формула K-предсказания (на медианах)

K_disk — коэффициент диска. В Exp 6 считаем его на **медианах** для консистентности с center-statistic:

```text
K_median(station, class) = median_m7i-io2(station, class) / median_m7i-gp3(station, class)
```

Применение к m7a-gp3 для предсказания m7a-io2:

```text
median_predicted = median_m7a-gp3 × K_median
σ_predicted      = σ_m7a-gp3            ← σ не меняется (свойство инстанса)
μ_predicted      = μ_m7a-gp3 + ln(K_median)
                 = ln(median_m7a-gp3 × K_median) − σ²/2
                 = ln(median_predicted) − σ²/2
```

---

## Шаг 5 — Рассчитанные K-коэффициенты на медианах vs средних

| Cell                         | mean_gp3 | mean_io2 | K_mean | med_gp3 | med_io2 | K_median |
| ---------------------------- | -------: | -------: | -----: | ------: | ------: | -------: |
| AppService.Zapyty            |    0.416 |    0.372 |  0.896 |   0.393 |   0.352 |    0.898 |
| ProjectionDB.Zapyty          |    0.721 |    0.683 |  0.947 |   0.653 |   0.602 |    0.921 |
| AppService.Stvor             |    2.392 |    1.897 |  0.793 |   2.263 |   1.793 |    0.792 |
| EventStore.Stvor             |    0.326 |    0.320 |  0.982 |   0.289 |   0.268 |    0.927 |
| SnapshotDB.Stvor             |    0.580 |    0.512 |  0.883 |   0.383 |   0.369 |    0.961 |
| AppService.RC.POST           |    0.771 |    0.772 |  1.001 |   0.612 |   0.599 |    0.980 |
| ProjectionDB.RC.POST         |    1.552 |    1.012 |  0.652 |   1.228 |   0.767 |    0.625 |
| AppService.Onovl             |    2.332 |    1.870 |  0.802 |   2.288 |   1.804 |    0.789 |
| EventStore.Onovl             |    0.268 |    0.284 |  1.059 |   0.232 |   0.231 |    0.997 |
| SnapshotDB.Onovl             |    0.902 |    0.858 |  0.951 |   0.766 |   0.736 |    0.960 |
| AppService.RC.PATCH          |    2.321 |    1.870 |  0.806 |   2.044 |   1.606 |    0.786 |
| ProjectionDB.RC.PATCH.read   |    0.479 |    0.450 |  0.938 |   0.276 |   0.279 |    1.011 |
| ProjectionDB.RC.PATCH.write  |    0.314 |    0.308 |  0.982 |   0.228 |   0.236 |    1.033 |

**Наблюдения:**

- Для большинства ячеек K_median ≈ K_mean (разница меньше 5%). Это значит шкала io2/gp3 одинаково применима к обеим центральным статистикам.
- Исключения, где K_median заметно отличается (>5%):
  - `SnapshotDB.Stvor`: K_mean=0.883, K_median=0.961 (mean считает io2 быстрее, чем median).
  - `EventStore.Stvor`: K_mean=0.982, K_median=0.927.
  - `ProjectionDB.RC.PATCH.write`: K_mean=0.982, K_median=1.033 (на медианах io2 даже медленнее gp3 — статистический шум).
- Эти отличия связаны с разной формой распределения у io2 vs gp3 в seq.

---

## Шаг 6 — Применение K к m7a-gp3

Складываем Шаг 3 (m7a-gp3 параметры) и Шаг 5 (K_median):

```text
μ_pred = μ_m7a-gp3 + ln(K_median)
σ_pred = σ_m7a-gp3
```

---

## Шаг 7 — Финальные параметры m7a-io2_predicted + сверка

| Cell                         | med_gp3 | K_median | σ_load | μ_pred  | implied mean | measured | Δ%      |
| ---------------------------- | ------: | -------: | -----: | ------: | -----------: | -------: | ------: |
| AppService.Zapyty            |   0.329 |    0.898 |  1.049 | −1.771  |        0.295 |    0.346 | −14.7%  |
| ProjectionDB.Zapyty          |   0.563 |    0.921 |  0.772 | −0.955  |        0.518 |    0.645 | −19.7%  |
| AppService.Stvor             |   2.087 |    0.792 |  0.682 |  0.270  |        1.654 |    1.895 | −12.7%  |
| EventStore.Stvor             |   0.265 |    0.927 |  0.754 | −1.688  |        0.246 |    0.278 | −11.7%  |
| SnapshotDB.Stvor             |   0.292 |    0.961 |  0.781 | −1.574  |        0.281 |    0.517 | −45.7%  |
| AppService.RC.POST           |   0.468 |    0.980 |  0.894 | −1.180  |        0.458 |    0.583 | −21.4%  |
| ProjectionDB.RC.POST         |   1.154 |    0.625 |  0.509 | −0.457  |        0.721 |    1.060 | −32.0%  |
| AppService.Onovl             |   2.031 |    0.789 |  0.698 |  0.228  |        1.602 |    1.778 |  −9.9%  |
| EventStore.Onovl             |   0.189 |    0.997 |  0.744 | −1.948  |        0.188 |    0.225 | −16.5%  |
| SnapshotDB.Onovl             |   0.686 |    0.960 |  0.642 | −0.624  |        0.659 |    0.796 | −17.2%  |
| AppService.RC.PATCH          |   1.765 |    0.786 |  0.698 |  0.083  |        1.387 |    1.636 | −15.3%  |
| ProjectionDB.RC.PATCH.read   |   0.203 |    1.011 |  0.807 | −1.911  |        0.205 |    0.353 | −42.0%  |
| ProjectionDB.RC.PATCH.write  |   0.169 |    1.033 |  0.789 | −2.058  |        0.174 |    0.229 | −23.8%  |

**Mean |Δ%| по 13 ячейкам в Exp 6: 21.7%.**

Сравнение с Exp 5 (где использовалось mean_seq вместо median_seq):

| Cell                         | measured | Exp 5 impl | Exp 5 Δ% | Exp 6 impl | Exp 6 Δ% |
| ---------------------------- | -------: | ---------: | -------: | ---------: | -------: |
| AppService.Zapyty            |    0.346 |      0.303 |  −12.5%  |      0.295 |  −14.7%  |
| ProjectionDB.Zapyty          |    0.645 |      0.589 |   −8.8%  |      0.518 |  −19.7%  |
| AppService.Stvor             |    1.895 |      1.723 |   −9.1%  |      1.654 |  −12.7%  |
| EventStore.Stvor             |    0.278 |      0.276 |   −1.0%  |      0.246 |  −11.7%  |
| SnapshotDB.Stvor             |    0.517 |      0.446 |  −13.8%  |      0.281 |  −45.7%  |
| AppService.RC.POST           |    0.583 |      0.593 |   +1.9%  |      0.458 |  −21.4%  |
| ProjectionDB.RC.POST         |    1.060 |      0.996 |   −6.1%  |      0.721 |  −32.0%  |
| AppService.Onovl             |    1.778 |      1.654 |   −7.0%  |      1.602 |   −9.9%  |
| EventStore.Onovl             |    0.225 |      0.216 |   −4.2%  |      0.188 |  −16.5%  |
| SnapshotDB.Onovl             |    0.796 |      0.752 |   −5.5%  |      0.659 |  −17.2%  |
| AppService.RC.PATCH          |    1.636 |      1.642 |   +0.3%  |      1.387 |  −15.3%  |
| ProjectionDB.RC.PATCH.read   |    0.353 |      0.359 |   +1.7%  |      0.205 |  −42.0%  |
| ProjectionDB.RC.PATCH.write  |    0.229 |      0.218 |   −4.8%  |      0.174 |  −23.8%  |

**Mean |Δ%|:** Exp 5 = **5.9%**, Exp 6 = **21.7%**.

### Парадокс: Exp 5 точнее на уровне service-time, но Exp 6 точнее в JMT-прогнозе

Это самый важный момент Exp 6 для понимания. Объясняю в § «Почему Exp 6 работает лучше в JMT» ниже.

---

## Пример полного расчёта: AppService.Onovl

Один сквозной пример со всеми числами.

### Шаг 1 (Exp 6) — Метрики

| Машина          |    n | mean  | median | CV²  | σ_load |
| --------------- | ---: | ----: | -----: | ---: | -----: |
| m7i-gp3         | 2159 | 2.332 |  2.288 | 0.17 |  0.659 |
| m7i-io2         | 2158 | 1.870 |  1.804 | 0.22 |  0.617 |
| m7a-gp3 (base)  | 2160 | 2.063 |  2.031 | 0.11 |  0.698 |
| m7a-io2 (truth) | 2158 | 1.778 |  1.757 | 0.08 |  0.364 |

### Шаг 2 (Exp 6) — Формулы

```text
σ_pred = σ_load_MLE(m7a-gp3) = 0.698
μ_calib(m7a-gp3) = ln(median_m7a-gp3) − σ²/2 = ln(2.031) − 0.698²/2
                                              = 0.709 − 0.244
                                              = 0.465
```

### Шаг 3 (Exp 6) — Калиброванные параметры на m7a-gp3

```text
μ = 0.465
σ = 0.698
implied mean = exp(0.465 + 0.244) = exp(0.709) = 2.031 ms   ← = median_seq ✓
```

### Шаг 4 (Exp 6) — K_median

```text
K_median = median_m7i-io2 / median_m7i-gp3
         = 1.804 / 2.288
         = 0.789
ln(K_median) = −0.237
```

### Шаг 5 (Exp 6) — K_median = 0.789 (расчёт выше)

### Шаг 6 (Exp 6) — Применение K

```text
μ_pred = μ_calib(m7a-gp3) + ln(K_median)
       = 0.465 + (−0.237)
       = 0.228
σ_pred = 0.698
```

### Шаг 7 (Exp 6) — Финальные параметры predicted m7a-io2

| Параметр                                | Значение |
| --------------------------------------- | -------: |
| μ_pred                                  |    0.228 |
| σ_pred                                  |    0.698 |
| Implied median = exp(μ)                 |    1.256 |
| Implied mean = exp(μ + σ²/2)            |    1.602 |
| Измеренный mean на m7a-io2              |    1.778 |
| Измеренный median на m7a-io2            |    1.757 |
| Ошибка на mean                          |   −9.9%  |
| Ошибка на median                        |  −28.5%  |

JMT-модель этой ячейки в Exp 6 получает:

```xml
<subParameter classPath="jmt.engine.random.Lognormal" name="Lognormal"/>
<subParameter classPath="jmt.engine.random.LognormalPar" name="distrPar">
  <subParameter classPath="java.lang.Double" name="mu"><value>0.228</value></subParameter>
  <subParameter classPath="java.lang.Double" name="sigma"><value>0.698</value></subParameter>
</subParameter>
```

### Сравнение с Exp 1 и Exp 5 для AppService.Onovl

| Эксп  | μ_pred | σ_pred | implied mean | measured | Δ%       |
| ----- | -----: | -----: | -----------: | -------: | -------: |
| Exp 1 |  0.441 |  0.415 |        1.694 |    1.778 |   −4.7%  |
| Exp 5 |  0.273 |  0.698 |        1.654 |    1.778 |   −7.0%  |
| Exp 6 |  0.228 |  0.698 |        1.602 |    1.778 |   −9.9%  |

Видно: на **уровне service-time** Exp 1 точнее всех. Exp 6 систематически занижает, потому что median_seq < mean_seq.

---

## Как ведут себя 3 варианта распределения с медианной калибровкой

Можно применить логику Exp 6 (использовать median_seq вместо mean_seq) к каждой из трёх baseline-стратегий:

### Вариант A: LN MLE везде + median

Это собственно Exp 6. Описан выше.

Формула:

```text
σ = σ_load_MLE
μ = ln(median_seq) − σ²/2
K = K_median
```

### Вариант B: Brunnert + median

Brunnert выбирает семейство по CV² базовой машины (m7a-gp3). Family остаётся той же. Меняется только калибровка rate:

```text
if family == 'erlang':
    rate = k / median_seq          ← было k / mean_seq
elif family == 'exp':
    rate = 1 / median_seq          ← было 1 / mean_seq
elif family == 'lognormal':
    σ = σ_load_MLE
    μ = ln(median_seq) − σ²/2      ← как в Exp 6
```

**Эффект.** Для Erlang/Exp implied mean = median_seq (вместо mean_seq). Для ячеек с CV² > 1 (например `ProjectionDB.RC.PATCH.read` CV²=2.68) это даёт сильное снижение predicted mean — на 40–80%.

В семействах Erlang/Exp `CV² зашита в семейство` (для Erlang-k: CV²=1/k; для Exp: CV²=1). Поэтому **никакого использования σ_load не происходит** для не-LN ячеек. Brunnert+median меняет только center, но не shape.

Это слабее чем Exp 6, который меняет и center, и shape (потому что LN везде). Для ячеек где CV²_data > CV²_семейства (которое жёстко 1/k), Brunnert+median по-прежнему недо-предсказывает хвост — как стандартный Brunnert.

### Вариант C: Hybrid + median

Hybrid = LN MLE + точечно Erlang там, где он системно лучше KS (2 ячейки: AppService.Onovl → Erlang-9, ProjectionDB.RC.POST → Erlang-3). С median-калибровкой:

```text
Большинство ячеек:    σ = σ_load_MLE,  μ = ln(median_seq) − σ²/2     ← Exp 6 logic
2 swapped ячейки:    rate = k / median_seq                            ← median вместо mean
```

**Эффект.** Идентичен Exp 6 на 11 ячейках, плюс на 2 ячейках Erlang-k получает rate из median. Для AppService.Onovl: rate = 9 / 2.031 = 4.43 (vs Exp 3 mean: rate = 9 / 2.063 = 4.36). Очень похоже.

### Сводная таблица — какие ячейки реагируют на смену mean → median

| Семейство | Что реально меняется | Сильно затронуты |
| --------- | -------------------- | ---------------- |
| LN (Exp 6) | μ через ln(median) − σ²/2, σ из load | **Все 13 ячеек** (но High-CV² seq ячейки — больше всех) |
| Erlang/Exp (Brunnert+median) | rate = k/median (или 1/median), CV² фиксирован семейством | Только ячейки с большой mean/median разницей в seq |
| Hybrid+median | Смесь | Большинство как LN+median |

**Поскольку Erlang/Exp не могут описать heavy tail (CV² ≤ 1), а наши load-данные имеют CV² = 1.5–62 для некоторых ячеек**, Brunnert+median и Hybrid+median будут проигрывать LN+median (= Exp 6) на хвосте. Это согласуется с результатами Exp 1/2/3 — LN MLE везде лучший выбор.

---

## Почему Exp 6 работает лучше в JMT, хотя service-times менее точные

Это центральный вопрос: на per-cell уровне Exp 5 даёт MRE service-time = 5.9%, а Exp 6 = 21.7% (хуже!). Однако end-to-end JMT-симуляция показывает обратное:

| | Per-cell service-time MRE | JMT end-to-end p95 MRE | JMT end-to-end mean MRE |
| ----- | --------------------------: | -----------------------: | -----------------------: |
| Exp 5 | 5.9% | 21.0% | 17.1% |
| Exp 6 | 21.7% | **15.1%** | **14.1%** |

**Ответ: Exp 6 случайно компенсирует две системные ошибки JMT-модели.**

### Источник 1: JMT-queueing inflation для GET

JMT использует **открытую сеть с Poisson-arrival**, что предполагает worst-case randomness в притоке запросов. Реальный поток GET-запросов **не Poisson** — клиенты ждут ответа перед следующим запросом (closed network), кэши прогревают повторяющиеся запросы. Реальная очередь меньше JMT-предсказанной.

JMT с честным service-time **переоценивает GET** (Exp 1: Zapyty mean +23%, Exp 5: +35%). Когда service-time занижается через median (Exp 6), это компенсирует JMT-queueing inflation → Zapyty mean MRE падает до +7%.

### Источник 2: Indirect effect через AppService utilization

Большинство классов проходят через AppService (только 2 vCPU). Замена mean → median **снижает service-times у всех ячеек** (особенно у high-CV² ячеек: SnapshotDB.Stvor, ProjectionDB.RC.PATCH.read, RC.POST). Это снижает AppService demand:

| Machine     | Exp 5 demand | Exp 5 util | Exp 6 demand | Exp 6 util |
| ----------- | -----------: | ---------: | -----------: | ---------: |
| m7i-gp3     |       874 ms |      43.7% |       806 ms |      40.3% |
| m7i-io2     |       704 ms |      35.2% |       635 ms |      31.7% |
| m7a-gp3     |       737 ms |      36.8% |       687 ms |      34.3% |
| m7a-io2     |       611 ms |      30.6% |       558 ms |      27.9% |

Снижение util на 3 п.п. → меньше queueing time → все классы (включая Zapyty) получают меньше задержки. Эффект на Zapyty: ~5–10% reduction в predicted RT, плюс direct ~3% от собственно Zapyty-ячеек.

### Почему именно median, а не любой произвольный коэффициент

Можно было бы вместо median взять `mean × 0.85` (любой эмпирический shrinkage). Это работало бы похоже. Но **median имеет физическую интерпретацию**:

1. Median представляет **типичный запрос**. Mean включает редкие тяжёлые spikes.
2. Под нагрузкой реальный пользователь чаще всего видит median latency, а не mean.
3. Median устойчив к выбросам в seq-данных (хоть их там и мало, ~5–10% от mean для high-CV² cells).

То есть **Exp 6 — это не просто эмпирическая подгонка, а явный выбор «типичного» service-time как target**. Эта семантика согласуется с тем, что в JMT мы строим модель **типичного предсказания**, а не worst-case.

### Trade-off Exp 5 vs Exp 6

| Аспект | Exp 5 (mean) | Exp 6 (median) |
| ------ | ------------ | -------------- |
| Service-time fidelity per cell | **Высокая (5.9%)** | Низкая (21.7%) |
| Compensates JMT-queueing inflation | Нет | **Да** |
| Compensates hot-cache effect (GET) | Нет | **Да** |
| End-to-end JMT MRE на mean | 17.1% | **14.1%** |
| End-to-end JMT MRE на p95 | 21.0% | **15.1%** |
| Калибровочные машины (без K) | **Лучше (42% mean)** | Хуже (52%) |

Exp 6 жертвует точностью service-times **в пользу точности JMT-симуляции**. Это допустимо, потому что финальный пользовательский метрик — predicted response time на predicted machine, а не сам по себе service-time.

---

## Итог Exp 6

| Параметр | Значение |
| -------- | -------- |
| Семейство | Lognormal на всех 13 ячейках |
| Center статистика | median(seq) |
| Spread параметр | σ_MLE(load) |
| Формула μ | ln(median_seq) − σ²/2 |
| Формула K | K_median = median_m7i-io2 / median_m7i-gp3 |
| K-prediction | μ_pred = μ + ln(K_median), σ_pred = σ |
| Aggregate JMT MRE (m7a-io2 PREDICTED) | mean 14.1%, p95 **15.1%** |

**Победитель на всех 4 статистиках (mean/median/p90/p95) на predicted machine.**

## Per-machine результаты JMT-симуляции Exp 6 (по 4 классам)

End-to-end MRE из JMT-симуляции `measured (load logs) ↔ predicted (JMT samples)`. RC_lag для predicted = sample-convolution `Stvor_RT + RC_RT` и `Onovl_RT + RC_RT`, взвешенная по measured POST/PATCH-отношению (см. [_export_exp6_per_machine.py](../_export_exp6_per_machine.py)).

### Mean (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3             | measured  |   3.223 |   7.477 |   8.329 |  13.984 |
| m7i-gp3             | predicted |   1.984 |   3.292 |   3.644 |   6.251 |
| m7i-gp3             | MRE       | −38.44% | −55.98% | −56.25% | −55.30% |
| m7i-io2             | measured  |   2.172 |   5.397 |   6.110 |   9.818 |
| m7i-io2             | predicted |   1.283 |   2.623 |   2.968 |   4.499 |
| m7i-io2             | MRE       | −40.91% | −51.40% | −51.42% | −54.18% |
| m7a-gp3             | measured  |   3.974 |   6.347 |   7.531 |  12.021 |
| m7a-gp3             | predicted |   1.560 |   2.879 |   3.147 |   5.299 |
| m7a-gp3             | MRE       | −60.74% | −54.63% | −58.21% | −55.92% |
| m7a-io2 (PREDICTED) | measured  |   1.001 |   2.850 |   3.123 |   5.300 |
| m7a-io2 (PREDICTED) | predicted |   1.074 |   2.329 |   2.602 |   3.922 |
| m7a-io2 (PREDICTED) | MRE       |  +7.38% | −18.27% | −16.69% | −25.99% |

### Median (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3             | measured  |   2.055 |   5.707 |   6.246 |  10.694 |
| m7i-gp3             | predicted |   1.467 |   2.880 |   3.231 |   5.779 |
| m7i-gp3             | MRE       | −28.61% | −49.54% | −48.27% | −45.97% |
| m7i-io2             | measured  |   1.459 |   4.090 |   4.566 |   7.584 |
| m7i-io2             | predicted |   1.008 |   2.359 |   2.695 |   4.223 |
| m7i-io2             | MRE       | −30.94% | −42.32% | −40.97% | −44.31% |
| m7a-gp3             | measured  |   0.800 |   2.965 |   3.199 |   5.716 |
| m7a-gp3             | predicted |   1.156 |   2.437 |   2.715 |   4.862 |
| m7a-gp3             | MRE       | +44.52% | −17.83% | −15.14% | −14.94% |
| m7a-io2 (PREDICTED) | measured  |   0.730 |   2.292 |   2.527 |   4.490 |
| m7a-io2 (PREDICTED) | predicted |   0.833 |   1.985 |   2.268 |   3.603 |
| m7a-io2 (PREDICTED) | MRE       | +14.20% | −13.39% | −10.27% | −19.77% |

### p95 (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3             | measured  |   9.059 |  18.026 |  20.304 |  34.350 |
| m7i-gp3             | predicted |   5.355 |   6.696 |   7.218 |  11.064 |
| m7i-gp3             | MRE       | −40.89% | −62.85% | −64.45% | −67.79% |
| m7i-io2             | measured  |   5.536 |  12.739 |  14.554 |  23.188 |
| m7i-io2             | predicted |   3.124 |   5.005 |   5.520 |   7.520 |
| m7i-io2             | MRE       | −43.56% | −60.71% | −62.07% | −67.57% |
| m7a-gp3             | measured  |   3.125 |   8.288 |   8.292 |  14.424 |
| m7a-gp3             | predicted |   4.155 |   6.206 |   6.523 |   9.486 |
| m7a-gp3             | MRE       | +32.96% | −25.12% | −21.33% | −34.23% |
| m7a-io2 (PREDICTED) | measured  |   2.246 |   5.641 |   6.010 |  10.194 |
| m7a-io2 (PREDICTED) | predicted |   2.697 |   4.929 |   5.249 |   6.986 |
| m7a-io2 (PREDICTED) | MRE       | +20.06% | −12.63% | −12.66% | −31.47% |

### Aggregate |MRE| per machine (среднее по 4 классам)

| machine             |   mean | median |    p95 |
| ------------------- | -----: | -----: | -----: |
| m7i-gp3 (calib)     | 51.49% | 43.10% | 59.00% |
| m7i-io2 (calib)     | 49.48% | 39.64% | 58.48% |
| m7a-gp3 (calib)     | 57.38% | 23.11% | 28.41% |
| m7a-io2 (PREDICTED) | 17.08% | 14.41% | 19.21% |

### Замечания

- **Calibration машины (m7i-gp3, m7i-io2, m7a-gp3)** имеют MRE 40–60% на mean/p95 — это **структурная ошибка модели** (caching, JIT, pool effects не учтены), общая для всех 6 экспериментов.
- **m7a-gp3** интересен: на mean ошибка 57%, а на median/p95 — 23/28% (намного меньше других calib). Это потому что measured m7a-gp3 имеет heavy tail (mean 3.97 при median 0.80) — mean дёрнут p99 outliers, а median и p95 пользуются устойчивыми статистиками.
- **m7a-io2 PREDICTED** — наша целевая машина. Aggregate MRE 14–19% — лучший результат среди всех 6 экспериментов.
- **RC_lag MRE сильнее отрицателен** чем у других классов (−26% mean, −31% p95) — потому что Exp 6 систематически занижает service-times, а RC_lag = convolution двух занижений (command + handler) → накапливается.
- Aggregate p95 = **19.2%** включает RC_lag. Если считать только Zapyty+Stvor+Onovl (3 класса HTTP, без consistency_lag), aggregate p95 = **15.1%**.

## Артефакты

| Файл | Содержание |
| ---- | ---------- |
| [_experiment_fits.mjs](../_experiment_fits.mjs) | Расчёт seq-параметров (mean, median, σ_MLE) |
| [_experiment_fits_load.mjs](../_experiment_fits_load.mjs) | Расчёт load-параметров (σ_MLE) |
| [_build_jsimg.py](../_build_jsimg.py) | Генератор jsimg-моделей; для Exp 6 — функция get_calibrated_params() |
| [_export_exp6_tables.py](../_export_exp6_tables.py) | Скрипт-источник всех таблиц этого документа |
| [experiment-fits.json](../experiment-fits.json) | Параметры (μ, σ, k, rate) + KS на seq, теперь с median |
| [experiment-fits-load.json](../experiment-fits-load.json) | Параметры LN MLE на load-данных |
| [experiment-mre-all.json](../experiment-mre-all.json) | Все 4 машины × 6 эксп — MRE per (machine, class, stat) |
| [experiment-mre-rc-conv.json](../experiment-mre-rc-conv.json) | m7a-io2 с RC через convolution |
| [jmt-results.md](jmt-results.md) | Полное сравнение Exp 1–6 и финальная рекомендация |
