# Эксперимент 12: exp11 + дефляция центра GET для m7a

Exp 12 = [Exp 11](exp11-design.md) (итеративно-калиброванные m7i, m7a = Exp 6) **плюс** точечная коррекция: центр GET-ячеек m7a умножается на `ZAPYTY_CENTER_M7A_FACTOR`, чтобы убрать переоценку Zapyty.

Структура — как [exp6-design.md](exp6-design.md): поток данных, формулы, реальные цифры на каждом шаге.

## Зачем Exp 12

В Exp 11 (= Exp 6 для m7a) GET переоценивается:

| Машина | Zapyty median MRE | Zapyty p95 MRE |
| ------ | ---: | ---: |
| m7a-gp3 (calib) | **+45.1%** | +32.3% |
| m7a-io2 (PREDICTED) | **+14.4%** | +19.3% |

Причина — `σ_load_MLE` для `AppService.Zapyty` m7a-gp3 = 1.049 (CV²_load=62 из-за GC-pause outliers). Жирный хвост + JMT-queueing раздувают предсказанный GET. Остальные классы (Stvor/Onovl/RC) и все m7i — точные (Exp 11).

**Решение:** дефлировать **центр** (median_seq) только GET-ячеек m7a. Снижение центра напрямую опускает predicted GET median (в отличие от дефляции σ, которая median поднимает — см. §«Почему центр, а не σ»).

## Pipeline в одном виде

```text
m7i-gp3, m7i-io2:  ← из m7i_calibration.json (Exp 11, не трогаем)

m7a-gp3 / m7a-io2:
  ┌────────────────────────────────────────────┐
  │ Exp 6 logic: σ = σ_load_MLE                │
  │              center = median_seq           │
  │  ┌─ если class == GET (Zapyty):            │
  │  │    center ×= ZAPYTY_CENTER_M7A_FACTOR    │ ← НОВОЕ в Exp 12
  │  └─                                         │
  │  μ = ln(center) − σ²/2                      │
  └──────────────┬─────────────────────────────┘
                 ▼
  K_median (seq-median ratio m7i, как Exp 6)
                 ▼
  m7a-io2 = m7a-gp3 × K   (GET center уже задефлирован → io2 следует)
```

---

## Шаг 1 — Проблема переоценки GET (исходные данные)

m7a Zapyty-ячейки (Exp 6 / Exp 11):

| Cell | median_seq | σ_load_MLE | CV²_load |
| ---- | ---: | ---: | ---: |
| m7a-gp3 AppService.Zapyty | 0.329 | 1.049 | 62.27 |
| m7a-gp3 ProjectionDB.Zapyty | 0.563 | 0.772 | 1.55 |

σ=1.049 у AppService.Zapyty — следствие огромного CV²_load=62 (одиночные GC-pause >100ms в load-логах). При такой σ Lognormal-хвост + M/G/c queueing в JMT систематически завышают GET-предсказание на m7a.

---

## Шаг 2 — Формула дефляции центра

Для m7a, **только GET-ячейки**:

```text
center  = median_seq × ZAPYTY_CENTER_M7A_FACTOR
σ       = σ_load_MLE                              (не меняется — форма хвоста load сохраняется)
μ       = ln(center) − σ²/2
```

Остальные классы m7a (POST/PATCH/RC) и все m7i — без изменений (Exp 11).

K-prediction для m7a-io2: μ_pred = μ_gp3 + ln(K_median). Поскольку центр GET-ячеек m7a-gp3 уже умножен на фактор, m7a-io2 наследует дефляцию автоматически через K.

### Почему центр, а не σ

Сначала пробовали дефлировать σ (×0.6). Результат: p95 улучшился (меньше хвост → меньше queueing), но **median вырос**:

```text
μ = ln(median_seq) − σ²/2
median_LN = exp(μ) = median_seq × exp(−σ²/2)
σ↓  ⟹  exp(−σ²/2)↑  ⟹  median_LN↑   ← σ-дефляция уводит median ВВЕРХ
```

Цель — снизить **median** на ~30 п.п., поэтому нужен множитель центра, не σ. Центр напрямую масштабирует всё распределение вниз.

---

## Шаг 3 — Подбор ZAPYTY_CENTER_M7A_FACTOR

Итеративно (по m7a-gp3 Zapyty median, цель ~+15%):

| Factor | m7a-gp3 median MRE | m7a-io2 median MRE | m7a-io2 p95 MRE |
| -----: | ---: | ---: | ---: |
| 1.00 (Exp 11) | +45.1% | +14.4% | +19.3% |
| **0.75 (выбран)** | **+12.8%** | **−10.2%** | **+3.3%** |

Фактор **0.75**: m7a-gp3 Zapyty median +45% → +13% (−32 п.п., цель достигнута). m7a-io2 Zapyty median +14% → −10%, p95 +19% → +3%.

Реализация: `_build_jsimg.py`, `ZAPYTY_CENTER_M7A_FACTOR = 0.75`, ветка exp12 в `get_calibrated_params()`.

