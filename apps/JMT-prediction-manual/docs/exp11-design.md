# Эксперимент 11: итеративная калибровка m7i-моделей (m7a = Exp 6)

Документ описывает, как мы строим JMT-модели для m7i-машин **итеративной калибровкой** — подгоняя service-times так, чтобы JMT-выход воспроизводил измеренный load. Модели m7a (база m7a-gp3 + предсказание m7a-io2) при этом **не трогаются** — они остаются как в [Exp 6](exp6-design.md).

Структура аналогична [exp6-design.md](exp6-design.md): поток данных и расчёты с реальными цифрами на каждом шаге.

## Зачем Exp 11

Exp 6 отлично предсказывает m7a-io2 (~17% MRE), но катастрофически промахивается на **калибровочных m7i-машинах** (mean MRE ~50%, см. [exp6-design.md §Замечания](exp6-design.md)). Причина — Intel HT contention: под нагрузкой m7i в 1.5–3× медленнее seq, чего seq-калибровка физически не видит.

Exp 9/10 (per-machine seq_mean + MOM σ, σ-множители) частично починили GET на m7i, но POST/PATCH остались −45%. Единый σ-множитель ломал уже-хороший GET (Exp 10).

**Решение Exp 11:** не угадывать формулу, а **итеративно подогнать** service-times m7i под измеренный load (m7i — калибровочные машины, K не применяется → подгонка чистая и корректная).

## Pipeline в одном виде

```text
m7i-машины (итеративная калибровка):

  [1] seq median (центр-старт) ─┐
  [2] σ = √ln(1+CV²_load) (MOM) ─┤
                                 ▼
                    ┌────────────────────────────┐
                    │ build jsimg → run JMT      │◄──┐
                    └──────────┬─────────────────┘   │
                               ▼                      │
                    ┌────────────────────────────┐   │ scale class
                    │ pred_median(class) vs       │   │ cells by
                    │ measured_load_median(class) │   │ ratio^0.7
                    └──────────┬─────────────────┘   │
                               └─────────────────────┘
                          (повтор пока |ratio−1| < tol)
                               ▼
                    ┌────────────────────────────┐
                    │ m7i_calibration.json       │ ← сошедшиеся центры
                    └────────────────────────────┘

m7a-машины (НЕ трогаем):

  m7a-gp3 = Exp 6 (median_seq + σ_load_MLE)
  m7a-io2 = m7a-gp3 × K_median  (K = seq-median ratio m7i, как Exp 6)
```

---

## Шаг 1 — Инициализация параметров m7i

Для каждой `(m7i-машина, station, class)` ячейки:

- **центр (старт)** = `median_seq` — пропорция времени между станциями берётся из seq (она физически осмысленна: какая доля запроса где тратится).
- **σ** = `√ln(1 + CV²_load)` — MOM-σ из load CV², чтобы форма распределения соответствовала нагрузочной.

σ при калибровке **фиксируется** (меняется только центр), потому что:

1. σ — свойство формы (разброса) под нагрузкой, оно уже измерено в load.
2. Менять и центр, и σ одновременно — недоопределённая задача (две неизвестные, один наблюдаемый median).

### m7i-gp3 стартовые параметры

| Cell | median_seq (старт) | CV²_load | σ (фикс.) |
| ---- | ---: | ---: | ---: |
| AppService.Zapyty | 0.393 | 19.17 | 1.733 |
| ProjectionDB.Zapyty | 0.653 | 0.89 | 0.797 |
| AppService.Stvor | 2.263 | 0.99 | 0.831 |
| EventStore.Stvor | 0.289 | 1.17 | 0.881 |
| SnapshotDB.Stvor | 0.383 | 1.11 | 0.863 |
| AppService.RC.POST | 0.612 | 8.14 | 1.487 |
| ProjectionDB.RC.POST | 1.228 | 0.66 | 0.713 |
| AppService.Onovl | 2.288 | 1.32 | 0.917 |
| EventStore.Onovl | 0.232 | 1.15 | 0.875 |
| SnapshotDB.Onovl | 0.766 | 0.68 | 0.719 |

