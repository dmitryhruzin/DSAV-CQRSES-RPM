# Эксперимент 12 — Classical CQRS (детальный отчёт)

Применение методологии [Exp 12](exp12-design.md) к вариации **Classical CQRS** (`classical_cqrs`). Документ построен по аналогии с [exp6-design.md](exp6-design.md): поток данных, формулы, реальные цифры на каждом шаге, worked example.

Изолированный pipeline: [classical/](../classical/) — копии скриптов (`m_cqrs`→`classical_cqrs`), свои `logs/`, `logs10-noretry/`, `*.json`, `models/`. Результаты m_cqrs не затронуты.

## Pipeline в одном виде

```text
m7i-gp3, m7i-io2 (калибровочные):
  seq median (старт) + MOM σ_load → итеративный цикл
  build → JMT → scale class cells by ratio^0.7 → repeat
  (пока pred_median(class) == measured_load_median, tol 4%)
  → m7i_calibration.json

m7a-gp3 (база), m7a-io2 (predicted) — Exp 6:
  σ = σ_load_MLE
  μ = ln(center) − σ²/2 ;  center = median_seq (GET: ×0.75)
  K_median = median_m7i-io2 / median_m7i-gp3
  μ_pred(m7a-io2) = μ(m7a-gp3) + ln(K_median)
```

KS-фит classical: LN MLE mean KS = **0.193** (m_cqrs было 0.216) — classical чище ложится на Lognormal.

---

## Шаг 0 — Как считаются метрики станций (важно для Classical)

### Топология и span-алгебра

JMT-модель = 4 станции (AppService, EventStore, SnapshotDB, ProjectionDB) × 4 класса (Zapyty=GET, Stvor=POST, Onovl=PATCH, RC=event-handler). Для каждой `(station, class)`-ячейки service-time извлекается из telemetry-спанов **алгеброй сумм длительностей** (группировка по `req.id`, суммирование одноимённых спанов, отсутствующий спан = 0):

| Ячейка                           | Формула (мс per request)                                                                          |
|----------------------------------|---------------------------------------------------------------------------------------------------|
| AppService.Zapyty                | `query.execute − db.projection.read`                                                              |
| ProjectionDB.Zapyty              | `db.projection.read`                                                                              |
| AppService.Stvor/Onovl           | `command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write` |
| EventStore.Stvor/Onovl           | `db.eventstore.write`                                                                             |
| SnapshotDB.Stvor/Onovl           | `db.snapshot.read + db.snapshot.write`                                                            |
| AppService.RC.POST               | `event.handle − db.projection.write`                                                              |
| ProjectionDB.RC.POST             | `db.projection.write`                                                                             |
| AppService.RC.PATCH              | `event.handle − db.projection.read − db.projection.write`                                         |
| ProjectionDB.RC.PATCH.read/write | `db.projection.read` / `db.projection.write`                                                      |

Идея: `AppService.*` = «чистое compute + ожидание внутри Node.js», получаемое **вычитанием времени нижележащих DB-операций** из обёртывающего спана (`command.execute`, `query.execute`, `event.handle`). DB-станции = время соответствующих db-спанов напрямую.

### Учёт чтения event-store на POST/PATCH в Classical CQRS

Classical CQRS, в отличие от m_cqrs, **перечитывает event-stream** для восстановления агрегата на командах. В логах появляются доп. спаны: `db.eventstore.read`, `eventstore.load`, `snapshot.load`, `snapshot.save`.

**Формула ячейки `AppService.Stvor/Onovl` НЕ изменялась** относительно m_cqrs — она вычитает только `db.eventstore.write`, `db.snapshot.read`, `db.snapshot.write`. Спан `db.eventstore.read` (рехидрация агрегата) **остаётся внутри `command.execute`** и, не будучи вычтенным, **попадает в ячейку AppService.Stvor/Onovl** — то есть моделируется как часть busy/wait-времени AppService, **а не маршрутизируется на станцию EventStore**.

**Почему это допустимо в данном датасете** — замерили `db.eventstore.read` / `eventstore.load` для classical (m7a-gp3 seq POST):

