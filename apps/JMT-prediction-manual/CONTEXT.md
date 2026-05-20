# Контекст: JMT-prediction-manual — pipeline и текущее состояние

Этот файл — компактная сводка всего, что мы сделали, чтобы продолжить работу в новом чате без потери контекста. Все детали лежат в исходных файлах по ссылкам.

## Цель работы

Построить **JMT queueing-network модель** PostgreSQL+Node.js CQRS-системы и через **K-prediction** предсказать response-time под нагрузкой на машине **m7a.large io2**, используя только seq-логи 3 калибровочных машин (m7i.large gp3, m7i.large io2, m7a.large gp3).

- Корневая директория: `apps/JMT-prediction-manual/`
- Рабочая вариация: **`m_cqrs`** (вариант с manual CQRS event store). Classical CQRS пока не делали.
- Все артефакты — там же.

## Топология системы

Open-network с 4 станциями и 4 классами:

- **Станции:** AppService (2 vCPU), EventStore, SnapshotDB, ProjectionDB.
- **Классы:** Zapyty (GET-запросы), Stvor (POST-команды), Onovl (PATCH-команды), RC (event-handlers).
- **Routing:**
  - Zapyty: Start → AppService → ProjectionDB → Stop
  - Stvor/Onovl: Start → AppService → EventStore → SnapshotDB → Stop
  - RC: Start → AppService → ProjectionDB → Stop
- **JMT-station Cyrillic IDs:** `Старт` (Start), `Стоп` (Stop), `Сервер` (AppService), `Сховище подій` (EventStore), `База даних знімків` (SnapshotDB), `База даних проєкцій` (ProjectionDB).

## Что было сделано (Шаги 1–8)

### Шаг 1 — отрезать warm-up

**Скрипт:** `_skip10.mjs` → пишет в `logs10/` копию `logs/*.log` с удалёнными запросами за первые 10 секунд от первого `http.request`. Якорь = первый `http.request.startedAt`, не первая запись лога (иначе server boot за минуты до нагрузки съест skip-окно).

### Шаг 2 — per-request метрики из *-seq логов

**Скрипт:** `_analyze_seq.mjs` → пишет `log-analisis-seq.md`. Группировка по `req.id`, суммирование спанов по имени. Отсутствующий спан = 0 мс. Per-метрика статистики: count, mean, median, p90, p95, variance, stdev, CV².

Ключевые per-request метрики:

- GET: `responseTime`, `query.execute − db.projection.read`, `db.projection.read`
- POST: `responseTime`, `req_start → last event.handle end`, `command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write`, `db.eventstore.write`, `db.snapshot.read + db.snapshot.write`, `event.handle − db.projection.write`, `db.projection.write`
- PATCH: то же + `event.handle − db.projection.read − db.projection.write`, `db.projection.read`, `db.projection.write`

### Шаг 3 — *-load логи + сверка с `apps/logs/analyz-10.md`

**Скрипты:** `_analyze_load.mjs` → `log-analisis-load.md`; `_compare_load_vs_analyz10.mjs` → `log-load-vs-analyz10.md`. Max |Δ%| = 0.23% — pipeline валидирован.

### Шаг 4 — отрезать retry-инфляцию

**Скрипт:** `_strip_retries.mjs` → пишет `logs10-noretry/`. В коде проекций (`apps/m-cqrs/src/**/projections/*.ts`) на `VersionMismatchError` делается `await setTimeout(1000)` и рекурсивный retry (до 3 раз) → `event.handle.durationMs` раздувается на N×1000ms при N retries.

После strip: CV² для PATCH RC AppService **упал с 45–78 до 0.23–0.27** — драматическое улучшение для калибровки. Все остальные seq-метрики читаются из `logs10-noretry/`, не `logs10/`.

### Шаг 5 — MOM vs MLE

**Скрипт:** `_fit_compare.mjs` → `log-fit-comparison.md`. MLE выигрывает **67 из 72 случаев (93%)**. Для PATCH `db.eventstore.write` (CV²=7.49) MOM даёт KS=0.66, MLE — KS=0.22 (LN-медиана становится 0.247 vs истинная 0.232). **Решение: везде MLE.**

### Шаг 6 — выбор семейства распределения

Базовая идея описана в **`docs/distribution-method-selection.md`**. Рассмотрены 3 подхода:

- **Lognormal MLE everywhere** — простота, K-prediction чистая (μ' = μ + ln(K), σ inherited).
- **Brunnert (2015) per-CV²:** CV²<0.5 → Erlang-k, 0.5–1.5 → Exp, >1.5 → LN.
- **Гибрид:** LN MLE + точечно Erlang там, где он явно лучше.

Главный аргумент против Brunnert — `EventStore` имеет CV²=3+ на m7i и 0.7-2 на m7a. Brunnert даст разные семейства на разных машинах → K-prediction не определена. LN MLE покрывает любой CV² с одним семейством, σ — свойство инстанса, диск меняет только μ.

### Шаг 7 — эксперимент Эксп 1 (LN MLE) vs Эксп 2 (Brunnert) vs Эксп 3 (Hybrid) на KS-фите

**Скрипт:** `_experiment_fits.mjs` → `experiment-fits.json`. Документация в `docs/experiment-design.md`.

- **Эксп 1**: LN MLE на всех 13 (station, class) ячейках.
- **Эксп 2**: Brunnert. По CV² m7a-gp3 (база для K) выбирает Erlang-k / Exp / LN. 9 ячеек → Erlang, 2 → Exp, 2 → LN.
- **Эксп 3**: LN MLE везде + `AppService.Onovl` → Erlang-9, `ProjectionDB.RC.POST` → Erlang-3 (две ячейки, где Erlang системно лучше по KS на всех 4 машинах).

Aggregate KS (4 машины × 13 ячеек = 52 значения):

| Эксп | Mean KS | Wins |
|---|---:|---:|
| **Exp 1 (LN MLE)** | **0.216** | **33/52** |
| Exp 2 (Brunnert) | 0.293 | 19/52 |
| Exp 3 (Hybrid) | 0.211 | (свопает 8 ячеек, остальные = Exp 1) |

Brunnert проигрывает катастрофически на EventStore (Exp дает KS 0.45–0.55 vs LN 0.15–0.22).

### Шаг 8 — JMT-симуляция и MRE

**Скрипты:** `_build_jsimg.py` (генератор), `_analyze_jmt.py` (анализ m7a-io2), `_analyze_jmt_all.py` (все 4 машины), `_analyze_jmt_rc.py` (RC через convolution). Документ: **`docs/jmt-results.md`**.

Сгенерированы 12 моделей: 4 машины × 3 эксп → `models/<machine>_<exp>.jsimg`. Запущены через JMT CLI:

```bash
java -cp "/Applications/Java Modelling Tools/JMT.jar" jmt.commandline.Jmt sim models/<file>.jsimg
```

Каждая модель — 200 000 sample × 4 класса. Полные XML результаты в `models/*-result.jsim`, raw response-time CSV в `models/<machine>_<exp>_logs/Стоп_<class>_Response Time per Sink.csv`.

**RC изначально сравнивали с `consistency_lag`, что было apples-to-oranges** (predicted = только handler, measured = от http.request до конца). Переделали через convolution: `predicted_consistency_lag = command_RT + RC_handler_RT` (event-bus delay ≈ 0 эмпирически, проверено).

#### Итоговые числа m7a-io2 (predicted vs measured)

**Mean (мс):**

| Source | Zapyty | Stvor | Onovl | RC_lag |
|---|---:|---:|---:|---:|
| Measured | 1.001 | 2.850 | 3.123 | 5.300 |
| Exp 1 pred | 1.234 | 2.524 | 2.776 | 4.560 |
| Exp 1 MRE | **+23.4%** | −11.4% | −11.1% | −14.0% |
| Exp 2 pred | 1.303 | 2.571 | 2.789 | 4.670 |
| Exp 2 MRE | +30.3% | **−9.8%** | **−10.7%** | **−11.9%** |
| Exp 3 pred | 1.269 | 2.519 | 2.729 | 4.592 |
| Exp 3 MRE | +26.8% | −11.6% | −12.6% | −13.4% |

**p95 (мс):**

| Source | Zapyty | Stvor | Onovl | RC_lag |
|---|---:|---:|---:|---:|
| Measured | 2.249 | 5.649 | 6.018 | 10.196 |
| Exp 1 pred | 2.632 | 3.429 | 4.346 | 6.538 |
| Exp 1 MRE | **+17.0%** | −39.3% | −27.8% | −35.9% |
| Exp 2 pred | 3.012 | 3.741 | 4.416 | 6.998 |
| Exp 2 MRE | +33.9% | **−33.8%** | **−26.6%** | **−31.4%** |
| Exp 3 pred | 2.812 | 3.409 | 3.964 | 6.669 |
| Exp 3 MRE | +25.0% | −39.6% | −34.1% | −34.6% |

**Aggregate (4 класса):**

- Mean: Exp 1 = **15.0%**, Exp 2 = 15.7%, Exp 3 = 16.1%
- p95: Exp 1 = **30.0%**, Exp 2 = 31.4%, Exp 3 = 33.3%

**Sanity-check на калибровочных машинах** (без K-prediction): MRE 40–55% на всех трёх. Это значит, что bulk остающейся ошибки — **структурный seq→load bias** (cache effects, JIT, connection pool warming), а **не** K-prediction. На m7a-io2 K случайно компенсирует часть этого bias.

**Рекомендация:** Exp 1 (Lognormal MLE) как production pipeline.

## Где сейчас находимся (открытые вопросы)

### Известные проблемы модели

1. **GET (Zapyty) переоценивается на +17…+47%.** Структурная ошибка от caching под нагрузкой. Смена family не помогает (Brunnert Erlang только ухудшил).
2. **POST/PATCH p95 недооценивается на −27…−40%.** Реальный load CV² в **5–9 раз больше** seq CV². Узкое seq-распределение не ловит burst-arrivals, GC pauses, lock contention, connection pool stalls, network jitter.

### Последний открытый вопрос — как уменьшить p95 MRE?

Мой главный предложение: **Эксперимент 4 — калибровка по load-логам вместо seq.**

```text
seq CV² (m7a-gp3): 0.10–0.18 для responseTime
load CV² (m7a-io2): 0.56–1.58 для responseTime
                    ↑ ×5–9 больше
```

Pipeline:
1. Брать per-(station, class) spans из `logs10-noretry/*-load.log` (а не `*-seq.log`)
2. Фитить LN MLE как обычно
3. K_disk пересчитать на load-данных m7i (а не seq)
4. Применить K к m7a-gp3 load-params → predicted m7a-io2
5. Прогнать JMT, сравнить MRE

**Риск:** load-spans включают local queueing (db connection pool, knex queue). Накладывая JMT queueing сверху → double-counting. **Митигейшен:** проверить на калибровочных машинах. Если JMT с load-калиброванными params переоценивает p95 на m7a-gp3 (где ground truth есть) → есть double-counting, нужно deflate CV² или снизить arrival rate.

Ожидаемый эффект: p95 MRE может упасть с 30% до 15–20%.

**Альтернативы (менее приоритетные):**

- Pareto distribution для DB-станций (очень тяжёлый хвост)
- MMPP-2 для bursty arrival process
- Cache-station в топологии (probabilistic routing к fast-cache vs slow-disk)

## Ключевые файлы

### Скрипты pipeline

| Файл | Что делает |
|---|---|
| `_skip10.mjs` | Шаг 1: отрезать warm-up (logs/ → logs10/) |
| `_analyze_seq.mjs` | Шаг 2: per-request метрики seq |
| `_analyze_load.mjs` | Шаг 3: per-request метрики load |
| `_compare_load_vs_analyz10.mjs` | Шаг 3b: сверка с analyz-10.md |
| `_strip_retries.mjs` | Шаг 4: убрать retry-инфляцию event.handle (logs10/ → logs10-noretry/) |
| `_fit_compare.mjs` | Шаг 5: MOM vs MLE сравнение |
| `_experiment_fits.mjs` | Шаг 7: фит параметров для 3 экспериментов + KS |
| `_build_jsimg.py` | Шаг 8: генератор JMT .jsimg моделей |
| `_analyze_jmt.py` | Шаг 8: парсер JMT результатов (m7a-io2) |
| `_analyze_jmt_all.py` | Шаг 8: cross-machine MRE |
| `_analyze_jmt_rc.py` | Шаг 8: RC через convolution command + handler |

### Выходные документы

| Файл | Что |
|---|---|
| `task.md` | Pipeline шаги 1–8 с описанием каждого |
| `docs/distribution-method-selection.md` | Обоснование выбора Lognormal MLE как baseline |
| `docs/experiment-design.md` | 3 эксперимента: pipeline, параметры, worked examples, сравнение KS |
| `docs/jmt-results.md` | Результаты JMT-симуляции, MRE, итоговая рекомендация |
| `log-analisis-seq.md` | Per-request статистики по seq-логам |
| `log-analisis-load.md` | То же для load-логов |
| `log-fit-comparison.md` | MOM vs MLE для каждой ячейки |
| `log-load-vs-analyz10.md` | Сверка с независимой analyz-10.md |
| `event-handle-strip-verification.md` | Доказательство, что strip retry корректен |

### Артефакты данных

| Файл | Что |
|---|---|
| `logs/` | Сырые логи: `<inst>-<storage>-<variation>-<mode>.log` |
| `logs10/` | После 10s skip |
| `logs10-noretry/` | После strip retry — **ОСНОВНОЙ источник данных для калибровки** |
| `experiment-fits.json` | Параметры (μ, σ, k, rate) + KS per (machine, station, class) для Exp 1/2 |
| `experiment-mre.json` | m7a-io2 measured + predicted + MRE |
| `experiment-mre-all.json` | Все 4 машины × 3 эксп |
| `experiment-mre-rc-conv.json` | RC через convolution (финальные числа) |
| `models/*.jsimg` | 12 JMT моделей |
| `models/*-result.jsim` | JMT XML результаты |
| `models/<machine>_<exp>_logs/Стоп_<class>_Response Time per Sink.csv` | Raw response-time samples (×200k каждый класс) |

## Конвенции

- **Якорь warm-up skip** = `startedAt` первого `http.request`, не первая запись лога.
- **Источник для калибровки** = `logs10-noretry/` (после retry-strip).
- **Population variance**, не sample (делим на n, не n-1).
- **MLE** для Lognormal: `μ = mean(ln xᵢ)`, `σ² = mean((ln xᵢ − μ)²)`.
- **K-prediction для LN**: `μ' = μ + ln(K_disk), σ' = σ`.
- **K-prediction для Erlang/Exp**: `rate' = rate / K_disk`.
- **JMT параметры в секундах** (не мс). Конверсия в `_build_jsimg.py:get_calibrated_params()`.
- **Erlang в JMT**: `ErlangPar(Double alpha, Long r)` — `r` обязательно `java.lang.Long`, не Integer.

## Следующие шаги (по убыванию приоритета)

1. **Эксп 4: load-калибровка.** Изменить `_experiment_fits.mjs` и `_build_jsimg.py` для чтения load-spans, перегенерировать jsimg, прогнать JMT, сравнить.
2. Если Эксп 4 решает p95 — это финальный pipeline. Если нет — попробовать Pareto / MMPP-2 / cache-station.
3. **Прогнать classical_cqrs** через тот же pipeline. Сейчас сделан только m_cqrs.
4. Возможный «cache modeling» — добавить probabilistic routing ProjectionDB↔Cache.

## Среда

- macOS, JMT в `/Applications/Java Modelling Tools/JMT.jar`
- Java 26
- Node.js (для .mjs скриптов), Python 3 (для .py скриптов)
- Все пути относительно `apps/JMT-prediction-manual/`

## Полный анализ открытых проблем

### Проблема 1: GET (Zapyty) переоценивается на +17…+47%

**Симптомы:**

| Эксперимент | Семейство Zapyty | mean MRE | p95 MRE |
| --- | --- | ---: | ---: |
| Exp 1 | LN MLE | +23.4% | +17.0% |
| Exp 2 | Erlang-10 (App) + Erlang-2 (PR) — Brunnert | +30.3% | +33.9% |
| Exp 3 | LN MLE | +26.8% | +25.0% |

**Что НЕ помогает (мы это уже проверили):**

| Смена | Эффект |
|---|---|
| LN → Erlang-10/Erlang-2 (Brunnert) | **Хуже** на 7–17 п.п. |
| LN → Exp (CV²=1) | Сильно хуже — реальный CV²=0.4 |
| Уменьшить σ у LN | Только хвост, не mean |
| Сменить shape любого распределения | Не меняет mean, только variance |

**Почему смена семейства не работает:** распределение определяет CV² (форму), а у нас неправильный **mean**. Чтобы исправить mean, нужно изменить **средний параметр** (μ для LN, rate для Erlang/Exp) — а это требует другого источника калибровки.

**Реальная причина:** под нагрузкой Zapyty mean = 1.001 мс, под seq m7a-gp3 — 1.090 мс. Реальный load **быстрее**, чем seq. Объяснения:

1. **Hot ProjectionDB cache.** Под постоянным потоком GET shared_buffers, plan cache, OS page cache греются. В seq машина холодная.
2. **Hot JIT/V8 optimization.** Node.js JIT включается полноценно при ~100/s, а не 1.3/s в seq.
3. **Hot connection pool.** pg-pool keep-alive под нагрузкой не делает re-handshake.

JMT берёт seq service-time (медленный) и добавляет queueing → переоценка.

**Возможные фиксы (по убыванию практичности):**

- **(A) Load-калибровка.** Калибровать service-times из `*-load.log`, а не `*-seq.log`. Real load учитывает hot cache.
- **(B) HyperExp/Empirical mixture.** Моделировать ProjectionDB как 80% cache-hit + 20% cache-miss с разными mean.
- **(C) Cache-station в топологии.** Probabilistic routing на fast-cache (~95%) или slow-disk (~5%).

(A) — самое лёгкое и наиболее перспективное.

### Проблема 2: POST/PATCH p95 недооценивается на −27…−40%

**Симптомы:**

| Класс | measured p95 | Exp 1 pred p95 | MRE |
| --- | ---: | ---: | ---: |
| Stvor | 5.649 | 3.429 | −39.3% |
| Onovl | 6.018 | 4.346 | −27.8% |
| RC_lag | 10.196 | 6.538 | −35.9% |

**Численная диагностика:**

| Метрика | seq CV² (m7a-gp3) | load CV² (m7a-io2) | Разница |
| --- | ---: | ---: | ---: |
| responseTime PATCH | 0.12 | 0.56 | **×4.7** |
| responseTime POST | 0.10 | 0.63 | **×6.3** |
| responseTime GET | 0.18 | 1.58 | **×8.8** |

Под нагрузкой CV² в 4–9 раз больше из-за: **burst-arrivals, GC pauses, lock contention, connection pool stalls, network jitter** — всё это **отсутствует в seq**.

JMT с seq σ + queueing-надбавкой (M/G/c) недостаточен, потому что утилизации низкие (App 32%, ES 6%, SN 17%, PR 36%) — queueing вносит мало в p95.

**Возможные фиксы:**

- **(A) Load-калибровка** — тот же фикс, что для GET. Реальный load CV² автоматически включает все эффекты.
  - **Риск:** double-counting queueing. load-spans уже включают local queueing → накладывая JMT queueing сверху → переоценка. Митигейшен: проверить на калибровочных машинах.
  - Ожидаемый MRE p95: 10–20% вместо 30–40%.
- **(B) Pareto/более тяжёлое семейство.** JMT поддерживает `jmt.engine.random.Pareto`. Очень тяжёлый хвост. Но трудно калибровать с small samples.
- **(C) MMPP-2 для bursty arrivals.** `jmt.engine.random.MMPP2` — 2-state Markov-modulated Poisson. Захватывает bursts. Но сложнее калибровать (4 параметра).
- **(D) Empirical inflation hack.** σ_predicted = σ_seq × 2 (или 1.5). Быстрый empirical hack, не теоретически чистый.

Из всех — **(A) load-калибровка** перекрывает обе проблемы (GET mean и POST/PATCH p95) одним подходом.

## Что было предложено как Эксперимент 4

**Pipeline:**

```text
Брать per-(station, class) spans из logs10-noretry/*-load.log (а не *-seq.log)
  → фитить LN MLE как обычно
  → K_disk пересчитать на load-данных m7i (а не seq)
  → применить K к m7a-gp3 load-params → predicted m7a-io2
  → прогнать JMT, сравнить MRE
```

**Имплементация:** переиспользует уже написанную инфраструктуру.

1. Адаптировать `_experiment_fits.mjs` (или сделать `_experiment_fits_load.mjs`) — изменить источник чтения с `*-seq.log` на `*-load.log`.
2. Адаптировать `_build_jsimg.py` принимать load-fits.
3. Сгенерировать 4 jsimg (4 машины × 1 эксп) и прогнать JMT.
4. Сравнить MRE с Exp 1/2/3.
5. Записать результаты в `docs/jmt-results.md`.

**Критерии успеха:**

- p95 MRE ≤ 20% → big win
- mean MRE ≤ 10% на Zapyty → большой шаг вперёд
- MRE на калибровочных машинах остаётся разумным (< 25%) → нет double-counting

**Если double-counting обнаружен** (на калибровочных машинах модель переоценивает): можно либо deflate load CV² (умножить σ на 0.7), либо снизить arrival rate в JMT.

## Последние сообщения в диалоге

1. Пользователь спросил «как можно уменьшить ошибку для p95?» — оба раза мой ответ: главная причина seq CV² в 5–9 раз меньше load CV²; рекомендую Эксп 4 (load-калибровка).
2. Пользователь спросил «есть смысл для GET-запросов выбрать другое распределение?» — оба раза мой ответ: нет, смена family не помогает (Brunnert хуже LN на 7–17 п.п.); проблема в **mean**, не в форме; нужна load-калибровка.

Ждём решения — реализовать Эксп 4 или предпочесть другой подход.