(σ для AppService.Zapyty=1.733 и RC.POST=1.487 большие — у них огромный CV²_load 8–19. Это критично для остаточной проблемы Zapyty, см. ниже.)

---

## Шаг 2 — Итеративная калибровка (алгоритм)

Скрипт: [_calibrate_m7i.py](../_calibrate_m7i.py). Цикл (max 8 итераций, tol 4%, damping 0.7):

```text
1. Записать текущие центры → m7i_calibration.json
2. python _build_jsimg.py exp11   (m7i читает калибровку, m7a = Exp 6)
3. JMT-симуляция m7i-gp3 и m7i-io2
4. Для каждого class ∈ {Zapyty, Stvor, Onovl, RC}:
     ratio = measured_load_median(class) / predicted_median(class)
     factor = ratio^0.7                          (демпфированный шаг)
     умножить центр КАЖДОЙ ячейки этого класса на factor
   (пропорция между станциями класса сохраняется → из seq)
5. Если max|ratio−1| < tol → стоп, иначе на шаг 1
```

**Ключевая идея:** JMT-выход RT(class) = Σ service(cell) + queueing. Мы не знаем queueing аналитически, но JMT его считает. Масштабируя центры до совпадения с measured, мы решаем задачу обратной подгонки (fixed-point): итерация сходится, потому что queueing монотонен по service-time при фиксированной топологии.

`measured_load_median`: Zapyty/Stvor/Onovl — из `http.request.durationMs`; RC — из `event.handle.durationMs` (handler-time как proxy).

---

## Шаг 3 — Сходимость

Цикл сошёлся за 8 итераций для Stvor/Onovl/RC (|ratio−1| < 2%). Zapyty не сошёлся (осциллирует 0.88–0.91) — причина в §«Остаточная проблема».

Итоговые множители центра (seq median → converged), m7i-gp3:

| Class | cells | seq median → converged | множитель |
| ----- | ----- | --- | ---: |
| Zapyty | AppService.Zapyty, ProjectionDB.Zapyty | 0.393→0.144, 0.653→0.239 | **×0.37** (сжатие!) |
| Stvor | AppService/ES/SN.Stvor | 2.263→3.791, 0.289→0.484, 0.383→0.642 | **×1.68** |
| Onovl | AppService/ES/SN.Onovl | 2.288→3.853, 0.232→0.391, 0.766→1.291 | **×1.68** |
| RC | AppService/ProjectionDB.RC.POST | 0.612→0.743, 1.228→1.491 | **×1.21** |

**Stvor/Onovl/RC центр вырос в 1.2–1.7×** — это и есть та HT-contention надбавка, которую seq не видел. **Zapyty центр сжался ×0.37** — потому что огромная σ=1.73 + JMT-queueing уже сильно переоценивали Zapyty, цикл давил центр вниз (но не помогло, см. ниже).

---

## Шаг 4 — Сошедшиеся параметры m7i

### m7i-gp3 (converged)

| Cell | center (ms) | σ | μ (ms-space) |
| ---- | ---: | ---: | ---: |
| AppService.Zapyty | 0.144 | 1.733 | ln(0.144)−1.733²/2 = −3.439 |
| ProjectionDB.Zapyty | 0.239 | 0.797 | −1.749 |
| AppService.Stvor | 3.791 | 0.831 | 0.988 |
| EventStore.Stvor | 0.484 | 0.881 | −1.114 |
| SnapshotDB.Stvor | 0.642 | 0.863 | −0.815 |
| AppService.RC.POST | 0.743 | 1.487 | −1.403 |
| ProjectionDB.RC.POST | 1.491 | 0.713 | 0.145 |
| AppService.Onovl | 3.853 | 0.917 | 0.928 |
| EventStore.Onovl | 0.391 | 0.875 | −1.323 |
| SnapshotDB.Onovl | 1.291 | 0.719 | 0.0X |

### m7i-io2 (converged)