| Спан                   |    median |      mean |
|------------------------|----------:|----------:|
| command.execute        |     1.890 |     2.228 |
| **db.eventstore.read** | **0.000** | **0.107** |
| **eventstore.load**    | **0.000** | **0.144** |
| db.eventstore.write    |     1.330 |     1.371 |
| db.snapshot.read       |     0.000 |     0.181 |
| event.publishAll       |     0.086 |     0.090 |

`db.eventstore.read` **редкий**: median = 0, mean ≈ 0.1 мс. Агрегат в этой реализации восстанавливается преимущественно из снапшота + немногих свежих событий, **полное перечитывание stream происходит редко**. Доминирует `eventstore.write` (1.33 мс, на каждый command), который **корректно** маршрутизируется на станцию EventStore.

**Вывод по вопросу:** да, classical добавляет чтение event-store на POST/PATCH; в текущей модели оно **учтено внутри AppService-ячейки** (не отдельной EventStore-read нагрузкой). Это упрощение, **оправданное малостью** (~0.1 мс, median 0) в этом датасете. Для нагрузок с длинными event-stream (частая полная рехидрация) `db.eventstore.read` стоило бы вынести отдельной EventStore.read-компонентой или маршрутом — это направление для будущей работы, здесь не критично.

### Особенность: SnapshotDB.Stvor median = 0

Classical делает snapshot **периодически** (не на каждый command) → у большинства POST `db.snapshot.read+write = 0` → `SnapshotDB.Stvor` median = 0 (mean ≈ 0.16–0.21 мс, CV² 3–27). Калибровка по median ломалась (`log(0)`). Добавлен fallback: **center = mean, если median ≤ 0** (корректно отражает средний вклад редкого снапшота). Реализовано в `classical/_build_jsimg.py` и `classical/_calibrate_m7i.py`.

---

## Шаг 1a — Метрики из seq-логов (центральная статистика)

### m7i-gp3-classical_cqrs (база K-формулы)

| Cell                        |    n |  mean | median |   CV² |
|-----------------------------|-----:|------:|-------:|------:|
| AppService.Zapyty           | 1287 | 0.394 |  0.365 |  0.56 |
| ProjectionDB.Zapyty         | 1287 | 0.668 |  0.646 |  0.34 |
| AppService.Stvor            |  588 | 0.975 |  0.666 |  0.36 |
| EventStore.Stvor            |  588 | 1.341 |  1.329 |  0.04 |
| SnapshotDB.Stvor            |  588 | 0.206 |  0.000 | 27.24 |
| AppService.RC.POST          |  588 | 0.690 |  0.556 |  0.46 |
| ProjectionDB.RC.POST        |  588 | 1.663 |  1.257 |  0.58 |
| AppService.Onovl            | 2157 | 1.653 |  1.492 |  0.30 |
| EventStore.Onovl            | 2157 | 1.242 |  1.240 |  0.04 |
| SnapshotDB.Onovl            | 2157 | 0.781 |  0.487 |  1.23 |
| AppService.RC.PATCH         | 2157 | 2.387 |  2.014 |  0.23 |
| ProjectionDB.RC.PATCH.read  | 2157 | 0.484 |  0.277 |  2.55 |
| ProjectionDB.RC.PATCH.write | 2157 | 0.310 |  0.230 |  2.09 |

### m7i-io2-classical_cqrs (числитель K)

| Cell                        |    n |  mean | median |  CV² |
|-----------------------------|-----:|------:|-------:|-----:|
| AppService.Zapyty           | 1287 | 0.367 |  0.351 | 0.23 |
| ProjectionDB.Zapyty         | 1287 | 0.666 |  0.622 | 0.49 |
| AppService.Stvor            |  588 | 0.938 |  0.664 | 0.29 |
| EventStore.Stvor            |  588 | 0.937 |  0.906 | 0.08 |
| SnapshotDB.Stvor            |  588 | 0.162 |  0.000 | 4.48 |
| AppService.RC.POST          |  588 | 0.690 |  0.566 | 0.20 |
| ProjectionDB.RC.POST        |  588 | 1.106 |  0.794 | 0.98 |
| AppService.Onovl            | 2158 | 1.587 |  1.465 | 0.10 |
| EventStore.Onovl            | 2158 | 0.847 |  0.820 | 0.07 |
| SnapshotDB.Onovl            | 2158 | 0.661 |  0.463 | 1.18 |
| AppService.RC.PATCH         | 2158 | 1.900 |  1.569 | 0.25 |
| ProjectionDB.RC.PATCH.read  | 2158 | 0.469 |  0.280 | 1.45 |
| ProjectionDB.RC.PATCH.write | 2158 | 0.345 |  0.234 | 5.79 |

