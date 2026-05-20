# Эксперимент 16 (Classical CQRS): Exp 12 + Processor Sharing на AppService

Документ описывает шаг за шагом, как из seq + load логов мы получаем параметры
JMT-моделей в Exp 16 для **варианта Classical CQRS** и используем их для
предсказания m7a-io2.

Exp 16 = **Exp 12 (Classical)** + **Processor Sharing (PS)** на AppService
вместо FCFS, **с m7i, перекалиброванной под PS** (как в Manual CQRS). База
service-time идентична [exp12-classical-design.md](exp12-classical-design.md);
меняется дисциплина обслуживания узла AppService и под неё заново подобрана
m7i-калибровка. Структура — как в [exp6-design.md](exp6-design.md).

> **Главный результат для Classical.** PS-перекалибровка чинит fit
> калибровочных m7i-машин (median: m7i-gp3 8.75 % → **2.78 %**,
> m7i-io2 5.64 % → **1.63 %**), но **predicted-машина m7a-io2 не меняется**
> (median 14.07 % → 14.09 %, p95 27.52 % → 27.68 %). Это эмпирически
> подтверждает: PS на AppService для Classical нейтрален для целевого
> предсказания, потому что узкое место Classical — не AppService, а запись в
> EventStore + работа БД (POST/PATCH дополнительно делают `eventstore.read`
> для регидрации агрегата) на FCFS-станциях, которых PS не касается.

## Pipeline в одном виде

```text
                    ┌─────────────────────────────┐
[1] Логи seq/load → │ median_seq, σ_load_MLE      │
                    │ + per-class σ-тюнинг:       │
                    │   GET   σ ×0.85             │  ← ZAPYTY_SIGMA_FACTOR
                    │   cmd   σ ×1.30             │  ← CMD_SIGMA_FACTOR
                    └─────────┬───────────────────┘
                              │
                    ┌─────────────────────────────┐
[2] Калибровка m7a  │ μ = ln(median_seq) − σ²/2  │
                    │ GET-ячейки: median_seq ×0.75│  ← ZAPYTY_CENTER_M7A_FACTOR
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
                    │ → classical/                │
                    │   m7i_calibration_ps.json   │
                    └─────────┬───────────────────┘
                              │
                    ┌─────────────────────────────┐
[5] Топология JMT   │ AppService = PSServer       │
                    │ 3 БД-станции = FCFS Server  │
                    └─────────────────────────────┘
```

---

## Шаг 0 — Span-алгебра Classical (отличие от m_cqrs)

В Classical CQRS обработчик команды (POST/PATCH) перед записью события
**регидрирует агрегат**, читая историю из EventStore. То есть на пути команды
появляется дополнительный `db.eventstore.read`, которого нет в Manual CQRS.

В модели этот `eventstore.read` **не выделяется в отдельную станцию**: он
редок относительно полного пути команды и по факту измерения остаётся внутри
ячейки `AppService.Stvor` / `AppService.Onovl` (span-алгебра считает
AppService-cell как `cmd+pub − ES_write − SN`, и read-часть туда уже включена
телеметрией). Подробный разбор span-алгебры — в
[exp12-classical-design.md §Шаг 0](exp12-classical-design.md).

---

## Шаг 1 — База service-time + per-class σ-тюнинг

center = `median(seq)` (fallback `mean(seq)`, если median ≤ 0 — у Classical
`SnapshotDB.Stvor` median бывает 0, т.к. снимки делаются периодически),
spread = `σ_MLE(load)`, далее **per-class σ-множитель** (`sigma_class_factor`,
`classical/_build_jsimg.py`):

```text
GET (Zapyty) ячейки:      σ ← σ × 0.85     (ZAPYTY_SIGMA_FACTOR) — тоньше хвост GET
Stvor/Onovl (cmd) ячейки: σ ← σ × 1.30     (CMD_SIGMA_FACTOR)   — толще хвост команд
```

Формула Lognormal: `μ = ln(median_seq) − σ²/2`.

