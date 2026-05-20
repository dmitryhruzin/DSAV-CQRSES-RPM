# Task: построение per-request метрик для JMT-калибровки

Recipe для одной вариации (`m_cqrs` или `classical_cqrs`). На каждом шаге указан скрипт-помощник и место выхода.

## Исходные данные

Логи телеметрии в [logs/](logs/), формат — JSONL pino с telemetry-спанами. Имена файлов: `<inst>-<storage>-<variation>-<mode>.log`, где:

- `inst` ∈ {`m7i`, `m7a`, `m7g`} — семейство EC2
- `storage` ∈ {`gp3`, `io2`} — тип EBS
- `variation` ∈ {`m_cqrs`, `classical_cqrs`}
- `mode` ∈ {`seq`, `load`}

Для каждой вариации ожидаем минимум 8 логов: 4 машины × {seq, load}.

## Шаг 1 — отрезать warm-up (первые 10 секунд нагрузки)

**Скрипт:** [_skip10.mjs](_skip10.mjs)

```bash
cd apps/JMT-prediction-manual
node _skip10.mjs
```

Что делает:

1. Для каждого `*.log` в [logs/](logs/) определяет `anchor` = `startedAt` самого первого `http.request` спана.
2. Помечает на удаление все `req.id`, у которых `http.request.startedAt < anchor + 10000 мс`.
3. Записывает в [logs10/](logs10/) копию файла, из которой удалены **все строки** этих req-id (любые их спаны: db.*, event.handle, …). Записи без `req.id` (boot / системные) сохраняются.

Якорь — именно первый `http.request`, а не первая запись лога (иначе server boot за минуты до нагрузки мог бы съесть весь skip-окно и ни один запрос не отрезаться).

**Куда смотреть:** stdout с per-file отчётом `totalReqs / dropReqs / linesKept / linesDropped`.

> Расширение на новую вариацию: положить новые `*.log` в [logs/](logs/) и перезапустить скрипт. Файлы для других вариаций обработаются автоматически.

## Шаг 2 — посчитать per-request метрики из *-seq логов

**Скрипт:** [_analyze_seq.mjs](_analyze_seq.mjs)

```bash
node _analyze_seq.mjs
```

Входы: `logs10/*-seq.log`. Список файлов задан в `LOG_FILES` внутри скрипта — **обновить под текущую вариацию** перед запуском.

Группировка: по `req.id`. Для каждой группы суммируются длительности всех спанов с заданным именем; **отсутствующий спан = 0 мс**.

Метрики (все в миллисекундах, per-request scalar):

### GET

| # | Метрика | Формула |
| --- | --- | --- |
| 1 | responseTime | `http.request.durationMs` (из telemetry-спана, НЕ pino `responseTime`) |
| 2 | query.execute − db.projection.read | `Σ query.execute − Σ db.projection.read` |
| 3 | db.projection.read | `Σ db.projection.read` |

### POST

| # | Метрика | Формула |
| --- | --- | --- |
| 1 | responseTime | `http.request.durationMs` |
| 2 | req_start → last event.handle end | `max(event.handle.startedAt + durationMs) − http.request.startedAt` |
| 3 | command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write | алгебра сумм |
| 4 | db.eventstore.write | `Σ db.eventstore.write` |
| 5 | db.snapshot.read + db.snapshot.write | `Σ db.snapshot.read + Σ db.snapshot.write` |
| 6 | event.handle − db.projection.write | `Σ event.handle − Σ db.projection.write` |
| 7 | db.projection.write | `Σ db.projection.write` |

### PATCH

| # | Метрика | Формула |
| --- | --- | --- |
| 1 | responseTime | `http.request.durationMs` |
| 2 | req_start → last event.handle end | `max(event.handle.startedAt + durationMs) − http.request.startedAt` |
| 3 | command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write | алгебра сумм |
| 4 | db.eventstore.write | `Σ db.eventstore.write` |
| 5 | db.snapshot.read + db.snapshot.write | `Σ db.snapshot.read + Σ db.snapshot.write` |
| 6 | event.handle − db.projection.read − db.projection.write | `Σ event.handle − Σ db.projection.read − Σ db.projection.write` |
| 7 | db.projection.read | `Σ db.projection.read` |
| 8 | db.projection.write | `Σ db.projection.write` |