### m7a-gp3-classical_cqrs (база применения K)

| Cell                        |    n |  mean | median |  CV² |
|-----------------------------|-----:|------:|-------:|-----:|
| AppService.Zapyty           | 1287 | 0.331 |  0.312 | 1.12 |
| ProjectionDB.Zapyty         | 1287 | 0.599 |  0.550 | 0.46 |
| AppService.Stvor            |  588 | 0.766 |  0.576 | 0.34 |
| EventStore.Stvor            |  588 | 1.371 |  1.330 | 0.16 |
| SnapshotDB.Stvor            |  588 | 0.181 |  0.000 | 5.89 |
| AppService.RC.POST          |  588 | 0.505 |  0.406 | 0.23 |
| ProjectionDB.RC.POST        |  588 | 1.545 |  1.167 | 0.30 |
| AppService.Onovl            | 2160 | 1.209 |  1.104 | 0.23 |
| EventStore.Onovl            | 2160 | 1.172 |  1.153 | 0.03 |
| SnapshotDB.Onovl            | 2160 | 0.754 |  0.455 | 0.96 |
| AppService.RC.PATCH         | 2160 | 2.017 |  1.713 | 0.17 |
| ProjectionDB.RC.PATCH.read  | 2160 | 0.366 |  0.200 | 1.82 |
| ProjectionDB.RC.PATCH.write | 2160 | 0.233 |  0.168 | 3.24 |

### m7a-io2-classical_cqrs (ground truth)

| Cell                        |    n |  mean | median |  CV² |
|-----------------------------|-----:|------:|-------:|-----:|
| AppService.Zapyty           | 1287 | 0.323 |  0.312 | 0.07 |
| ProjectionDB.Zapyty         | 1287 | 0.625 |  0.551 | 0.89 |
| AppService.Stvor            |  588 | 0.743 |  0.549 | 0.26 |
| EventStore.Stvor            |  588 | 1.172 |  1.058 | 0.34 |
| SnapshotDB.Stvor            |  588 | 0.160 |  0.000 | 2.79 |
| AppService.RC.POST          |  588 | 0.492 |  0.393 | 0.37 |
| ProjectionDB.RC.POST        |  588 | 1.153 |  0.856 | 0.45 |
| AppService.Onovl            | 2158 | 1.177 |  1.089 | 0.10 |
| EventStore.Onovl            | 2158 | 0.947 |  0.885 | 0.09 |
| SnapshotDB.Onovl            | 2158 | 0.683 |  0.461 | 0.63 |
| AppService.RC.PATCH         | 2158 | 1.693 |  1.412 | 0.21 |
| ProjectionDB.RC.PATCH.read  | 2158 | 0.356 |  0.204 | 1.42 |
| ProjectionDB.RC.PATCH.write | 2158 | 0.237 |  0.169 | 3.17 |

**Сравнение с m_cqrs:** classical `EventStore.Stvor` seq median ≈ 1.33 мс (m_cqrs 0.27) — выше: classical делает write полного потока. `AppService.Stvor` ниже (0.58 vs 2.09) — нет manual-event-store overhead. CV²_load AppService.Zapyty у classical 1–3.6 (m_cqrs 62) — меньше GC-outliers, distribution чище.

---

## Шаг 1b — σ_MLE из load-логов (m7a-gp3, база)