---

## Шаг 2 — Дефляция GET-центра на m7a

```text
ZAPYTY_CENTER_M7A_FACTOR = 0.75            (classical/_build_jsimg.py)
median_seq(GET, m7a) ← median_seq(GET, m7a) × 0.75
```

В Classical коэффициент остаётся **0.75** (в m_cqrs он поднят до 0.87): при
0.75 медиана Zapyty на m7a-io2 не уходит в недопустимый минус, поэтому подъём
не требовался.

---

## Шаг 3 — K-предсказание m7a-io2

```text
K_median = median_m7i-io2 / median_m7i-gp3
μ_pred = μ_m7a-gp3 + ln(K_median),   σ_pred = σ_m7a-gp3
```

---

## Шаг 4 — Итеративная PS-перекалибровка m7i

Как и в Manual CQRS, m7i-модели перегоняются итеративным циклом **в
PS-топологии**, чтобы центры были согласованы с дисциплиной обслуживания
целевой модели:

```text
cd classical && python3 _calibrate_m7i.py ps
  → EXP_NAME = "exp16",  CAL_FILE = "m7i_calibration_ps.json"
  цикл: init (median_seq + σ_MOM, σ-тюнинг GET ×0.65 / cmd ×1.30)
        → build exp16 (PS) → JMT(PS) → scale ×ratio^0.7
        до |ratio−1| < 0.04 (сошлось на итерации 7, worst 0.006)
```

`classical/_build_jsimg.py` для m7i в exp16 читает именно этот файл:

```python
cal = (M7I_CAL_PS if experiment == "exp16" and M7I_CAL_PS
       else (M7I_CAL_V2 if experiment in ("exp13","exp14") else M7I_CAL))
```

(`M7I_CAL_PS` ← `classical/m7i_calibration_ps.json`.)

Эффект на калибровочных машинах (median aggregate): m7i-gp3 **8.75 % →
2.78 %**, m7i-io2 **5.64 % → 1.63 %**. Predicted m7a-io2 при этом практически
не сдвинулся (см. ниже) — для Classical PS на AppService нейтрален в части
целевого предсказания.

---

## Шаг 5 — Топология JMT

AppService → **`PSServer`** (Processor Sharing, 2 сервера); EventStore /
SnapshotDB / ProjectionDB → FCFS **`Server`**.

### Проверка: все 8 моделей Exp 16 на PS

| Модель (classical)              | AppService | 3 БД-станции |
| ------------------------------- | ---------- | ------------ |
| m7i-gp3-classical_cqrs_exp16    | PSServer ✓ | FCFS ×3      |
| m7i-io2-classical_cqrs_exp16    | PSServer ✓ | FCFS ×3      |
| m7a-gp3-classical_cqrs_exp16    | PSServer ✓ | FCFS ×3      |
| m7a-io2-classical_cqrs_exp16    | PSServer ✓ | FCFS ×3      |

Вместе с 4 моделями m_cqrs (см.
[exp16-m_cqrs-design.md](exp16-m_cqrs-design.md)) — все **8** jsimg Exp 16
имеют ровно 1 `PSServer` (AppService) + 3 `Server` (БД).

---

## Per-machine результаты JMT-симуляции Exp 16, Classical CQRS (по 4 классам)

End-to-end MRE `measured (load logs) ↔ predicted (JMT samples)`. RC_lag для
predicted = sample-convolution, взвешенная по measured POST/PATCH
(см. [classical/_export_exp16_per_machine.py](../classical/_export_exp16_per_machine.py)).