Статистики (population) по каждой выборке:

- `count`, `mean`, `median`, `p90`, `p95`
- `variance` (σ²) — population variance
- `stdev` (σ)
- `CV²` = σ² / mean²

**Выход:** [log-analisis-seq.md](log-analisis-seq.md) — одна секция на лог, по 3 таблицы (GET / POST / PATCH) с выровненными колонками.

> Расширение на новую вариацию: обновить массив `LOG_FILES` в [_analyze_seq.mjs](_analyze_seq.mjs) и/или переключить выходной путь (`OUT`) на `log-analisis-seq-<variation>.md`, чтобы файлы не затирались.

## Шаг 3 — посчитать per-request метрики из *-load логов и сверить с `analyz-10.md`

### 3a. Раздельный анализ под нагрузкой

**Скрипт:** [_analyze_load.mjs](_analyze_load.mjs)

```bash
node _analyze_load.mjs
```

Идентичен [_analyze_seq.mjs](_analyze_seq.mjs) — те же формулы, тот же набор GET/POST/PATCH-метрик, та же статистика, тот же формат вывода. Отличается только списком файлов `LOG_FILES` (берёт `*-load.log` из [logs10/](logs10/)) и путём выхода.

**Выход:** [log-analisis-load.md](log-analisis-load.md).

> Расширение на новую вариацию: тот же приём, что для seq — обновить `LOG_FILES` или `OUT` в скрипте.

### 3b. Сверка с `apps/logs/analyz-10.md`

**Скрипт:** [_compare_load_vs_analyz10.mjs](_compare_load_vs_analyz10.mjs)

```bash
node _compare_load_vs_analyz10.mjs
```

Зачем: убедиться, что наш конвейер `logs/ → logs10/ → log-analisis-load.md` даёт те же числа, что независимый анализатор [`apps/logs/analyz-10.md`](../logs/analyz-10.md). Если расхождения уйдут за ~1% — значит сломался pipeline (warm-up skip / парсер / агрегация), и нужно разбираться **до** того, как двигаться к JMT-калибровке.

Соответствие метрик:

| Наша метрика | Метрика в analyz-10 |
| --- | --- |
| GET responseTime | GET http.request |
| POST responseTime | POST http.request |
| POST `req_start → last event.handle end` | POST consistency_lag |
| PATCH responseTime | PATCH http.request |
| PATCH `req_start → last event.handle end` | PATCH consistency_lag |

Что делает скрипт:

1. Парсит [`analyz-10.md`](../logs/analyz-10.md) — извлекает per-(filename, method) числа `http.request` и `consistency_lag`.
2. Заново считает наши числа по `logs10/*-load.log`, **фильтруя только успешные запросы** (`success === true` ∧ `200 ≤ status < 400`) — потому что analyz-10 считает только по `ok`. Это сознательное отличие от [log-analisis-load.md](log-analisis-load.md), который считает всё.
3. Кладёт side-by-side таблицу `mine | analyz-10 | Δabs | Δ%` для семи статистик (count, mean, median, p90, p95, variance, stdev).
4. В первой строке вывода — `Максимальная относительная ошибка по всем строкам`, чтобы быстро ловить регрессии.

**Выход:** [log-load-vs-analyz10.md](log-load-vs-analyz10.md).

**Результат текущей сверки (m_cqrs):** max |Δ%| = **0.23%** (`m7i-gp3-m_cqrs-load / GET / http.request / median`), все counts совпадают точно — расхождения только из-за того, что analyz-10 хранит 2 десятичных знака. Конвейер валиден ✅.

> Расширение на новую вариацию: обновить `LOG_FILES` в скрипте. analyz-10.md уже содержит блоки и для `classical_cqrs` — парсер находит их по имени файла автоматически.

## Шаг 4 — отрезать retry-инфляцию в event.handle

**Скрипт:** [_strip_retries.mjs](_strip_retries.mjs)

```bash
node _strip_retries.mjs
```

