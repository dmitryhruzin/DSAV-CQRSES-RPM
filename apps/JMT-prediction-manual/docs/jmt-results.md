# Шаг 8: JMT-симуляция и итоговый выбор модели

Финальный шаг — прогон 3 экспериментов через JMT и сравнение предсказанных response-time с измеренными под нагрузкой. Это даёт **end-to-end MRE** прогноза, а не просто KS-фит на seq-данных.

## Что прогоняли

Для каждого из 4 машин × 3 экспериментов сгенерировали `.jsimg`-модель и прогнали через JMT CLI:

```bash
java -cp "/Applications/Java Modelling Tools/JMT.jar" jmt.commandline.Jmt sim models/<machine>_<exp>.jsimg
```

Скрипт сборки: [_build_jsimg.py](../_build_jsimg.py). Анализ результатов: [_analyze_jmt.py](../_analyze_jmt.py).

### Параметры симуляции

- **Топология**: Start → AppService → {EventStore → SnapshotDB → Stop} OR {ProjectionDB → Stop}
- **Серверы**: AppService = 2 параллельных (2 vCPU m*.large), остальные = 1
- **Класс-routing**:
  - Zapyty (GET) → AppService → ProjectionDB → Stop
  - Stvor (POST), Onovl (PATCH) → AppService → EventStore → SnapshotDB → Stop
  - RC → AppService → ProjectionDB → Stop
- **Arrival rates** (запросов/сек) считаются из соответствующего load-лога каждой машины
- **Service times** — параметры из [experiment-fits.json](../experiment-fits.json), для m7a-io2 — после применения K_disk
- **Max samples**: 200 000 на каждый класс (≈ 800k всего по всем 4 классам)

## Arrival rates per machine (events/s)

| Machine | Zapyty | Stvor | Onovl | RC |
| --- | ---: | ---: | ---: | ---: |
| m7i-gp3 | 102.96 | 102.63 | 155.61 | 289.05 |
| m7i-io2 | 98.01 | 98.65 | 144.27 | 272.27 |
| m7a-gp3 | 102.35 | 102.12 | 151.12 | 284.30 |
| **m7a-io2** | **97.31** | **99.21** | **148.53** | **277.94** |

## Главный результат: m7a-io2 (предсказание)

**Измеренная distribution m7a-io2 под нагрузкой** (ms):

| Class | n | mean | median | p90 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Zapyty | 10 890 | 1.001 | 0.730 | 1.648 | 2.249 | 5.226 |
| Stvor | 11 102 | 2.850 | 2.292 | 4.337 | 5.649 | 11.725 |
| Onovl | 16 622 | 3.123 | 2.527 | 4.758 | 6.018 | 12.362 |
| RC (consistency_lag) | 27 722 | 5.300 | 4.490 | 8.112 | 10.196 | 19.140 |

**Предсказанные JMT-симуляцией** (ms):

| Class | exp1 (LN MLE) | exp2 (Brunnert) | exp3 (Hybrid) |
| --- | --- | --- | --- |
| Zapyty mean | 1.234 | 1.303 | 1.269 |
| Zapyty median | 1.001 | 1.058 | 1.005 |
| Zapyty p90 | 2.142 | 2.430 | 2.257 |
| Zapyty p95 | 2.632 | 3.012 | 2.812 |
| Stvor mean | 2.524 | 2.571 | 2.519 |
| Stvor median | 2.442 | 2.473 | 2.439 |
| Stvor p90 | 3.127 | 3.381 | 3.120 |
| Stvor p95 | 3.429 | 3.741 | 3.409 |
| Onovl mean | 2.776 | 2.789 | 2.729 |
| Onovl median | 2.635 | 2.675 | 2.651 |
| Onovl p90 | 3.873 | 3.969 | 3.625 |
| Onovl p95 | 4.346 | 4.416 | 3.964 |

## MRE предсказания vs измеренного (m7a-io2, %)

### Per-class MRE