---

## Шаг 4 — Пример полного расчёта: AppService.Zapyty (m7a-gp3 → m7a-io2)

### m7a-gp3 (база)

```text
median_seq = 0.329 ms
σ_load_MLE = 1.049
center = 0.329 × 0.75 = 0.247 ms
μ_gp3 (ms-space) = ln(0.247) − 1.049²/2 = −1.399 − 0.550 = −1.949
implied mean = exp(−1.949 + 0.550) = exp(−1.399) = 0.247 ms   ← = задефлированный центр ✓
```

### m7a-io2 (предсказание через K)

```text
K_median(AppService.Zapyty) = 0.898   (= Exp 6, seq-median ratio m7i)
μ_io2 = μ_gp3 + ln(0.898) = −1.949 + (−0.108) = −2.057
σ_io2 = 1.049              (σ не меняется)
implied mean = exp(−2.057 + 0.550) = 0.222 ms
```

Для сравнения: в Exp 6 (без дефляции) implied mean этой ячейки был 0.295 ms; ×0.75 → 0.221. ✓

JMT-модель (m7a-io2, секунды):

```xml
<subParameter classPath="jmt.engine.random.Lognormal" name="Lognormal"/>
<subParameter classPath="jmt.engine.random.LognormalPar" name="distrPar">
  <subParameter classPath="java.lang.Double" name="mu"><value>-8.965</value></subParameter>
  <subParameter classPath="java.lang.Double" name="sigma"><value>1.049</value></subParameter>
</subParameter>
```

(μ_s = −2.057 − ln(1000) = −8.965.)

---

## Per-machine результаты JMT-симуляции Exp 12

End-to-end MRE `measured (load) ↔ predicted (JMT)`. RC_lag predicted = sample-convolution `Stvor_RT+RC_RT` / `Onovl_RT+RC_RT`, взвешенная по measured POST/PATCH.

### Mean (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3 (calib)     | measured  |   3.223 |   7.477 |   8.329 |  13.984 |
| m7i-gp3 (calib)     | predicted |   4.105 |   7.469 |   8.114 |  13.681 |
| m7i-gp3 (calib)     | MRE       | +27.37% |  −0.10% |  −2.58% |  −2.17% |
| m7i-io2 (calib)     | measured  |   2.172 |   5.397 |   6.110 |   9.818 |
| m7i-io2 (calib)     | predicted |   2.532 |   5.079 |   5.656 |   9.367 |
| m7i-io2 (calib)     | MRE       | +16.60% |  −5.89% |  −7.43% |  −4.59% |
| m7a-gp3 (calib)     | measured  |   3.974 |   6.347 |   7.531 |  12.021 |
| m7a-gp3 (calib)     | predicted |   1.302 |   2.882 |   3.148 |   5.274 |
| m7a-gp3 (calib)     | MRE       | −67.25% | −54.59% | −58.20% | −56.13% |
| m7a-io2 (PREDICTED) | measured  |   1.001 |   2.850 |   3.123 |   5.300 |
| m7a-io2 (PREDICTED) | predicted |   0.880 |   2.313 |   2.636 |   3.966 |
| m7a-io2 (PREDICTED) | MRE       | −12.06% | −18.85% | −15.61% | −25.17% |

(m7a-gp3 Zapyty mean −67% — measured mean 3.97 аномален из-за GC-outliers, не реальная цель; см. Exp 6 §Замечания.)

### Median (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3 (calib)     | measured  |   2.055 |   5.707 |   6.246 |  10.694 |
| m7i-gp3 (calib)     | predicted |   2.209 |   5.686 |   6.204 |  11.550 |
| m7i-gp3 (calib)     | MRE       |  +7.52% |  −0.37% |  −0.67% |  +8.00% |
| m7i-io2 (calib)     | measured  |   1.459 |   4.090 |   4.566 |   7.584 |
| m7i-io2 (calib)     | predicted |   1.457 |   4.095 |   4.554 |   8.105 |
| m7i-io2 (calib)     | MRE       |  −0.16% |  +0.12% |  −0.26% |  +6.87% |
| m7a-gp3 (calib)     | measured  |   0.800 |   2.965 |   3.199 |   5.716 |
| m7a-gp3 (calib)     | predicted |   0.902 |   2.433 |   2.713 |   4.835 |
| m7a-gp3 (calib)     | MRE       | +12.85% | −17.97% | −15.19% | −15.42% |
| m7a-io2 (PREDICTED) | measured  |   0.730 |   2.292 |   2.527 |   4.490 |
| m7a-io2 (PREDICTED) | predicted |   0.655 |   1.980 |   2.299 |   3.637 |
| m7a-io2 (PREDICTED) | MRE       | −10.24% | −13.63% |  −9.05% | −19.01% |