### Mean (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3             | measured  |   2.410 |   4.062 |   6.475 |  10.617 |
| m7i-gp3             | predicted |   2.966 |   4.519 |   7.099 |  11.040 |
| m7i-gp3             | MRE       | +23.08% | +11.26% |  +9.63% |  +3.98% |
| m7i-io2             | measured  |   2.172 |   3.290 |   5.388 |   8.787 |
| m7i-io2             | predicted |   2.246 |   3.527 |   5.543 |   8.485 |
| m7i-io2             | MRE       |  +3.41% |  +7.19% |  +2.87% |  −3.44% |
| m7a-gp3             | measured  |   1.079 |   2.415 |   3.619 |   6.084 |
| m7a-gp3             | predicted |   1.078 |   2.512 |   3.156 |   4.907 |
| m7a-gp3             | MRE       |  −0.01% |  +4.02% | −12.80% | −19.35% |
| m7a-io2 (PREDICTED) | measured  |   1.025 |   1.990 |   3.031 |   5.001 |
| m7a-io2 (PREDICTED) | predicted |   0.767 |   1.841 |   2.483 |   3.523 |
| m7a-io2 (PREDICTED) | MRE       | −25.17% |  −7.49% | −18.08% | −29.56% |

### Median (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3             | measured  |   1.570 |   2.961 |   5.009 |   8.212 |
| m7i-gp3             | predicted |   1.566 |   2.953 |   5.004 |   9.077 |
| m7i-gp3             | MRE       |  −0.25% |  −0.25% |  −0.10% | +10.53% |
| m7i-io2             | measured  |   1.498 |   2.385 |   4.146 |   6.802 |
| m7i-io2             | predicted |   1.496 |   2.396 |   4.146 |   7.202 |
| m7i-io2             | MRE       |  −0.14% |  +0.45% |  −0.02% |  +5.89% |
| m7a-gp3             | measured  |   0.775 |   2.026 |   3.060 |   5.236 |
| m7a-gp3             | predicted |   0.757 |   2.185 |   2.850 |   4.590 |
| m7a-gp3             | MRE       |  −2.37% |  +7.83% |  −6.87% | −12.33% |
| m7a-io2 (PREDICTED) | measured  |   0.780 |   1.574 |   2.548 |   4.356 |
| m7a-io2 (PREDICTED) | predicted |   0.634 |   1.615 |   2.262 |   3.320 |
| m7a-io2 (PREDICTED) | MRE       | −18.74% |  +2.64% | −11.21% | −23.77% |

### p95 (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3             | measured  |   6.711 |  10.270 |  14.763 |  25.837 |
| m7i-gp3             | predicted |  10.130 |  13.420 |  19.000 |  24.647 |
| m7i-gp3             | MRE       | +50.94% | +30.67% | +28.70% |  −4.61% |
| m7i-io2             | measured  |   5.870 |   8.232 |  12.443 |  21.779 |
| m7i-io2             | predicted |   6.539 |   9.935 |  14.184 |  18.194 |
| m7i-io2             | MRE       | +11.41% | +20.70% | +14.00% | −16.46% |
| m7a-gp3             | measured  |   2.619 |   4.838 |   6.775 |  11.787 |
| m7a-gp3             | predicted |   2.910 |   5.107 |   5.846 |   8.265 |
| m7a-gp3             | MRE       | +11.14% |  +5.57% | −13.72% | −29.88% |
| m7a-io2 (PREDICTED) | measured  |   2.431 |   4.256 |   5.780 |  10.157 |
| m7a-io2 (PREDICTED) | predicted |   1.677 |   3.656 |   4.487 |   5.766 |
| m7a-io2 (PREDICTED) | MRE       | −31.03% | −14.09% | −22.37% | −43.23% |

### Aggregate |MRE| per machine (среднее по 4 классам)

| machine             |   mean | median |    p90 |    p95 |
| ------------------- | -----: | -----: | -----: | -----: |
| m7i-gp3 (calib)     | 11.99% |  2.78% | 27.25% | 28.73% |
| m7i-io2 (calib)     |  4.23% |  1.63% | 12.37% | 15.64% |
| m7a-gp3 (calib)     |  9.05% |  7.35% | 15.41% | 15.08% |
| m7a-io2 (PREDICTED) | 20.08% | 14.09% | 22.03% | 27.68% |

---

## Замечания