| Cell | center (ms) | σ |
| ---- | ---: | ---: |
| AppService.Zapyty | 0.297 | 1.774 |
| ProjectionDB.Zapyty | 0.508 | 0.829 |
| AppService.Stvor | 2.884 | 0.759 |
| EventStore.Stvor | 0.431 | 0.885 |
| SnapshotDB.Stvor | 0.593 | 0.896 |
| AppService.RC.POST | 0.989 | 1.343 |
| ProjectionDB.RC.POST | 1.266 | 0.721 |
| AppService.Onovl | 2.901 | 0.858 |
| EventStore.Onovl | 0.372 | 0.875 |
| SnapshotDB.Onovl | 1.183 | 0.776 |

μ для JMT = `ln(center_ms) − σ²/2` (затем −ln(1000) для перевода в секунды, как обычно).

---

## Шаг 5 — K-preservation и m7a-io2

**m7a-io2 НЕ зависит от калиброванных m7i-центров.** В `_build_jsimg.py` для exp11:

- m7i-машины: читают `m7i_calibration.json` (сошедшиеся центры).
- m7a-gp3 / m7a-io2: ветка Exp 6 (`median_seq` + `σ_load_MLE`).
- K для m7a-io2: `k_center="median"`, `k_fits=FITS` (seq) — то есть **K = seq-median ratio m7i-пары, идентично Exp 6**.

Поэтому m7a-io2 в Exp 11 = **точно Exp 6**. Калибровка m7i — отдельная задача (сделать m7i-модели соответствующими m7i-реальности), она не течёт в предсказание m7a-io2.

Сошедшиеся K (m7i-io2/m7i-gp3 по converged-центрам) **отличаются** от Exp 6 K (AppService.Stvor: converged K=0.76 vs Exp 6 K_median=0.79; AppService.Zapyty converged K=2.07 — шум из-за несошедшегося Zapyty). Но они **не используются** для m7a-io2 — там Exp 6 K. Это сознательное решение: m7a модель уже хорошая, не трогаем.

---

## Шаг 6 — Пример полного расчёта: AppService.Stvor (m7i-gp3)

### Старт

```text
median_seq(m7i-gp3, AppService.Stvor) = 2.263 ms
CV²_load = 0.993
σ = √ln(1 + 0.993) = √0.690 = 0.831   (фиксируется)
center₀ = 2.263 ms
```

### Итерации (Stvor class scale)

```text
iter 1: pred_median(Stvor) ≈ 3.0,  measured = 5.707  → ratio 1.90  → ×1.55
iter 2: pred ≈ 4.5,                              ...  → ×1.18
...
iter 8: pred_median(Stvor) = 5.689,  measured = 5.707 → ratio 1.00  ✓
converged center = 2.263 × 1.68 = 3.791 ms
```

(Все 3 Stvor-ячейки — AppService/EventStore/SnapshotDB.Stvor — масштабируются одним множителем 1.68, пропорция между ними = из seq.)

### Финальные параметры

```text
center = 3.791 ms,  σ = 0.831
μ = ln(3.791) − 0.831²/2 = 1.333 − 0.345 = 0.988  (ms-space)
implied mean = exp(0.988 + 0.345) = exp(1.333) = 3.79 ms ✓
```

JMT-модель ячейки:

```xml
<subParameter classPath="jmt.engine.random.Lognormal" name="Lognormal"/>
<subParameter classPath="jmt.engine.random.LognormalPar" name="distrPar">
  <subParameter classPath="java.lang.Double" name="mu"><value>-6.920</value></subParameter>
  <subParameter classPath="java.lang.Double" name="sigma"><value>0.831</value></subParameter>
</subParameter>
```

(μ в секундах = 0.988 − ln(1000) = −6.920.)

### Результат

m7i-gp3 Stvor: measured median load = 5.707 ms, predicted = 5.689 ms → **MRE −0.31%**. Калибровка попала точно.

---

## Per-machine результаты JMT-симуляции Exp 11

