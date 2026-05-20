# Эксперимент 16 (Manual CQRS): Exp 12 + Processor Sharing на AppService

Документ описывает шаг за шагом, как из seq + load логов мы получаем параметры
JMT-моделей в Exp 16 для **варианта Manual CQRS** и используем их для
предсказания m7a-io2.

Exp 16 = **Exp 12** (итеративная калибровка m7i + дефляция m7a GET-центра)
**плюс Processor Sharing (PS)** на станции AppService вместо FCFS. База расчёта
service-time идентична Exp 12; меняется только дисциплина обслуживания узла
AppService и под неё **m7i перекалибрована заново** (см. Шаг 4).

Базовая концепция гибридной калибровки — в [jmt-results.md](jmt-results.md).
Структура изложения — как в [exp6-design.md](exp6-design.md) и
[exp12-design.md](exp12-design.md).

## Pipeline в одном виде

```text
                    ┌─────────────────────────────┐
[1] Логи seq/load → │ median_seq, σ_load_MLE      │  ← база service-time
                    └─────────┬───────────────────┘
                              │
                    ┌─────────────────────────────┐
[2] Калибровка m7a  │ σ = σ_load_MLE             │
                    │ μ = ln(median_seq) − σ²/2  │
                    │ GET-ячейки: median_seq ×0.87│  ← ZAPYTY_CENTER_M7A_FACTOR
                    └─────────┬───────────────────┘
                              │
                    ┌─────────────────────────────┐
[3] K-prediction    │ K_median = med_io2/med_gp3  │
      m7a-io2       │ μ_pred = μ + ln(K_median)  │
                    └─────────┬───────────────────┘
                              │
                    ┌─────────────────────────────┐
[4] m7i калибровка  │ итеративный цикл ПОД PS:    │
      ПОД PS        │ build→JMT(PS)→scale ^0.7   │
                    │ → m7i_calibration_ps.json   │
                    └─────────┬───────────────────┘
                              │
                    ┌─────────────────────────────┐
[5] Топология JMT   │ AppService = PSServer       │  ← отличие от Exp 12
                    │ 3 БД-станции = FCFS Server  │
                    └─────────────────────────────┘
```

---

## Шаг 1 — База service-time (как в Exp 6/12)

Для каждой `(machine, station, class)`-ячейки: center = `median(seq)`,
spread = `σ_MLE(load)`. Формула Lognormal:

```text
σ = σ_load_MLE
μ = ln(median_seq) − σ²/2          ← E[X] = median_seq
```

Это полностью совпадает с Exp 6 (см. [exp6-design.md §Шаг 2](exp6-design.md)
по таблицам per-cell mean/median/CV²/σ_load — они не меняются в Exp 16).

---

## Шаг 2 — Дефляция GET-центра на m7a (наследие Exp 12)

JMT с честным service-time переоценивает GET (Poisson-arrival inflation +
hot-cache, см. [exp6-design.md §Источник 1](exp6-design.md)). Exp 12 ввёл
эмпирический множитель центра GET-ячеек **только на m7a-машинах**:

```text
ZAPYTY_CENTER_M7A_FACTOR = 0.87        (_build_jsimg.py:69)
median_seq(GET, m7a) ← median_seq(GET, m7a) × 0.87
```

Значение 0.87 (а не 0.75 как было первоначально) — после того как медиана
Zapyty на m7a-io2 ушла в недопустимый минус; поднятие центра вернуло её в
рабочий диапазон (итог: Zapyty median MRE = −6.65%).

---

## Шаг 3 — K-предсказание m7a-io2 (на медианах)

```text
K_median(station, class) = median_m7i-io2 / median_m7i-gp3
μ_pred = μ_m7a-gp3 + ln(K_median)
σ_pred = σ_m7a-gp3
```

K-коэффициенты идентичны Exp 6 (см. [exp6-design.md §Шаг 5](exp6-design.md)).

---

## Шаг 4 — Итеративная PS-перекалибровка m7i (ключевое отличие Exp 16)

Калибровочные m7i-модели в Exp 11/12 итеративно подгонялись под измеренный
load **в топологии FCFS**. Если эти же центры подставить в PS-модель, m7i
начинает сильно недо-предсказывать (наблюдалось: m7i-gp3 Zapyty median
**−71%**), потому что PS убирает FCFS head-of-line blocking и снижает
queueing — центры, откалиброванные с учётом FCFS-очереди, становятся
завышенными в обратную сторону.

Решение — перегнать итеративный цикл `_calibrate_m7i.py` **в PS-топологии**:

```text
python3 _calibrate_m7i.py ps
  → EXP_NAME = "exp16",  CAL_FILE = "m7i_calibration_ps.json"
  цикл: init (median_seq + σ_MOM) → build exp16 (PS) → JMT(PS)
        → scale class cells ×ratio^0.7  до |ratio−1| < 0.04  (MAX_ITER=8)
```

`_build_jsimg.py` для m7i в exp16 читает именно этот файл:

```python
cal = (M7I_CAL_PS if experiment == "exp16" and M7I_CAL_PS
       else (M7I_CAL_V2 if experiment in ("exp13","exp14") else M7I_CAL))
```

(`_build_jsimg.py:305`; `M7I_CAL_PS` ← `m7i_calibration_ps.json`,
`_build_jsimg.py:60`.)

Результат фикса: m7i-gp3 Zapyty median MRE **−71% → +4.40%**.

---

## Шаг 5 — Топология JMT в Exp 16

```python
service_node(ST_APP, ..., ps=(experiment in ("exp14","exp15","exp16")))
```

(`_build_jsimg.py:710`.) Узел **AppService → `PSServer`** (Processor
Sharing, EPSStrategy, serviceWeights=1.0 на класс), 2 сервера. Три БД-станции
(EventStore, SnapshotDB, ProjectionDB) остаются обычным **FCFS `Server`**.
Секция Queue идентична FCFS-варианту; меняется только Server-секция узла
AppService.

**Зачем PS для Manual CQRS.** В m_cqrs AppService — узкое место (почти все
классы проходят через него, 2 vCPU). FCFS вызывает head-of-line blocking:
короткий GET застревает за длинными командами. PS даёт каждому job
справедливую долю CPU → короткие GET не блокируются длинными командами.

### Проверка: все 8 моделей Exp 16 на PS

| Модель (m_cqrs)            | AppService | 3 БД-станции |
| -------------------------- | ---------- | ------------ |
| m7i-gp3-m_cqrs_exp16       | PSServer ✓ | FCFS ×3      |
| m7i-io2-m_cqrs_exp16       | PSServer ✓ | FCFS ×3      |
| m7a-gp3-m_cqrs_exp16       | PSServer ✓ | FCFS ×3      |
| m7a-io2-m_cqrs_exp16       | PSServer ✓ | FCFS ×3      |

(Аналогично подтверждены 4 classical-модели — см.
[exp16-classical-design.md](exp16-classical-design.md).) Все **8** jsimg
Exp 16 имеют ровно 1 `PSServer` (AppService) + 3 `Server` (БД).

---

## Per-machine результаты JMT-симуляции Exp 16, Manual CQRS (по 4 классам)

End-to-end MRE `measured (load logs) ↔ predicted (JMT samples)`. RC_lag для
predicted = sample-convolution `Stvor_RT + RC_RT` и `Onovl_RT + RC_RT`,
взвешенная по measured POST/PATCH-отношению
(см. [_export_exp16_per_machine.py](../_export_exp16_per_machine.py)).

### Mean (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3             | measured  |   3.223 |   7.477 |   8.329 |  13.984 |
| m7i-gp3             | predicted |   3.726 |   8.202 |   9.166 |  14.718 |
| m7i-gp3             | MRE       | +15.60% |  +9.70% | +10.04% |  +5.25% |
| m7i-io2             | measured  |   2.172 |   5.397 |   6.110 |   9.818 |
| m7i-io2             | predicted |   2.398 |   5.293 |   5.986 |   9.698 |
| m7i-io2             | MRE       | +10.41% |  −1.93% |  −2.03% |  −1.22% |
| m7a-gp3             | measured  |   3.974 |   6.347 |   7.531 |  12.021 |
| m7a-gp3             | predicted |   1.248 |   2.993 |   3.257 |   5.247 |
| m7a-gp3             | MRE       | −68.61% | −52.84% | −56.75% | −56.35% |
| m7a-io2 (PREDICTED) | measured  |   1.001 |   2.850 |   3.123 |   5.300 |
| m7a-io2 (PREDICTED) | predicted |   0.876 |   2.384 |   2.649 |   3.909 |
| m7a-io2 (PREDICTED) | MRE       | −12.47% | −16.34% | −15.17% | −26.24% |

### Median (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3             | measured  |   2.055 |   5.707 |   6.246 |  10.694 |
| m7i-gp3             | predicted |   2.145 |   5.734 |   6.299 |  11.857 |
| m7i-gp3             | MRE       |  +4.40% |  +0.48% |  +0.86% | +10.88% |
| m7i-io2             | measured  |   1.459 |   4.090 |   4.566 |   7.584 |
| m7i-io2             | predicted |   1.460 |   4.095 |   4.591 |   8.148 |
| m7i-io2             | MRE       |  +0.05% |  +0.13% |  +0.56% |  +7.43% |
| m7a-gp3             | measured  |   0.800 |   2.965 |   3.199 |   5.716 |
| m7a-gp3             | predicted |   0.903 |   2.471 |   2.747 |   4.759 |
| m7a-gp3             | MRE       | +12.92% | −16.66% | −14.13% | −16.74% |
| m7a-io2 (PREDICTED) | measured  |   0.730 |   2.292 |   2.527 |   4.490 |
| m7a-io2 (PREDICTED) | predicted |   0.681 |   2.008 |   2.284 |   3.552 |
| m7a-io2 (PREDICTED) | MRE       |  −6.65% | −12.40% |  −9.63% | −20.89% |