- **PS-перекалибровка чинит m7i-median.** m7i-gp3 median aggregate
  8.75 % → **2.78 %**, m7i-io2 5.64 % → **1.63 %** — итеративный цикл под PS
  идеально сажает медианы калибровочных машин (Zapyty/Stvor/Onovl MRE ≈ ±0.3 %).
- **m7i p90/p95 при этом ухудшились** (gp3 p95 21.12 % → 28.73 %): под PS при
  целевой медиане хвост раздувается сильнее, чем под FCFS. Калибровка
  оптимизирует median, не p95.
- **Predicted m7a-io2 практически НЕ изменился** относительно FCFS-калибровки
  m7i: median 14.07 % → 14.09 %, p95 27.52 % → 27.68 %, mean 20.02 % →
  20.08 %. Это и есть эмпирическое доказательство: для Classical CQRS PS на
  AppService нейтрален в части целевого предсказания, потому что узкое место
  Classical (EventStore.write + БД) лежит на FCFS-станциях, а K-prediction для
  m7a-io2 определяется ими, а не AppService.
- **Zapyty недо-предсказывается** (mean −25 %, p95 −31 %): дефляция
  GET-центра ×0.75 под PS агрессивна, но поднимать её (как в m_cqrs до 0.87)
  для Classical не требовалось по медиане и оставлено как в Exp 12 для
  сопоставимости.
- **RC_lag слабейший** (p95 −43 %) — convolution-накопление занижений, как и
  в m_cqrs.

---

## Итог Exp 16 (Classical CQRS)

| Параметр | Значение |
| -------- | -------- |
| База service-time | Exp 12 Classical (median_seq + σ_load_MLE, σ-тюнинг GET ×0.85 / cmd ×1.30) |
| GET-центр m7a | × 0.75 (ZAPYTY_CENTER_M7A_FACTOR) |
| Дисциплина AppService | Processor Sharing (PSServer, 2 серв.) |
| 3 БД-станции | FCFS Server |
| m7i калибровка | итеративная **под PS** → classical/m7i_calibration_ps.json |
| K-prediction | K_median, μ_pred = μ + ln(K_median), σ_pred = σ |
| m7i (calib) median aggregate | gp3 **2.78 %**, io2 **1.63 %** |
| m7a-io2 (PREDICTED) aggregate | mean 20.08 %, median 14.09 %, p90 22.03 %, p95 27.68 % |

**Вывод:** PS-перекалибровка для Classical делает калибровочные m7i-машины
почти идеальными по медиане, но **не улучшает целевое предсказание
m7a-io2** — оно остаётся таким же, как при FCFS-калибровке. Узкое место
Classical (EventStore.write + БД) лежит на FCFS-станциях, поэтому, в отличие
от Manual CQRS, выигрыша на predicted-машине от PS нет. Для Classical
эквивалентны FCFS Exp 12 и PS Exp 16; Exp 16 сохранён для единообразия
сравнения двух вариаций.

## Артефакты

| Файл | Содержание |
| ---- | ---------- |
| [classical/_build_jsimg.py](../classical/_build_jsimg.py) | Генератор jsimg Classical; ветка exp16: PS на AppService + чтение m7i_calibration_ps.json |
| [classical/_calibrate_m7i.py](../classical/_calibrate_m7i.py) | Итеративная калибровка m7i; `ps`-вариант → m7i_calibration_ps.json/exp16 |
| [classical/_export_exp16_per_machine.py](../classical/_export_exp16_per_machine.py) | Источник всех per-machine таблиц этого документа |
| [classical/m7i_calibration_ps.json](../classical/m7i_calibration_ps.json) | PS-откалиброванные центры/σ m7i (classical) |
| [exp12-classical-design.md](exp12-classical-design.md) | База service-time + span-алгебра Classical (Шаг 0) |
| [exp16-m_cqrs-design.md](exp16-m_cqrs-design.md) | Тот же эксперимент для варианта Manual CQRS |