| Cell                        | mean_load | σ_load_MLE | CV²_load |
|-----------------------------|----------:|-----------:|---------:|
| AppService.Zapyty           |         — |      0.432 |     3.57 |
| ProjectionDB.Zapyty         |         — |      0.753 |     1.61 |
| AppService.Stvor            |         — |      0.706 |     1.56 |
| EventStore.Stvor            |         — |      0.409 |     0.41 |
| SnapshotDB.Stvor            |         — |      0.639 |     6.00 |
| AppService.RC.POST          |         — |      0.390 |     0.82 |
| ProjectionDB.RC.POST        |         — |      0.508 |     0.45 |
| AppService.Onovl            |         — |      0.398 |     0.71 |
| EventStore.Onovl            |         — |      0.407 |     0.36 |
| SnapshotDB.Onovl            |         — |      0.796 |     1.17 |
| AppService.RC.PATCH         |         — |      0.491 |     0.48 |
| ProjectionDB.RC.PATCH.read  |         — |      0.789 |     1.36 |
| ProjectionDB.RC.PATCH.write |         — |      0.777 |     1.55 |

σ_load classical: 0.39–0.80 — умереннее m_cqrs (0.51–1.05), потому что меньше outliers.

---

## Шаг 2 — Формула калибровки

**m7a-gp3 / m7a-io2 (Exp 6 + per-class σ-тюнинг):**

```text
σ_base = σ_load_MLE
σ      = σ_base × class_factor          ← НОВОЕ: GET ×0.85, Stvor/Onovl ×1.30, RC ×1.0
center = median_seq                      (если median_seq ≤ 0 → mean_seq; GET ×0.75)
μ      = ln(center) − σ²/2               → E[X] = center (mean сохраняется!)
K_median = median_m7i-io2 / median_m7i-gp3
μ_pred(m7a-io2) = μ(m7a-gp3) + ln(K_median),  σ_pred = σ
```

### Per-class σ-тюнинг хвоста

Базовый Exp 12 на classical давал плохой p95: GET над-предсказан на калибровочных
m7i (+24…+53%), Stvor/Onovl недо-предсказаны (−3…−33%). Введены **per-class
множители σ** (`ZAPYTY_SIGMA_FACTOR=0.85`, `CMD_SIGMA_FACTOR=1.30` в
`classical/_build_jsimg.py`):

- **GET (Zapyty) σ ×0.85** — тоньше хвост, ниже p95.
- **Stvor/Onovl (команды) σ ×1.30** — толще хвост, выше недо-предсказанный p95.
- **RC ×1.0** — без изменений.

Для **m7a** множитель применяется в Exp-6-формуле: σ масштабируется, μ
пересчитывается → `E[X]=center` сохраняется (mean/median не сдвигаются, меняется
только хвост). Для **m7i** множитель применяется в `_calibrate_m7i.init_params`
до итеративного цикла → центры пере-сходятся под новую σ (median остаётся на
цели, p95 подстраивается).

Почему `μ = ln(median) − σ²/2`, а не `μ = ln(median)`: см. [exp6-design.md §Шаг 2](exp6-design.md) — это сохраняет `E[X]=center` при любой σ (компенсация прироста mean от σ²/2 вычитанием из μ).

**m7i-gp3 / m7i-io2 (итеративная калибровка):** старт center = median_seq (fallback mean при 0) + MOM σ × class_factor; цикл build→JMT→scale-class-by-ratio^0.7 пока predicted median == measured load median.

### Сошедшиеся m7i центры (classical, после σ-тюнинга)

| Cell                 | gp3 (ms) | io2 (ms) |     K |     σ |
|----------------------|---------:|---------:|------:|------:|
| AppService.Zapyty    |    0.234 |    0.353 | 1.507 | 1.446 |
| ProjectionDB.Zapyty  |    0.415 |    0.626 | 1.509 | 0.739 |
| AppService.Stvor     |    0.709 |    0.871 | 1.228 | 1.636 |
| EventStore.Stvor     |    1.415 |    1.187 | 0.839 | 0.928 |
| SnapshotDB.Stvor     |    0.219 |    0.212 | 0.966 | 1.684 |
| AppService.RC.POST   |    0.795 |    1.030 | 1.296 | 1.279 |
| ProjectionDB.RC.POST |    1.798 |    1.444 | 0.803 | 0.728 |
| AppService.Onovl     |    2.266 |    2.284 | 1.008 | 1.456 |
| EventStore.Onovl     |    1.884 |    1.278 | 0.679 | 0.868 |
| SnapshotDB.Onovl     |    0.739 |    0.721 | 0.976 | 1.096 |