### p95 (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3 (calib)     | measured  |   9.059 |  18.026 |  20.304 |  34.350 |
| m7i-gp3 (calib)     | predicted |  14.422 |  19.046 |  20.430 |  30.063 |
| m7i-gp3 (calib)     | MRE       | +59.20% |  +5.66% |  +0.62% | −12.48% |
| m7i-io2 (calib)     | measured  |   5.536 |  12.739 |  14.554 |  23.188 |
| m7i-io2 (calib)     | predicted |   8.278 |  11.920 |  13.213 |  19.353 |
| m7i-io2 (calib)     | MRE       | +49.52% |  −6.43% |  −9.21% | −16.54% |
| m7a-gp3 (calib)     | measured  |   3.125 |   8.288 |   8.292 |  14.424 |
| m7a-gp3 (calib)     | predicted |   3.699 |   6.218 |   6.546 |   9.448 |
| m7a-gp3 (calib)     | MRE       | +18.38% | −24.97% | −21.06% | −34.50% |
| m7a-io2 (PREDICTED) | measured  |   2.246 |   5.641 |   6.010 |  10.194 |
| m7a-io2 (PREDICTED) | predicted |   2.321 |   4.875 |   5.323 |   7.039 |
| m7a-io2 (PREDICTED) | MRE       |  +3.31% | −13.58% | −11.43% | −30.95% |

### Aggregate |MRE| per machine (среднее по 4 классам)

| machine             |   mean | median |    p95 |
| ------------------- | -----: | -----: | -----: |
| m7i-gp3 (calib)     |  8.05% |  4.14% | 19.49% |
| m7i-io2 (calib)     |  8.63% |  1.85% | 20.42% |
| m7a-gp3 (calib)     | 59.04% | 15.36% | 24.73% |
| m7a-io2 (PREDICTED) | 17.93% | **12.98%** | **14.82%** |

---

## Сравнение Exp 6 / Exp 11 / Exp 12 (m7a-io2 PREDICTED, aggregate)

| | mean | median | p95 |
| --- | ---: | ---: | ---: |
| Exp 6 / Exp 11 | 17.1% | 14.4% | 19.2% |
| **Exp 12** | 17.9% | **13.0%** | **14.8%** |

Дефляция GET-центра на m7a улучшила m7a-io2:

- p95 aggregate: **19.2% → 14.8%** (−4.4 п.п.)
- median aggregate: 14.4% → 13.0%
- Zapyty p95 MRE: +19.3% → **+3.3%**
- mean чуть хуже (+0.8 п.п.) — Zapyty mean ушёл в −12% (но measured GET mean всё равно неустойчив из-за outliers).

**m7i не тронут** (= Exp 11): Stvor/Onovl/RC mean ±0–7%, median ±0–8%.

## Что показал Exp 12

| Аспект | Результат |
| ------ | --------- |
| **m7a-io2 GET p95** | ✅ +19% → **+3%** |
| **m7a-io2 aggregate p95** | ✅ 19.2% → **14.8%** — лучший результат |
| **m7a-gp3 GET median** | ✅ +45% → +13% (−32 п.п., цель достигнута) |
| **m7i (Stvor/Onovl/RC)** | ✅ не тронут, ±0–8% (= Exp 11) |
| **m7i Zapyty** | ⚠️ остаётся +27–60% (σ=1.73 fat-tail, см. Exp 11) |
| **RC_lag m7a-io2** | ⚠️ −25…−31% (накопленная дефляция convolution, как Exp 6) |

### Заметки

- `ZAPYTY_CENTER_M7A_FACTOR = 0.75` — эмпирический коэффициент, подобранный по m7a-gp3 Zapyty median (калибровочная машина, ground truth есть). Это **легитимная калибровка**: фактор фитится на m7a-gp3 (где load измерен), затем через K-prediction переносится на m7a-io2.
- Фактор затрагивает **только GET** на m7a. POST/PATCH/RC m7a и все m7i — без изменений.
- При желании сместить m7a-io2 GET median ближе к нулю можно ослабить фактор до ~0.80 (m7a-gp3 ~+18%, m7a-io2 ~−3%). 0.75 выбран ради заданного снижения m7a-gp3 на ~30 п.п.

## Артефакты

| Файл | Содержание |
| ---- | ---------- |
| [_build_jsimg.py](../_build_jsimg.py) | `ZAPYTY_CENTER_M7A_FACTOR`, ветка exp12 в get_calibrated_params() |
| [_calibrate_m7i.py](../_calibrate_m7i.py) | Итеративная калибровка m7i (Exp 11, используется как есть) |
| [m7i_calibration.json](../m7i_calibration.json) | Сошедшиеся m7i центры (= Exp 11) |
| [_export_exp12_per_machine.py](../_export_exp12_per_machine.py) | Источник per-machine таблиц этого документа |
| [exp11-design.md](exp11-design.md) | Базовая модель (Exp 12 = Exp 11 + GET-дефляция m7a) |
| [exp6-design.md](exp6-design.md) | m7a-логика (Exp 12 m7a POST/PATCH/RC = Exp 6) |
| [jmt-results.md](jmt-results.md) | Сравнение всех экспериментов |