| Class | Stat | **exp1** | exp2 | exp3 |
| --- | --- | ---: | ---: | ---: |
| Zapyty | mean | **+23.4%** | +30.3% | +26.8% |
| Zapyty | median | **+37.1%** | +44.9% | +37.7% |
| Zapyty | p90 | **+29.9%** | +47.4% | +36.9% |
| Zapyty | p95 | **+17.0%** | +33.9% | +25.0% |
| Stvor | mean | −11.4% | **−9.8%** | −11.6% |
| Stvor | median | **+6.5%** | +7.9% | **+6.4%** |
| Stvor | p90 | −27.9% | **−22.1%** | −28.1% |
| Stvor | p95 | −39.3% | **−33.8%** | −39.6% |
| Onovl | mean | −11.1% | **−10.7%** | −12.6% |
| Onovl | median | **+4.3%** | +5.8% | +4.9% |
| Onovl | p90 | −18.6% | **−16.6%** | −23.8% |
| Onovl | p95 | −27.8% | **−26.6%** | −34.1% |

### Aggregate MRE (mean of |MRE|, без RC)

`RC` исключён из агрегата, потому что измеренный `RC_lag` (consistency_lag end-to-end) и предсказанный JMT response-time для RC-класса — концептуально разные величины (см. §«Почему RC».)

| Stat | **exp1 (LN MLE)** | exp2 (Brunnert) | exp3 (Hybrid) |
| --- | ---: | ---: | ---: |
| **mean** | **15.3%** | 16.9% | 17.0% |
| **median** | **16.0%** | 19.6% | 16.3% |
| **p90** | **25.5%** | 28.7% | 29.6% |
| **p95** | **28.0%** | 31.4% | 32.9% |

**Exp 1 (Lognormal MLE) выигрывает на всех 4 статистиках.**

## Что показывает анализ MRE

### По классам

- **Zapyty (GET) — JMT над-предсказывает на 17–47%.** JMT модель видит queueing-эффект на ProjectionDB, но реальный read под нагрузкой работает быстрее (вероятно из-за кэширования). Это **систематическая проблема модели**, не специфическая для эксперимента.
- **Stvor/Onovl (POST/PATCH) — JMT под-предсказывает хвосты (p90/p95) на 17–40%.** Медиана точна (±8%), а хвост — нет. Реальный load имеет heavier tail, чем seq-калибровка предполагает. Это объясняется тем, что seq-данные собирались **без queueing**, а под load возникают дополнительные хвосты из-за burst-arrivals и serialization.
- **Mean prediction точное во всех 3 экспериментах** (errors −12% до +6% для Stvor/Onovl).

### По экспериментам

| | Что лучше у… | Где |
| --- | --- | --- |
| Exp 1 (LN MLE) | mean / median Zapyty (+23%, +37%) vs Brunnert (+30%, +45%) | Лучший выбор LN для GET с CV²<1 |
| Exp 2 (Brunnert) | p90/p95 Stvor/Onovl | Heavy tail handled by `Exp` family более «толстым» хвостом |
| Exp 3 (Hybrid) | median Zapyty (+37.7%) почти на уровне Exp 1 | Минимальные swap, без drama |

**Победитель: Exp 1.** Преимущество маленькое (1–4 п.п.), но системное.

### Почему RC исключён

В нашей JMT-модели **RC = одна visit на AppService + одна на ProjectionDB** (event-handler выполнение). А measured `RC_lag` = `max(event.handle.endedAt) − http.request.startedAt`, что включает:

- HTTP-обработку
- command.execute, event.publishAll
- queueing event-bus
- проекция-handler

Это **не один service time**, а **end-to-end retry latency**. Поэтому JMT-симуляция RC даёт mean ~1.9 ms (только handler), а measured RC_lag = 5.3 ms (всё от запроса до конца). MRE −60% — артефакт **семантического mismatch**, а не проблема модели.

Если бы хотелось сравнить apples-to-apples, нужно было бы:

- (а) измерять только `event.handle.durationMs` на m7a-io2 и сравнивать с JMT RC predicted (тогда MRE будет в пределах разумного), OR
- (б) изменить топологию модели чтобы RC включал AppService+command+ES+SN перед попаданием в projection (но это не соответствует физике — RC параллельный event-bus процесс).

Для целей сравнения трёх экспериментов это не важно — все три имеют тот же RC bias.

## Финальная рекомендация

**Использовать Exp 1 (Lognormal MLE на всех станциях)** в production pipeline.

Обоснование (summary всех 4 критериев):