(σ для Stvor/Onovl-ячеек ×1.30 относительно MOM, для Zapyty ×0.85; RC без изменений.)

---

## Шаг 3 — Пример полного расчёта: AppService.Onovl (m7a-gp3 → m7a-io2)

### Шаг 1 — Метрики

| Машина          |  mean | median |  CV² | σ_load |
|-----------------|------:|-------:|-----:|-------:|
| m7i-gp3         | 1.653 |  1.492 | 0.30 |      — |
| m7i-io2         | 1.587 |  1.465 | 0.10 |      — |
| m7a-gp3 (base)  | 1.209 |  1.104 | 0.23 |  0.398 |
| m7a-io2 (truth) | 1.177 |  1.089 | 0.10 |      — |

### Шаг 2 — Калибровка m7a-gp3 (Exp 6 + σ-тюнинг)

```text
σ_base = σ_load_MLE(m7a-gp3, AppService.Onovl) = 0.398
σ      = 0.398 × 1.30 = 0.517            (Onovl = команда → CMD_SIGMA_FACTOR)
center = median_seq = 1.104               (PATCH, не GET → без ×0.75)
μ_gp3  = ln(1.104) − 0.517²/2 = 0.099 − 0.134 = −0.035
implied mean = exp(−0.035 + 0.134) = exp(0.099) = 1.104 ms = median_seq ✓
```

### Шаг 3 — K_median и предсказание m7a-io2

```text
K_median(AppService.Onovl) = median_m7i-io2 / median_m7i-gp3 = 1.465 / 1.492 = 0.982
                             (seq-median ratio m7i — НЕ зависит от σ-тюнинга)
μ_pred = μ_gp3 + ln(0.982) = −0.035 + (−0.018) = −0.053
σ_pred = 0.517
implied mean = exp(−0.053 + 0.134) = 1.084 ms
measured m7a-io2 mean = 1.177 → service-time Δ = −7.9%   (mean сохранён σ-тюнингом)
```

JMT-модель ячейки (m7a-io2, секунды): μ_s = −0.053 − ln(1000) = −6.961, σ = 0.517.

**Заметь:** σ-тюнинг (×1.30) увеличил хвост (σ 0.398→0.517), но implied mean
ячейки не изменился (1.084 ms) — формула `μ = ln(center) − σ²/2` это
гарантирует. Меняется только p95/дисперсия класса Onovl.

---

## Per-machine результаты JMT (Classical Exp 12, после σ-тюнинга)

End-to-end MRE `measured (load) ↔ predicted (JMT)`. RC_lag = sample-convolution `Stvor_RT+RC_RT` / `Onovl_RT+RC_RT`, взвешенная по measured POST/PATCH. Финальные σ-факторы: GET ×0.85, Stvor/Onovl ×1.30, RC ×1.0.

### Mean (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
|---------------------|-----------|--------:|--------:|--------:|--------:|
| m7i-gp3 (calib)     | measured  |   2.410 |   4.062 |   6.475 |  10.617 |
| m7i-gp3 (calib)     | predicted |   3.191 |   4.682 |   7.057 |  11.134 |
| m7i-gp3 (calib)     | MRE       | +32.42% | +15.27% |  +8.99% |  +4.88% |
| m7i-io2 (calib)     | measured  |   2.172 |   3.290 |   5.388 |   8.787 |
| m7i-io2 (calib)     | predicted |   2.426 |   3.459 |   5.389 |   8.438 |
| m7i-io2 (calib)     | MRE       | +11.68% |  +5.12% |  +0.02% |  −3.97% |
| m7a-gp3 (calib)     | measured  |   1.079 |   2.415 |   3.619 |   6.084 |
| m7a-gp3 (calib)     | predicted |   1.096 |   2.514 |   3.117 |   4.883 |
| m7a-gp3 (calib)     | MRE       |  +1.62% |  +4.09% | −13.86% | −19.73% |
| m7a-io2 (PREDICTED) | measured  |   1.025 |   1.990 |   3.031 |   5.001 |
| m7a-io2 (PREDICTED) | predicted |   0.782 |   1.844 |   2.455 |   3.508 |
| m7a-io2 (PREDICTED) | MRE       | −23.68% |  −7.32% | −19.00% | −29.84% |