Зачем: проекционные хендлеры в [`apps/m-cqrs/src/**/projections/*.ts`](../m-cqrs/src) на `VersionMismatchError` делают `await new Promise(resolve => setTimeout(resolve, 1000))` и рекурсивно ретраят (до 3 раз). Это инфлирует `event.handle.durationMs` на `N × 1000ms` при `N` ретраях — синтетические outlier-ы, которые **не часть service-time**.

Что делает:

1. Для каждого `event.handle` спана: если `durationMs > 500ms` → считаем `N = round(durationMs / 1000)`, вычитаем `N × 1000ms`.
2. Помечаем строку: `retryStripped: true, retries: N, originalDurationMs: <old>`.
3. Записывает в [logs10-noretry/](logs10-noretry/) копию с очищенными спанами.

После strip CV² PATCH RC AppService упал с **45–78 до 0.23–0.27** — драматическое улучшение для калибровки.

Детально: [_inspect_event_handle.mjs](_inspect_event_handle.mjs) (анализирует, где лежат outlier-ы) и [event-handle-strip-verification.md](event-handle-strip-verification.md) (per-span before/after по 4 машинам).

**После Шага 4**: перезапустить `_analyze_seq.mjs` и `_analyze_load.mjs` с обновлёнными скриптами, которые читают из `logs10-noretry/` вместо `logs10/`.

> Расширение на новую вариацию: автоматически, если в скрипте `LOG_FILES` обновлены (любой `.log` в `logs10/` обрабатывается).

## Шаг 5 — MOM vs MLE сравнение и выбор стратегии фита

**Скрипт:** [_fit_compare.mjs](_fit_compare.mjs)

```bash
node _fit_compare.mjs
```

Зачем: при наличии heavy-tail в данных (как `db.eventstore.write` с CV²=7.49) метод моментов (MOM) даёт LN-фит с медианой 0.10 мс при эмпирической 0.23 мс — катастрофа. Метод максимального правдоподобия (MLE) на log-значениях робастен к редким выбросам и даёт корректный фит.

Что делает: для каждой `(machine, method, metric)` считает MOM и MLE параметры Lognormal, измеряет KS distance к эмпирической CDF, объявляет победителя.

**Результат:** MLE выигрывает в **67 из 72 (93%)** случаев. Решение: **используем MLE для всех станций**.

Подробности: [log-fit-comparison.md](log-fit-comparison.md), теория — [docs/distribution-method-selection.md §4](docs/distribution-method-selection.md).

## Шаг 6 — выбор семейства распределения per (machine, station, class)

Основное обсуждение: [docs/distribution-method-selection.md](docs/distribution-method-selection.md).

Контекст: JMT позволяет на каждой станции каждой машины задавать своё распределение. Возникают два варианта:

1. **Универсальный Lognormal MLE** — одно семейство, разные `(μ, σ)` per machine. Поддерживает K-prediction (μ' = μ + ln(K_disk), σ inherited).
2. **Brunnert-эвристика** — семейство выбирается по CV²: `<0.5 → Erlang-k`, `0.5–1.5 → Exp`, `>1.5 → Lognormal`. Для cross-machine консистентности (нужной для K-prediction) фиксируется по CV² базовой машины (m7a-gp3).

**Ключевой нюанс:** разное семейство на m7i и m7a для одной станции **технически возможно**, но **ломает K-prediction**, потому что формула переноса формулируется в терминах конкретного семейства (для LN: σ inherited; для Exp: нет σ → нечего инхеритить).

## Шаг 7 — эксперимент: Lognormal MLE vs Brunnert (KS-фит)

**Скрипт:** [_experiment_fits.mjs](_experiment_fits.mjs)

```bash
node _experiment_fits.mjs
```

Что делает: для каждой `(machine, station, class)` фитит:

- **Exp 1**: Lognormal MLE
- **Exp 2**: Brunnert family (по CV² m7a-gp3) с MLE-параметрами

Считает KS-distance к эмпирической CDF для обоих фитов и агрегирует по 4 машинам × 13 ячейкам = 52 сравнения.

**Выход:** [experiment-fits.json](experiment-fits.json) (полные параметры) + [docs/experiment-design.md](docs/experiment-design.md) (документ с результатами).

**Результат:**

| Эксперимент | Mean KS | Wins / 52 |
| --- | ---: | ---: |
| Exp 1 (LN MLE everywhere) | **0.216** | **33** |
| Exp 2 (Brunnert) | 0.293 | 19 |

**LN MLE убедительно выигрывает** по среднему KS (на 36% лучше). Основная причина проигрыша Brunnert — `EventStore`: на m7a-gp3 CV²~0.8 → Brunnert выбирает Exp, но на m7i CV²~3 → Exp даёт KS 0.45–0.55 vs LN KS 0.15–0.22.

**Решение:** baseline pipeline — **Lognormal MLE на всех станциях**.

**Опциональная гибридная схема** — точечный Erlang-k там, где он систематически выигрывает по всем 4 машинам:

- `AppService.Onovl` → Erlang-9
- `ProjectionDB.RC.POST` → Erlang-3

Подробности: [docs/experiment-design.md](docs/experiment-design.md).

## Шаг 8 — JMT-симуляция и MRE-сравнение ✅

**Скрипты:** [_build_jsimg.py](_build_jsimg.py) (генератор `.jsimg`), [_analyze_jmt.py](_analyze_jmt.py) (анализ m7a-io2), [_analyze_jmt_all.py](_analyze_jmt_all.py) (анализ всех 4 машин).

```bash
python3 _build_jsimg.py       # генерирует 12 файлов (3 эксп × 4 машины) → models/
# Запуск JMT на каждом:
for f in models/*.jsimg; do
  java -cp "/Applications/Java Modelling Tools/JMT.jar" jmt.commandline.Jmt sim "$f"
done
python3 _analyze_jmt_all.py   # MRE per (machine, class, stat) → experiment-mre-all.json
```

Что сделано:

1. ✅ Сгенерированы `.jsimg` для **4 машин × 3 эксперимента = 12 моделей**.
2. ✅ JMT CLI отработал все 12 симуляций успешно (200k samples × 4 класса каждая).
3. ✅ Посчитана MRE предсказанного response-time vs measured load.
4. ✅ Sanity-check на 3 калибровочных машинах (где K не применяется).

### Ключевые результаты

**MRE на предсказанной m7a-io2** (mean of |MRE| по Zapyty/Stvor/Onovl):

| Stat | **Exp 1 (LN MLE)** | Exp 2 (Brunnert) | Exp 3 (Hybrid) |
| --- | ---: | ---: | ---: |
| mean | **15.3%** | 16.9% | 17.0% |
| median | **16.0%** | 19.6% | 16.3% |
| p90 | **25.5%** | 28.7% | 29.6% |
| p95 | **28.0%** | 31.4% | 32.9% |

**Победитель: Exp 1 (Lognormal MLE)** — лучше на всех 4 статистиках.

**Неожиданное:** на калибровочных машинах (где K не применяется) MRE = **40–55%** — в 3 раза хуже, чем на предсказанной m7a-io2. Это означает, что bulk остающейся ошибки — **структурный bias seq→load калибровки** (cache effects, JIT, connection pool warming), а не ошибка K-prediction. K-prediction случайно компенсирует часть этой ошибки на m7a-io2.

**Финальная рекомендация: Lognormal MLE (Exp 1)** как production pipeline. См. полный отчёт в [docs/jmt-results.md](docs/jmt-results.md).

### Что осталось как future work

- Калибровка по load-логам (а не seq) для устранения cache-bias.
- Двух-фазная модель ProjectionDB с probability cache-hit/miss.
- Прогон m_cqrs vs classical_cqrs (сейчас сделан только m_cqrs).

## Соглашения

- Якорь warmup-skip-а и формула `req_start → last event.handle end` берут `startedAt` именно `http.request` (не `time` записи).
- Все формулы оперируют **суммой** длительностей спанов с указанным именем в рамках одного `req.id`. Если спан встречается N раз — суммируются все N.
- Никакой winsorization / clipping на этом шаге не применяется: получаем raw-распределение. Это сознательно отличается от `apps/JMT-prediction-v4/extract_demands.py` (где есть p95/p98-winsorize) — там подгонка под средние JMT-демэнды, а здесь мы изучаем сырое распределение.
- Population variance, не sample: делим на `n`, не `n−1`.