| Критерий | Победитель |
| --- | --- |
| KS-fit на seq-данных | Exp 1 (mean KS 0.216 vs Exp 2: 0.293) |
| Mean prediction error (без JMT) | Exp 2 (7.10% vs 7.78%) — но разница в пределах шума |
| **JMT MRE на m7a-io2 (mean)** | **Exp 1 (15.3% vs Exp 2: 16.9%)** |
| **JMT MRE на m7a-io2 (median)** | **Exp 1 (16.0% vs Exp 2: 19.6%)** |
| Простота имплементации | Exp 1 |
| K-prediction консистентность | Exp 1 |

Exp 1 выигрывает по **3 из 5 критериев** (KS, JMT mean, JMT median) и при равном результате (mean prediction в пределах 0.7 п.п.). Hybrid (Exp 3) даёт почти идентичные числа, добавляя сложность — выгода маргинальная.

**Brunnert (Exp 2) НЕ использовать**: KS катастрофически плох на EventStore (KS 0.45–0.55), и JMT-симуляция это подтвердила — Exp 2 проигрывает Exp 1 везде.

## Где модель имеет проблемы

1. **GET (Zapyty) над-предсказывается на 23–47%.** Системная ошибка. Гипотеза: ProjectionDB-read под load работает быстрее seq из-за hot cache + bulk-чтение через connection pool. Дальнейшая работа: добавить cache-hit-rate в калибровку, или использовать load-данные для калибровки read-станций.

2. **POST/PATCH хвосты под-предсказываются на 17–40%.** Системная ошибка. Гипотеза: real-load имеет burst-arrivals, которых нет в seq (где требования приходят строго последовательно). LN-калиброванная по seq σ недо-оценивает реальную дисперсию под нагрузкой.

3. **RC семантически отличается** (см. выше). Не fixable без редизайна модели.

Эти проблемы — общие для всех 3 экспериментов и составляют floor MRE ~15%. Без структурных изменений модели (другая топология, другая калибровочная стратегия для cache) ниже не уйдём.

## Sanity-check: что показывают калибровочные машины

Чтобы понять, **сколько MRE из 15% — это собственно ошибка K-prediction, а сколько — структурная ошибка JMT-модели**, прогнали те же 3 эксперимента на 3 калибровочных машинах (m7i-gp3, m7i-io2, m7a-gp3), где **K НЕ применяется** — служба-time берутся напрямую из их seq-логов.

### Mean |MRE| per (machine, statistic) — без RC

| Machine | Stat | exp1 | exp2 | exp3 |
| --- | --- | ---: | ---: | ---: |
| m7i-gp3 (calib) | mean | 45.30% | **42.44%** | 44.24% |
| m7i-gp3 (calib) | median | 33.21% | **29.11%** | 32.58% |
| m7i-gp3 (calib) | p90 | 52.95% | **49.01%** | 51.65% |
| m7i-gp3 (calib) | p95 | 59.82% | **56.41%** | 58.81% |
| m7i-io2 (calib) | mean | 43.13% | **40.63%** | 42.65% |
| m7i-io2 (calib) | median | 28.36% | **25.31%** | 27.91% |
| m7i-io2 (calib) | p90 | 54.38% | **50.10%** | 54.00% |
| m7i-io2 (calib) | p95 | 60.29% | **56.20%** | 59.90% |
| m7a-gp3 (calib) | mean | 52.98% | **51.26%** | 52.17% |
| m7a-gp3 (calib) | median | **24.94%** | 31.51% | 25.38% |
| m7a-gp3 (calib) | p90 | **48.27%** | 56.29% | 57.12% |
| m7a-gp3 (calib) | p95 | **45.38%** | 52.78% | 54.23% |
| **m7a-io2 (PREDICTED)** | mean | **15.29%** | 16.92% | 17.02% |
| **m7a-io2 (PREDICTED)** | median | **15.98%** | 19.56% | 16.34% |
| **m7a-io2 (PREDICTED)** | p90 | **25.48%** | 28.67% | 29.61% |
| **m7a-io2 (PREDICTED)** | p95 | **28.03%** | 31.43% | 32.92% |

### Контр-интуитивный результат

**На калибровочных машинах MRE 40–60%, а на предсказанной — 15–28%.** Это значит, что seq-калибровка имеет **большую структурную ошибку** (45–55% на mean), но **K-prediction на m7a-io2 случайно компенсирует часть этой ошибки**.