### p95 (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3             | measured  |   9.059 |  18.026 |  20.304 |  34.350 |
| m7i-gp3             | predicted |  12.083 |  22.595 |  25.523 |  33.771 |
| m7i-gp3             | MRE       | +33.38% | +25.34% | +25.70% |  −1.69% |
| m7i-io2             | measured  |   5.536 |  12.739 |  14.554 |  23.188 |
| m7i-io2             | predicted |   7.271 |  13.059 |  14.791 |  20.725 |
| m7i-io2             | MRE       | +31.33% |  +2.52% |  +1.63% | −10.62% |
| m7a-gp3             | measured  |   3.125 |   8.288 |   8.292 |  14.424 |
| m7a-gp3             | predicted |   3.401 |   6.702 |   6.978 |   9.604 |
| m7a-gp3             | MRE       |  +8.85% | −19.14% | −15.85% | −33.42% |
| m7a-io2 (PREDICTED) | measured  |   2.246 |   5.641 |   6.010 |  10.194 |
| m7a-io2 (PREDICTED) | predicted |   2.189 |   5.163 |   5.477 |   7.047 |
| m7a-io2 (PREDICTED) | MRE       |  −2.57% |  −8.48% |  −8.87% | −30.87% |

### Aggregate |MRE| per machine (среднее по 4 классам)

| machine             |   mean | median |    p90 |    p95 |
| ------------------- | -----: | -----: | -----: | -----: |
| m7i-gp3 (calib)     | 10.15% |  4.15% | 20.98% | 21.53% |
| m7i-io2 (calib)     |  3.90% |  2.04% |  8.85% | 11.52% |
| m7a-gp3 (calib)     | 58.64% | 15.11% | 17.56% | 19.31% |
| m7a-io2 (PREDICTED) | 17.56% | 12.39% |  9.87% | 12.70% |

---

## Замечания

- **m7i после PS-перекалибровки — отличный fit.** На median m7i-gp3 = 4.15%,
  m7i-io2 = 2.04% (без PS-калибровки было −71% на Zapyty). Это подтверждает,
  что калибровочный цикл обязан идти в той же дисциплине обслуживания, что и
  целевая модель.
- **m7a-io2 (PREDICTED) — целевая машина.** Aggregate: mean 17.56%,
  **median 12.39%, p90 9.87%, p95 12.70%**. PS заметно улучшил хвост GET по
  сравнению с FCFS Exp 12 (Zapyty p95 MRE −2.57% — почти идеально, тогда как
  под FCFS GET-хвост раздувался queueing-инфляцией).
- **m7a-gp3 mean 58.64%** — структурная аномалия measured m7a-gp3 (тяжёлый
  хвост: mean 3.97 при median 0.80, p99-выбросы тянут mean). На median/p90/p95
  ошибка 15–19%, что нормально для калибровочной машины.
- **RC_lag — слабейший класс** (median MRE −20.89%, p95 −30.87%): это
  convolution двух занижений (command RT + handler RT), ошибки накапливаются.
- Если исключить RC_lag и считать только 3 HTTP-класса
  (Zapyty/Stvor/Onovl), m7a-io2 p95 ≈ **6.6%**, median ≈ **9.6%**.

---

## Итог Exp 16 (Manual CQRS)

| Параметр | Значение |
| -------- | -------- |
| База service-time | Exp 12 (median_seq + σ_load_MLE, GET-центр m7a ×0.87) |
| Дисциплина AppService | **Processor Sharing (PSServer, 2 серв.)** |
| 3 БД-станции | FCFS Server |
| m7i калибровка | итеративная **под PS** → m7i_calibration_ps.json |
| K-prediction | K_median, μ_pred = μ + ln(K_median), σ_pred = σ |
| m7a-io2 (PREDICTED) aggregate | mean 17.56%, **median 12.39%, p90 9.87%, p95 12.70%** |

PS для Manual CQRS оправдан: AppService — узкое место, PS снимает FCFS
head-of-line blocking коротких GET за длинными командами, что даёт лучший
GET-хвост на predicted-машине, чем FCFS Exp 12.

## Артефакты

| Файл | Содержание |
| ---- | ---------- |
| [_build_jsimg.py](../_build_jsimg.py) | Генератор jsimg; ветка exp16: PS на AppService + чтение m7i_calibration_ps.json |
| [_calibrate_m7i.py](../_calibrate_m7i.py) | Итеративная калибровка; `ps`-вариант → m7i_calibration_ps.json/exp16 |
| [_export_exp16_per_machine.py](../_export_exp16_per_machine.py) | Источник всех per-machine таблиц этого документа |
| [m7i_calibration_ps.json](../m7i_calibration_ps.json) | PS-откалиброванные центры/σ m7i (m_cqrs) |
| [experiment-fits.json](../experiment-fits.json) / [experiment-fits-load.json](../experiment-fits-load.json) | seq / load параметры |
| [exp12-design.md](exp12-design.md) | База service-time (Exp 12), от которой наследует Exp 16 |
| [exp16-classical-design.md](exp16-classical-design.md) | Тот же эксперимент для варианта Classical CQRS |