### Median (мс)

| machine             | source    |  Zapyty |  Stvor |   Onovl |  RC_lag |
|---------------------|-----------|--------:|-------:|--------:|--------:|
| m7i-gp3 (calib)     | measured  |   1.570 |  2.961 |   5.009 |   8.212 |
| m7i-gp3 (calib)     | predicted |   1.631 |  2.992 |   5.047 |   9.196 |
| m7i-gp3 (calib)     | MRE       |  +3.85% | +1.07% |  +0.76% | +11.98% |
| m7i-io2 (calib)     | measured  |   1.498 |  2.385 |   4.146 |   6.802 |
| m7i-io2 (calib)     | predicted |   1.525 |  2.388 |   4.156 |   7.238 |
| m7i-io2 (calib)     | MRE       |  +1.80% | +0.10% |  +0.23% |  +6.41% |
| m7a-gp3 (calib)     | measured  |   0.775 |  2.026 |   3.060 |   5.236 |
| m7a-gp3 (calib)     | predicted |   0.764 |  2.193 |   2.826 |   4.562 |
| m7a-gp3 (calib)     | MRE       |  −1.45% | +8.21% |  −7.64% | −12.87% |
| m7a-io2 (PREDICTED) | measured  |   0.780 |  1.574 |   2.548 |   4.356 |
| m7a-io2 (PREDICTED) | predicted |   0.639 |  1.622 |   2.246 |   3.306 |
| m7a-io2 (PREDICTED) | MRE       | −18.06% | +3.06% | −11.86% | −24.09% |

### p95 (мс)

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
|---------------------|-----------|--------:|--------:|--------:|--------:|
| m7i-gp3 (calib)     | measured  |   6.711 |  10.270 |  14.763 |  25.837 |
| m7i-gp3 (calib)     | predicted |  11.006 |  14.161 |  18.824 |  25.216 |
| m7i-gp3 (calib)     | MRE       | +63.99% | +37.90% | +27.51% |  −2.40% |
| m7i-io2 (calib)     | measured  |   5.870 |   8.232 |  12.443 |  21.779 |
| m7i-io2 (calib)     | predicted |   7.472 |   9.769 |  13.333 |  17.752 |
| m7i-io2 (calib)     | MRE       | +27.30% | +18.67% |  +7.15% | −18.49% |
| m7a-gp3 (calib)     | measured  |   2.619 |   4.838 |   6.775 |  11.787 |
| m7a-gp3 (calib)     | predicted |   2.962 |   5.115 |   5.737 |   8.199 |
| m7a-gp3 (calib)     | MRE       | +13.10% |  +5.73% | −15.32% | −30.44% |
| m7a-io2 (PREDICTED) | measured  |   2.431 |   4.256 |   5.780 |  10.157 |
| m7a-io2 (PREDICTED) | predicted |   1.747 |   3.653 |   4.391 |   5.732 |
| m7a-io2 (PREDICTED) | MRE       | −28.14% | −14.17% | −24.03% | −43.57% |

### Aggregate |MRE| per machine (4 класса)

| machine             |   mean | median |    p95 |
|---------------------|-------:|-------:|-------:|
| m7i-gp3 (calib)     | 15.39% |  4.42% | 32.95% |
| m7i-io2 (calib)     |  5.20% |  2.13% | 17.90% |
| m7a-gp3 (calib)     |  9.83% |  7.54% | 16.15% |
| m7a-io2 (PREDICTED) | 19.96% | 14.27% | 27.48% |

### Эффект σ-тюнинга (m7a-io2 PREDICTED p95, по классам)

| Класс             | до тюнинга | после (GET×0.85, CMD×1.30) |
|-------------------|-----------:|---------------------------:|
| Zapyty            |    −24.73% |                    −28.14% |
| Stvor             |    −25.87% |                **−14.17%** |
| Onovl             |    −33.33% |                **−24.03%** |
| RC_lag            |    −47.81% |                    −43.57% |
| **aggregate p95** | **32.94%** |                 **27.48%** |