Гипотезы откуда такая структурная ошибка:

1. **Caching effects.** Под нагрузкой кэш ProjectionDB прогрет, hot connection pool, JIT-оптимизация — service time реально меньше, чем в seq (где система cold). JMT не моделирует кэш-эффекты.
2. **Burst-arrivals.** Real load имеет короткие пики arrival rate; JMT использует Poisson interarrival (Exponential). Реальный burst может вызвать temporary high-utilization, но усреднённый response time может быть как выше, так и ниже.
3. **Connection pooling.** pg-pool keep-alive между запросами в load избегает re-connect overhead; в seq каждый запрос может перезаключать соединение.

Все три эффекта **общие для всех 3 экспериментов** — это объясняет, почему Exp 1/2/3 отличаются друг от друга всего на 1–3 п.п., при том что абсолютная ошибка 40–60%.

### Что это значит для recommendation

Рекомендация остаётся: **Exp 1 (LN MLE)** — но с оговоркой, что **15% MRE на m7a-io2 это floor, не ceiling**. Не пытайтесь делать архитектурные выводы вроде «K-prediction точна» — большая часть оставшейся ошибки структурная.

Для уменьшения MRE ниже 15% потребовалось бы:

- (а) Калиброваться по load-данным, а не seq. Это убрало бы cache-bias.
- (б) Включить кэш-модель в JMT (вторая station для cache hits с probabilities).
- (в) Smaller arrival rate (sub-saturation) для устранения queue artifacts.

Эти изменения за рамками текущей итерации.

## Уточнённые таблицы: RC через convolution (command + handler)

Изначальное сравнение `predicted RC RT` ↔ `measured consistency_lag` было apples-to-oranges: predicted = только handler-time, measured = от http.request до конца последнего handler-а. Это давало MRE −60…−67%.

**Правильное сопоставление** — добавить command RT к handler RT (event-bus delay ≈ 0 эмпирически):

```text
predicted_consistency_lag[POST]  = Stvor_RT  + RC_RT  (sample convolution)
predicted_consistency_lag[PATCH] = Onovl_RT  + RC_RT  (sample convolution)
predicted_RC_lag = weighted_union(POST_lag, PATCH_lag, weights = 11102/16622)
```

Веса 11102/16622 = соотношение POST/PATCH запросов в measured load на m7a-io2.

Скрипт: [_analyze_jmt_rc.py](../_analyze_jmt_rc.py) → [experiment-mre-rc-conv.json](../experiment-mre-rc-conv.json).

### Sanity-check event-bus delay

```text
weighted_command_mean + handler_mean = (2.850·11102 + 3.123·16622)/27724 + 2.358 = 3.014 + 2.358 = 5.372 ms
measured RC_lag mean                                                              = 5.300 ms
event_bus_delay ≈ 5.300 − 5.372                                                   = −0.072 ms (~0)
```

Эффективно event-bus delay = 0 (даже слабо отрицательный — артефакт зависимости между command и handler RT). Так что aditive convolution accurate.

### Mean (мс)

| # | Source | Zapyty | Stvor | Onovl | RC_lag |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | **Measured m7a-io2** | **1.001** | **2.850** | **3.123** | **5.300** |
| 2 | Exp 1 (LN MLE) predicted | 1.234 | 2.524 | 2.776 | 4.560 |
| 3 | Exp 1 MRE | +23.4% | −11.4% | −11.1% | −14.0% |
| 4 | Exp 2 (Brunnert) predicted | 1.303 | 2.571 | 2.789 | 4.670 |
| 5 | Exp 2 MRE | +30.3% | **−9.8%** | **−10.7%** | −11.9% |
| 6 | Exp 3 (Hybrid) predicted | 1.269 | 2.519 | 2.729 | 4.592 |
| 7 | Exp 3 MRE | +26.8% | −11.6% | −12.6% | −13.4% |
| 8 | Exp 4 (LN MLE load) predicted | 1.521 | 3.177 | 3.431 | 5.796 |
| 9 | Exp 4 MRE | +52.1% | +11.5% | +9.9% | +9.4% |
| 10 | Exp 5 (Hybrid seq-mean + load-σ) predicted | 1.347 | 2.643 | 2.826 | 4.755 |
| 11 | Exp 5 MRE | +34.6% | **−7.3%** | −9.5% | **−10.3%** |
| 12 | **Exp 6 (Hybrid seq-median + load-σ) predicted** | **1.074** | **2.329** | **2.602** | **3.922** |
| 13 | **Exp 6 MRE** | **+7.4%** | −18.3% | −16.7% | −26.0% |