End-to-end MRE `measured (load) ↔ predicted (JMT)`. RC_lag predicted = sample-convolution `Stvor_RT+RC_RT` / `Onovl_RT+RC_RT`, взвешенная по measured POST/PATCH.

### Mean (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3 (calib)     | measured  |   3.223 |   7.477 |   8.329 |  13.984 |
| m7i-gp3 (calib)     | predicted |   4.131 |   7.474 |   8.122 |  13.811 |
| m7i-gp3 (calib)     | MRE       | +28.16% |  −0.04% |  −2.49% |  −1.23% |
| m7i-io2 (calib)     | measured  |   2.172 |   5.397 |   6.110 |   9.818 |
| m7i-io2 (calib)     | predicted |   2.535 |   5.085 |   5.655 |   9.312 |
| m7i-io2 (calib)     | MRE       | +16.75% |  −5.78% |  −7.45% |  −5.15% |
| m7a-gp3 (=Exp6)     | measured  |   3.974 |   6.347 |   7.531 |  12.021 |
| m7a-gp3 (=Exp6)     | predicted |   1.557 |   2.878 |   3.147 |   5.313 |
| m7a-gp3 (=Exp6)     | MRE       | −60.81% | −54.65% | −58.21% | −55.80% |
| m7a-io2 (PREDICTED) | measured  |   1.001 |   2.850 |   3.123 |   5.300 |
| m7a-io2 (PREDICTED) | predicted |   1.074 |   2.326 |   2.604 |   3.913 |
| m7a-io2 (PREDICTED) | MRE       |  +7.33% | −18.38% | −16.62% | −26.17% |

### Median (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3 (calib)     | measured  |   2.055 |   5.707 |   6.246 |  10.694 |
| m7i-gp3 (calib)     | predicted |   2.222 |   5.689 |   6.212 |  11.623 |
| m7i-gp3 (calib)     | MRE       |  +8.16% |  −0.31% |  −0.54% |  +8.68% |
| m7i-io2 (calib)     | measured  |   1.459 |   4.090 |   4.566 |   7.584 |
| m7i-io2 (calib)     | predicted |   1.469 |   4.117 |   4.565 |   8.095 |
| m7i-io2 (calib)     | MRE       |  +0.64% |  +0.66% |  −0.00% |  +6.74% |
| m7a-gp3 (=Exp6)     | measured  |   0.800 |   2.965 |   3.199 |   5.716 |
| m7a-gp3 (=Exp6)     | predicted |   1.160 |   2.438 |   2.713 |   4.863 |
| m7a-gp3 (=Exp6)     | MRE       | +45.10% | −17.80% | −15.19% | −14.93% |
| m7a-io2 (PREDICTED) | measured  |   0.730 |   2.292 |   2.527 |   4.490 |
| m7a-io2 (PREDICTED) | predicted |   0.835 |   1.989 |   2.269 |   3.585 |
| m7a-io2 (PREDICTED) | MRE       | +14.42% | −13.21% | −10.21% | −20.16% |

### p95 (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
| ------------------- | --------- | ------: | ------: | ------: | ------: |
| m7i-gp3 (calib)     | measured  |   9.059 |  18.026 |  20.304 |  34.350 |
| m7i-gp3 (calib)     | predicted |  14.540 |  19.173 |  20.520 |  30.543 |
| m7i-gp3 (calib)     | MRE       | +60.50% |  +6.36% |  +1.06% | −11.08% |
| m7i-io2 (calib)     | measured  |   5.536 |  12.739 |  14.554 |  23.188 |
| m7i-io2 (calib)     | predicted |   8.310 |  11.905 |  13.204 |  19.137 |
| m7i-io2 (calib)     | MRE       | +50.10% |  −6.54% |  −9.28% | −17.47% |
| m7a-gp3 (=Exp6)     | measured  |   3.125 |   8.288 |   8.292 |  14.424 |
| m7a-gp3 (=Exp6)     | predicted |   4.135 |   6.182 |   6.499 |   9.528 |
| m7a-gp3 (=Exp6)     | MRE       | +32.33% | −25.41% | −21.63% | −33.95% |
| m7a-io2 (PREDICTED) | measured  |   2.246 |   5.641 |   6.010 |  10.194 |
| m7a-io2 (PREDICTED) | predicted |   2.679 |   4.914 |   5.286 |   6.974 |
| m7a-io2 (PREDICTED) | MRE       | +19.27% | −12.89% | −12.05% | −31.59% |