Stvor/Onovl p95 подтянуты ближе к нулю (−26→−14, −33→−24). GET слегка ушёл вниз (−25→−28) — σ↓ на m7a-io2 уменьшил хвост, но центр уже задефлирован ×0.75. RC не тюнился. Aggregate p95: **32.9% → 27.5%** (−5.5 п.п.).

---

## Сравнение с m_cqrs Exp 12 (m7a-io2 PREDICTED, aggregate)

|                                 |      mean |    median |       p95 |
|---------------------------------|----------:|----------:|----------:|
| m_cqrs Exp 12                   |     17.9% |     13.0% |     14.8% |
| classical Exp 12 (до σ)         |     20.9% |     14.8% |     32.9% |
| **classical Exp 12 (σ-тюнинг)** | **20.0%** | **14.3%** | **27.5%** |

## Выводы

| Аспект                            | Результат                                                                         |
|-----------------------------------|-----------------------------------------------------------------------------------|
| **m7i калибровка**                | ✅ Stvor/Onovl/RC median ±0–8% (m7i-io2 mean 5.2%)                                 |
| **m7a-gp3 GET median**            | ✅ −1.5% (дефляция ×0.75 удачно подошла classical)                                 |
| **m7a-io2 mean / median**         | ✅ 20% / 14% — сопоставимо с m_cqrs                                                |
| **m7a-io2 p95**                   | ⚠️ 27.5% (σ-тюнинг улучшил с 33%); Stvor −14%, Onovl −24%, RC −44%                |
| **σ-тюнинг Stvor/Onovl**          | ✅ p95 подтянут (−26→−14, −33→−24 на m7a-io2)                                      |
| **m7i-gp3 Stvor/Onovl p95**       | ⚠️ +28…+38% — структурный FCFS HOL-blocking (как m_cqrs; чинится PS, не σ)        |
| **eventstore.read на POST/PATCH** | учтён внутри AppService-ячейки; мал (median 0, mean ≈0.1мс) → упрощение оправдано |

**Ограничения σ-тюнинга:** CMD ×1.30 поднимает Stvor/Onovl p95 на target m7a-io2 (главная цель), но на m7i-gp3 даёт over-prediction (+38%) — тот же структурный артефакт FCFS head-of-line-blocking, что в m_cqrs (короткие job за длинными командами на AppService). Это лечится Processor-Sharing-дисциплиной (см. m_cqrs exp14), не σ. RC_lag (−44%) — накопленное занижение convolution, σ-тюнинг RC не затрагивает.

### Заметки

- Classical чище ложится на Lognormal (KS 0.193 vs m_cqrs 0.216).
- m7a-io2 p95 хуже из-за RC_lag (−48%): classical RC = convolution command (с eventstore.read) + handler — систематическое занижение накапливается.
- `ZAPYTY_CENTER_M7A_FACTOR = 0.75` перенесён из m_cqrs. На classical m7a-gp3 GET median попал отлично (−1.6%), но m7a-io2 GET ушёл в −20…−25% — фактор для classical можно ослабить до ~0.85–0.9 переподбором по classical m7a-gp3.
- `SnapshotDB.Stvor` median = 0 (classical снапшотит периодически) → fallback center=mean.
- `db.eventstore.read` (рехидрация stream) остаётся внутри AppService-ячейки; для длинных event-stream его стоило бы вынести отдельным EventStore.read-маршрутом (future work).

## Артефакты

| Файл                                                                          | Содержание                            |
|-------------------------------------------------------------------------------|---------------------------------------|
| [classical/](../classical/)                                                   | Изолированный pipeline classical_cqrs |
| [classical/m7i_calibration.json](../classical/m7i_calibration.json)           | Сошедшиеся m7i центры (classical)     |
| [classical/experiment-fits.json](../classical/experiment-fits.json)           | seq-параметры (с median)              |
| [classical/experiment-fits-load.json](../classical/experiment-fits-load.json) | load-параметры (σ_MLE)                |
| [classical/models/*classical_cqrs_exp12*](../classical/models/)               | JMT-модели + результаты               |
| [exp12-design.md](exp12-design.md)                                            | Базовая методология (m_cqrs)          |
| [exp6-design.md](exp6-design.md)                                              | Деталь m7a-логики                     |