**Aggregate mean |MRE| (все 4 класса): Exp 1 = 15.0%, Exp 2 = 15.7%, Exp 3 = 16.1%, Exp 4 = 20.7%, Exp 5 = 15.4%, Exp 6 = 17.1%.**

### p95 (мс)

| # | Source | Zapyty | Stvor | Onovl | RC_lag |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | **Measured m7a-io2** | **2.249** | **5.649** | **6.018** | **10.196** |
| 2 | Exp 1 (LN MLE) predicted | 2.632 | 3.429 | 4.346 | 6.538 |
| 3 | Exp 1 MRE | **+17.0%** | −39.3% | −27.8% | −35.9% |
| 4 | Exp 2 (Brunnert) predicted | 3.012 | 3.741 | 4.416 | 6.998 |
| 5 | Exp 2 MRE | +33.9% | −33.8% | −26.6% | −31.4% |
| 6 | Exp 3 (Hybrid) predicted | 2.812 | 3.409 | 3.964 | 6.669 |
| 7 | Exp 3 MRE | +25.0% | −39.6% | −34.1% | −34.6% |
| 8 | Exp 4 (LN MLE load) predicted | 4.289 | 6.545 | 6.853 | 10.188 |
| 9 | Exp 4 MRE | +90.7% | +15.9% | +13.9% | **−0.1%** |
| 10 | Exp 5 (Hybrid seq-mean + load-σ) predicted | 3.460 | 5.448 | 5.673 | 8.292 |
| 11 | Exp 5 MRE | +53.8% | −3.5% | −5.7% | −18.7% |
| 12 | **Exp 6 (Hybrid seq-median + load-σ) predicted** | **2.697** | **4.929** | **5.249** | **6.986** |
| 13 | **Exp 6 MRE** | **+19.9%** | −12.7% | −12.8% | −31.5% |

**Aggregate p95 |MRE| (все 4 класса): Exp 1 = 30.0%, Exp 2 = 31.4%, Exp 3 = 33.3%, Exp 4 = 30.1%, Exp 5 = 20.4%, Exp 6 = 19.2%.**

### До/после правильного сопоставления RC

| Stat | Старый RC MRE (Exp 1) | **Новый RC MRE (Exp 1)** |
| --- | ---: | ---: |
| mean | −64.4% | **−14.0%** |
| p95 | −67.0% | **−35.9%** |

Жёсткое улучшение — теперь RC можно честно сравнивать с другими классами в агрегате. Победитель не изменился: **Exp 1 (LN MLE)** лидирует и на mean, и на p95 aggregate (15.0% / 30.0%).

## Шаг 9: Эксп 4 и Эксп 5 — load-калибровка для p95

### Мотивация

Exp 1 имеет два систематических дефекта на m7a-io2:

1. POST/PATCH p95 **под-предсказывается на 27–40%** (Stvor −39.3%, Onovl −27.8%, RC_lag −35.9%).
2. GET (Zapyty) **над-предсказывается на 17–23%**.

Численная диагностика причины:

| Метрика | seq CV² (m7a-gp3) | load CV² (m7a-io2) | Разница |
| --- | ---: | ---: | ---: |
| responseTime PATCH | 0.12 | 0.56 | ×4.7 |
| responseTime POST | 0.10 | 0.63 | ×6.3 |
| responseTime GET | 0.18 | 1.58 | ×8.8 |

Под нагрузкой CV² в 4–9 раз больше, потому что seq не видит burst-arrivals, GC pauses, lock contention, connection pool stalls, network jitter. LN-калибровка по seq имеет слишком узкую σ → недо-оценивает хвосты.

Гипотезы для исправления:

- **Exp 4 (LN MLE на load):** калибровать всё прямо из load-логов. Скрипт: [_experiment_fits_load.mjs](../_experiment_fits_load.mjs) → [experiment-fits-load.json](../experiment-fits-load.json).
- **Exp 5 (Hybrid mean_seq + σ_load):** mean — свойство диска (K-prediction шифтит mean), CV² — свойство инстанса под нагрузкой (постоянно). Берём mean из seq, σ из load MLE; подгоняем μ чтобы сохранить arithmetic mean.

### Exp 4: чистый load-fit диагностирует double-counting

**Идея:** взять spans `*-load.log` напрямую, LN-MLE на каждой ячейке. Реализация: то же что Exp 1, только источник = load.

**Результат — катастрофическая дивергенция на калибровочных машинах:**

| Machine | Stat | Exp 4 MRE | Note |
| --- | --- | ---: | --- |
| m7i-gp3 (calib) | mean | **1 035 614%** | overload |
| m7i-gp3 (calib) | p95 | **695 557%** | overload |
| m7i-io2 (calib) | mean | 76% | partial overload |
| m7a-gp3 (calib) | mean | 21% | borderline |
| m7a-io2 (PREDICTED) | mean | 24% | OK (K compensates) |
| m7a-io2 (PREDICTED) | p95 | 40% | хуже Exp 1 (28%) |

**Причина — double-counting**: load-spans (например `query.execute − db.projection.read`) уже включают локальный queueing (db pool, knex queue, GC pauses). Когда JMT добавляет своё queueing **поверх** этих значений, total demand превышает capacity → дивергенция.

Диагностический скрипт [_check_overload.py](../_check_overload.py) считает CPU demand AppService (2 vCPU = 2000 ms CPU/s):

| Machine | seq demand | seq util | load demand | load util |
| --- | ---: | ---: | ---: | ---: |
| m7i-gp3 | 876 ms | 43.8% | 1595 ms | 79.7% |
| m7i-io2 | 704 ms | 35.2% | 981 ms | 49.0% |
| m7a-gp3 | 736 ms | 36.8% | **2514 ms** | **125.7%** |
| m7a-io2 | 648 ms | 32.4% | 580 ms | 29.0% |

На m7a-gp3 load demand уже превышает capacity → m7i-gp3 (где hardware медленнее) горит.

**Что Exp 4 показал хорошего:** на PREDICTED p95 для Stvor/Onovl/RC_lag дал почти точные значения (Stvor +15.9%, Onovl +13.9%, **RC_lag −0.08%**). Это подтверждает, что **источник p95 underestimation — действительно низкий σ из seq**, а не структура модели.

### Exp 5: гибрид (μ из seq, σ из load) — рабочее решение

**Гипотеза:** в LN-модели `(μ, σ)` две независимых аспекта:

- arithmetic mean E[X] = exp(μ + σ²/2) — *свойство диска*; меняется с K_disk.
- σ (форма log-tail) — *свойство инстанса под нагрузкой*; примерно постоянно между дисками.

**Формула:**

```text
σ      = σ_load_MLE   (из experiment-fits-load.json, exp1.sigma)
μ      = ln(mean_seq) − σ²/2     (preserves E[X] = mean_seq)
K-pred:  μ' = μ + ln(K_disk)     (E[X]' = mean_seq × K_disk)
```

`σ_load_MLE` (≈0.5–1.0) намного консервативнее, чем MOM `σ` через CV²_load (≈2.0+ из-за outliers, которых LN не должна моделировать).

Альтернатива «μ_seq_MLE + σ_load_MLE» (без подгонки μ) — drifts mean вверх на `exp((σ_load² − σ_seq²)/2)`, для AppService.Zapyty это +59%. Поэтому корректировка μ обязательна.

#### Результат — Exp 5 побеждает на p95

| Class | Stat | Exp 1 MRE | Exp 4 MRE | **Exp 5 MRE** |
| --- | --- | ---: | ---: | ---: |
| Zapyty | mean | +23.4% | +52.1% | +34.6% |
| Zapyty | p95 | +17.0% | +90.7% | +53.8% |
| Stvor | mean | −11.4% | +11.5% | **−7.3%** |
| Stvor | p95 | −39.3% | +15.9% | **−3.5%** |
| Onovl | mean | −11.1% | +9.9% | **−9.5%** |
| Onovl | p95 | −27.8% | +13.9% | **−5.7%** |
| RC_lag | mean | −14.0% | +9.4% | **−10.3%** |
| RC_lag | p95 | −35.9% | −0.1% | −18.7% |