### Aggregate |MRE| per machine (среднее по 4 классам)

| machine             |   mean | median |    p95 |
| ------------------- | -----: | -----: | -----: |
| m7i-gp3 (calib)     |  **7.98%** |  **4.42%** | 19.75% |
| m7i-io2 (calib)     |  **8.78%** |  **2.01%** | 20.85% |
| m7a-gp3 (=Exp6)     | 57.37% | 23.25% | 28.33% |
| m7a-io2 (PREDICTED) | **17.13%** | **14.50%** | **18.95%** |

---

## Что показал Exp 11

| Цель | Результат |
| ---- | --------- |
| **m7i Stvor/Onovl/RC** | ✅ mean MRE ±0–7%, median ±0–9% (Exp 6 было ~50%). Модель теперь точно отражает m7i-реальность |
| **m7i Zapyty** | ⚠️ mean +28%, p95 +60% — не сошёлся (см. ниже) |
| **m7a-io2 (target)** | ✅ 17.1% / 14.5% / 19.0% — **в точности Exp 6**, K не сломан |
| **m7a-gp3** | = Exp 6 (не трогали) |

### Остаточная проблема: Zapyty на m7i

Zapyty имеет σ=1.73 (CV²_load=19). При такой σ Lognormal-хвост чрезвычайно тяжёлый: median и mean/p95 «развязаны» — можно подогнать median (цикл целился в median: m7i-gp3 +8%, m7i-io2 +0.6% — почти попал), но mean (+28%) и p95 (+60%) при этом раздуваются жирным хвостом, который σ=1.73 неизбежно порождает. Цикл осциллировал (ratio 0.88↔0.91), не сходясь.

Без Zapyty aggregate p95 на m7i был бы ~6–17% (Stvor/Onovl/RC отлично). Zapyty в одиночку даёт +50–60%.

**Возможные фиксы Zapyty (не реализованы):**

1. σ = MLE-σ load (≈0.94) вместо MOM-σ (1.73) — тоньше хвост, mean/p95 ближе к median.
2. Калибровать Zapyty по mean (не median) — но тогда median уедет.
3. HyperExp(2) для AppService.Zapyty (cache-hit / GC-pause bimodal).

### Принципиальное замечание

Exp 11 — это **per-machine fitting калибровочных машин**, не предсказательная модель. Он показывает, что JMT-топология *способна* воспроизвести m7i-реальность, если service-times калиброваны под неё (HT-contention надбавка ×1.2–1.7 для command-классов). Предсказание m7a-io2 остаётся на Exp 6 — там сильная сторона метода (K-prediction между AMD-машинами).

## Артефакты

| Файл | Содержание |
| ---- | ---------- |
| [_calibrate_m7i.py](../_calibrate_m7i.py) | Итеративный калибровочный цикл (build→JMT→scale→repeat) |
| [m7i_calibration.json](../m7i_calibration.json) | Сошедшиеся per-cell центры + σ для m7i |
| [_build_jsimg.py](../_build_jsimg.py) | Генератор; ветка exp11 в get_calibrated_params() |
| [_export_exp11_per_machine.py](../_export_exp11_per_machine.py) | Скрипт-источник per-machine таблиц |
| [experiment-fits.json](../experiment-fits.json) | seq-параметры (median, CV²) |
| [experiment-fits-load.json](../experiment-fits-load.json) | load-параметры (CV²_load, σ_MLE) |
| [exp6-design.md](exp6-design.md) | Базовая модель m7a (Exp 11 m7a = Exp 6) |
| [jmt-results.md](jmt-results.md) | Сравнение всех экспериментов |