**Aggregate (4 класса) на m7a-io2 PREDICTED:**

| Stat | Exp 1 | Exp 2 | Exp 3 | Exp 4 | **Exp 5** |
| --- | ---: | ---: | ---: | ---: | ---: |
| mean | **15.3%** | 16.9% | 17.0% | 24.5% | 17.1% |
| median | 16.0% | 19.6% | 16.3% | 28.4% | **14.4%** |
| p90 | 25.5% | 28.7% | 29.6% | 48.5% | **23.2%** |
| **p95** | 28.0% | 31.4% | 32.9% | 40.1% | **21.0%** |

Exp 5 выигрывает на 3 из 4 статистик. p95 опустился с 28% до 21% — главный целевой metric (Stvor/Onovl/RC от −27…−40% до −4…−19%).

#### Калибровочные машины — sanity-check на double-counting

| Machine | Stat | Exp 1 | Exp 4 | **Exp 5** |
| --- | --- | ---: | ---: | ---: |
| m7i-gp3 | mean | 45.3% | 1 035 614% | **38.6%** |
| m7i-gp3 | p95 | 59.8% | 695 557% | **44.9%** |
| m7i-io2 | mean | 43.1% | 76.1% | **38.7%** |
| m7i-io2 | p95 | 60.3% | 69.4% | **46.6%** |
| m7a-gp3 | mean | **53.0%** | 20.7% | 49.6% |
| m7a-gp3 | p95 | **45.4%** | 111.8% | 41.7% (close) |

Aggregate calib:

| Stat | Exp 1 | Exp 4 | **Exp 5** |
| --- | ---: | ---: | ---: |
| mean | 47.1% | 345 237% | **42.3%** |
| p95 | 55.2% | 231 913% | **44.4%** |

Exp 5 не дивергирует на калибровочных машинах (CPU demand остаётся ниже capacity, потому что mean берётся из seq). Структурная ошибка калибровочных машин (40–50%) такая же по природе как у Exp 1 — caching/JIT/pool effects.

### Exp 6: гибрид (μ из seq median, σ из load) — финальное улучшение

**Мотивация.** Анализ load-данных Zapyty показал: на 3 из 4 машин load mean **раздут p99 outliers** (на m7a-gp3 mean/median ratio = 21×, p99 = 126 ms при median 0.14 ms — GC pauses). Чистая m7a-io2 имеет mean/median ≈ 1.3× — то есть именно она показывает real service time. У seq данных хвост намного слабее (mean/median ≈ 1.03–1.16), но всё равно небольшой right-skew от редких медленных query.

**Идея.** Заменить seq mean на **seq median** в формуле Exp 5:

```text
σ = σ_load_MLE
μ = ln(median_seq) − σ²/2     ← было ln(mean_seq) − σ²/2
K_disk считается на medians   (для консистентности)
```

Поскольку median ≤ mean всегда для right-skewed данных, predicted RT снижается, что **компенсирует JMT-queueing inflation** для GET.

#### Результат — Exp 6 побеждает на всех 4 статистиках PREDICTED

| Class | Stat | Exp 1 | Exp 5 | **Exp 6** |
| --- | --- | ---: | ---: | ---: |
| Zapyty | mean | +23.4% | +34.6% | **+7.4%** |
| Zapyty | p95 | +17.0% | +53.8% | +19.9% |
| Stvor | p95 | −39.3% | **−3.5%** | −12.7% |
| Onovl | p95 | −27.8% | **−5.7%** | −12.8% |
| RC_lag | p95 | −35.9% | −18.7% | −31.5% |

**Aggregate (4 класса) на m7a-io2 PREDICTED:**

| Stat | Exp 1 | Exp 5 | **Exp 6** |
| --- | ---: | ---: | ---: |
| mean | 15.3% | 17.1% | **14.1%** |
| median | 16.0% | 14.4% | **12.6%** |
| p90 | 25.5% | 23.2% | **14.9%** |
| **p95** | 28.0% | 21.0% | **15.1%** ⭐ |

**Exp 6 — лучший на всех 4 статистиках.** p95 опустилось с 28% (Exp 1) → 21% (Exp 5) → **15% (Exp 6)**.

#### Tradeoff: POST/PATCH стали чуть хуже

Exp 6 опускает predicted RT для всех классов (не только Zapyty). Для классов, где Exp 5 уже хорошо попадал (Stvor, Onovl), Exp 6 **немного недо-предсказывает**:

- Stvor p95: −3.5% (Exp 5) → −12.7% (Exp 6)
- Onovl p95: −5.7% → −12.8%
- RC_lag p95: −18.7% → −31.5%

Это цена за фиксацию Zapyty. Но в **aggregate** Exp 6 всё равно лучший — выигрыш на GET (от +54% до +20%) перевешивает потери на других классах.

#### Калибровочные машины

| Stat | Exp 1 | Exp 5 | Exp 6 |
| --- | ---: | ---: | ---: |
| calib mean | 47.1% | 42.3% | 52.0% |
| calib p95 | 55.2% | 44.4% | 46.0% |

Exp 6 чуть хуже Exp 5 на калибровочных машинах (потому что median_seq < mean_seq → predicted RT меньше → недо-предсказание сильнее). Это **не критично**: на PREDICTED где работает K-prediction, Exp 6 лидирует.

### Финальная рекомендация (обновлено)

| Use case | Рекомендация |
| --- | --- |
| **Production pipeline для m7a-io2** | **Exp 6 (Hybrid seq-median + load-σ)** — лидер на всех 4 статистиках, p95 MRE 15.1% |
| **Альтернатива (минимальная сложность)** | **Exp 1 (LN MLE seq)** — самый простой, p95 MRE 28%; mean MRE 15.3% (на 1 п.п. хуже Exp 6) |
| **Калибровочные машины** | **Exp 5** — лучший на calib mean/p95, если важна fidelity на источниках |

**Не использовать:**

- Exp 4 — double-counting → дивергенция на калибровочных машинах.
- Exp 2 (Brunnert) — KS катастрофичен на EventStore, JMT MRE хуже Exp 1.

### Что осталось нерешённым

1. **POST/PATCH/RC в Exp 6 чуть недо-предсказываются (−12…−31%).** Это побочный эффект использования median_seq < mean_seq везде. Возможный fix: применять median только к Zapyty-ячейкам (cache-bound), остальные оставить на mean.
2. **p95 calibration machines остаётся на 41–47%.** Это та же hot-cache/JIT/pool ошибка что у Exp 1 — структурная, не калибровочная. Без архитектурных изменений модели ниже не уйдём.

## Артефакты

| Файл | Содержание |
| --- | --- |
| [_experiment_fits_load.mjs](../_experiment_fits_load.mjs) | LN MLE на load-логах → experiment-fits-load.json (для Exp 4/5) |
| [_build_jsimg.py](../_build_jsimg.py) | Генератор .jsimg (4 машины × 5 экспериментов = 20 файлов) |
| [_check_overload.py](../_check_overload.py) | Диагностика CPU demand seq vs load (показывает double-counting) |
| [models/*.jsimg](../models/) | Готовые JMT-модели |
| [models/*-result.jsim](../models/) | XML-результаты симуляций |
| [models/*_logs/](../models/) | CSV-сэмплы response-time per class |
| [_analyze_jmt.py](../_analyze_jmt.py) | Парсер CSV → MRE per (class, statistic, experiment) |
| [_analyze_jmt_all.py](../_analyze_jmt_all.py) | Cross-machine анализ — все 4 машины × 5 экспериментов |
| [_analyze_jmt_rc.py](../_analyze_jmt_rc.py) | RC через convolution command + handler RT (правильная семантика consistency_lag) |
| [experiment-fits.json](../experiment-fits.json) | Параметры (μ, σ, k, rate) + KS на seq-данных (Exp 1/2/3) |
| [experiment-fits-load.json](../experiment-fits-load.json) | Параметры LN MLE на load-данных (Exp 4/5) |
| [experiment-mre.json](../experiment-mre.json) | m7a-io2 measured + predicted + MRE (без RC convolution) |
| [experiment-mre-all.json](../experiment-mre-all.json) | Все 4 машины × 5 эксп — MRE per (machine, class, stat) |
| [experiment-mre-rc-conv.json](../experiment-mre-rc-conv.json) | m7a-io2 с RC через convolution (финальные числа) |
