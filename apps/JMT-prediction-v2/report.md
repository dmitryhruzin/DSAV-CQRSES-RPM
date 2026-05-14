<!-- markdownlint-disable MD013 MD024 MD040 -->

# JMT-prediction-v2: предсказание M7a.large io2 методом масштабирования диска

## Постановка задачи

Построить и откалибровать JMT-модели для **M7i.gp3**, **M7i.io2**, **M7a.gp3** (по двум вариациям — mCQRS и Classical CQRS) на основе метрик из логов. Затем по методу Brunnert et al. (масштабирование service demand дисковых операций) предсказать поведение **M7a.io2** под нагрузкой:

- 100 GET / 100 POST / 150 PATCH / 250 consistency запросов в секунду (Exponential interarrival)

Вывод — `avg, median, p90, p95, min, max, range, variance, stdev` времени отклика для каждого из 4 классов для двух вариаций (mCQRS и Classical CQRS).

## Метод

```text
K_op^io2 = S_op^{M7i,io2} / S_op^{M7i,gp3}      (для каждой дисковой операции)
S_op^{M7a,io2} = S_op^{M7a,gp3} × K_op^io2      (применяется к целевой машине)
```

**AppService (CPU) demand НЕ масштабируется** — диск не влияет на CPU.

## Топология модели (повторяет `apps/JMT-models/mCQRS.jsimg`)

5 станций:

- Старт (RandomSource, Exponential interarrival)
- Сервер (AppService, 2-server station — m7i.large / m7a.large имеют 2 vCPU)
- Сховище подій (EventStore, single-server)
- База даних знімків (SnapshotDB, single-server)
- База даних проєкцій (ProjectionDB, single-server)
- Стоп (JobSink)

4 открытых класса:

- Запити — Q, маршрут: Старт → Сервер → ProjectionDB → Стоп
- Команди створення — Cr (POST), маршрут: Старт → Сервер → EventStore → SnapshotDB → Стоп
- Команди оновлення — Upd (PATCH), маршрут: Старт → Сервер → EventStore → SnapshotDB → Стоп
- Процеси досягнення узгодженості — RC, маршрут: Старт → Сервер → ProjectionDB → Стоп

## Источник данных для калибровки

Sequential-режим логов (`apps/logs/*-seq.log`, без contention). Per-span статистика с правилами, согласованными с пользователем:

- `command.execute`, `query.execute`, `db.eventstore.{read,write}`, `db.snapshot.{read,write}`, `event.publishAll`, `http.request` — все вхождения.
- POST/PATCH `event.handle` — все вхождения.
- POST/PATCH `db.projection.write` — все вхождения.
- PATCH `db.projection.read` — на запрос count = H handlers; если R reads > H, первые (R−H+1) сливаются в одну запись (sum durations).
- GET `db.projection.read` — sum всех reads per request → 1 запись.

Средние **винсоризированы по p95** для подавления выбросов от Node.js stop-the-world (одиночные значения ~1000 ms искажают steady-state в JMT M/M/1).

## Калиброванные service demands (ms)

### mCQRS

| Машина | Класс | AppService | EventStore | SnapshotDB | ProjectionDB |
|---|---|---:|---:|---:|---:|
| M7i.gp3 | Q   | 0.574 | 0.000 | 0.000 | 0.634 |
| M7i.gp3 | Cr  | 2.403 | 0.296 | 0.510 | 0.000 |
| M7i.gp3 | Upd | 2.410 | 0.240 | 0.806 | 0.000 |
| M7i.gp3 | RC  | 1.780 | 0.000 | 0.000 | 0.931 |
| M7i.io2 | Q   | 0.524 | 0.000 | 0.000 | 0.597 |
| M7i.io2 | Cr  | 1.947 | 0.276 | 0.485 | 0.000 |
| M7i.io2 | Upd | 1.973 | 0.233 | 0.756 | 0.000 |
| M7i.io2 | RC  | 1.453 | 0.000 | 0.000 | 0.798 |
| M7a.gp3 | Q   | 0.470 | 0.000 | 0.000 | 0.567 |
| M7a.gp3 | Cr  | 2.245 | 0.258 | 0.434 | 0.000 |
| M7a.gp3 | Upd | 2.123 | 0.188 | 0.718 | 0.000 |
| M7a.gp3 | RC  | 1.545 | 0.000 | 0.000 | 0.788 |

### Classical CQRS

| Машина | Класс | AppService | EventStore | SnapshotDB | ProjectionDB |
|---|---|---:|---:|---:|---:|
| M7i.gp3 | Q   | 0.551 | 0.000 | 0.000 | 0.655 |
| M7i.gp3 | Cr  | 0.854 | 1.450 | 0.152 | 0.000 |
| M7i.gp3 | Upd | 1.276 | 1.628 | 0.706 | 0.000 |
| M7i.gp3 | RC  | 1.727 | 0.000 | 0.000 | 0.919 |
| M7i.io2 | Q   | 0.524 | 0.000 | 0.000 | 0.611 |
| M7i.io2 | Cr  | 0.853 | 1.043 | 0.140 | 0.000 |
| M7i.io2 | Upd | 1.225 | 1.234 | 0.599 | 0.000 |
| M7i.io2 | RC  | 1.408 | 0.000 | 0.000 | 0.803 |
| M7a.gp3 | Q   | 0.450 | 0.000 | 0.000 | 0.550 |
| M7a.gp3 | Cr  | 0.715 | 1.408 | 0.149 | 0.000 |
| M7a.gp3 | Upd | 0.964 | 1.455 | 0.674 | 0.000 |
| M7a.gp3 | RC  | 1.468 | 0.000 | 0.000 | 0.755 |

**Sanity:** для M7i.gp3 mCQRS PATCH винcoризированный `http.request` avg = 3.456 ms = 2.410 + 0.240 + 0.806 (сумма станций) ✓.

## Коэффициенты K_io2

### mCQRS K-коэффициенты

| Класс | AppService | EventStore | SnapshotDB | ProjectionDB |
|---|---:|---:|---:|---:|
| Q   | 1.000 | 1.000 | 1.000 | 0.942 |
| Cr  | 1.000 | 0.932 | 0.951 | 1.000 |
| Upd | 1.000 | 0.973 | 0.938 | 1.000 |
| RC  | 1.000 | 1.000 | 1.000 | 0.857 |

### Classical CQRS K-коэффициенты

| Класс | AppService | EventStore | SnapshotDB | ProjectionDB |
|---|---:|---:|---:|---:|
| Q   | 1.000 | 1.000 | 1.000 | 0.974 |
| Cr  | 1.000 | 0.719 | 0.923 | 1.000 |
| Upd | 1.000 | 0.758 | 0.849 | 1.000 |
| RC  | 1.000 | 1.000 | 1.000 | 0.874 |

io2 быстрее gp3 на всех дисковых операциях: 5–10% в mCQRS, до 28% в Classical CQRS (EventStore — доминирующий disk-путь Classical-варианта).

## Предсказанные метрики M7a.large io2

Нагрузка: 100 GET/s + 100 POST/s + 150 PATCH/s + 250 RC/s. Exponential interarrival. По 300 000 семплов на класс из JMT verbose Response Time per Sink CSV. **Все значения в ms.**

### M7a.io2 — mCQRS

| Класс | avg | median | p90 | p95 | min | max | range | variance | stdev |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Запити                          | 1.82 | 1.32 | 3.91 | 5.17 | 0.002 | 20.79 | 20.79 | 2.848 | 1.69 |
| Команди створення               | 3.57 | 2.89 | 7.11 | 8.86 | 0.011 | 24.89 | 24.87 | 7.108 | 2.67 |
| Команди оновлення               | 3.64 | 2.99 | 7.07 | 8.73 | 0.020 | 24.53 | 24.50 | 6.858 | 2.62 |
| Процеси досягнення узгодженості | 2.95 | 2.41 | 5.86 | 7.21 | 0.007 | 22.85 | 22.84 | 4.828 | 2.20 |

### M7a.io2 — Classical CQRS

| Класс | avg | median | p90 | p95 | min | max | range | variance | stdev |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Запити                          | 1.31 | 1.05 | 2.64 | 3.30 | 0.008 | 10.93 | 10.92 | 1.053 | 1.03 |
| Команди створення               | 2.45 | 2.05 | 4.68 | 5.73 | 0.049 | 16.51 | 16.46 | 2.874 | 1.70 |
| Команди оновлення               | 3.20 | 2.81 | 5.76 | 6.92 | 0.020 | 18.48 | 18.46 | 3.791 | 1.95 |
| Процеси досягнення узгодженості | 2.41 | 1.98 | 4.74 | 5.78 | 0.015 | 18.03 | 18.02 | 3.052 | 1.75 |

## Валидация (smoke-test)

Предсказание сравнивается с реальным M7a.io2 Load (эти данные не использовались в калибровке):

| Вариация | Класс | predicted avg (ms) | measured Load avg (ms) | Δ |
|---|---|---:|---:|---:|
| mCQRS     | Q   | 1.82 | 1.63 | +12 % |
| mCQRS     | Cr  | 3.57 | 3.67 |  −3 % |
| mCQRS     | Upd | 3.64 | 4.21 | −14 % |
| mCQRS     | RC  | 2.95 | 2.89 |  +2 % |
| Classical | Q   | 1.31 | 1.64 | −20 % |
| Classical | Cr  | 2.45 | 2.76 | −11 % |
| Classical | Upd | 3.20 | 4.27 | −25 % |
| Classical | RC  | 2.41 | 4.43 | −46 % |

**Для request-path классов (Q/Cr/Upd) предсказание в пределах ±25%**, что характерно для open-class M/M/1 модели. Большое расхождение в Classical RC (−46%) — модель не учитывает Node.js single-thread event-loop serialization, которая доминирует в реальных measured Load-данных при 600 j/s.

## Структура папки

```text
apps/JMT-prediction-v2/
├── extract_demands.py          # парсит логи → demands.json
├── compute_k.py                # demands.json → K_io2.json
├── build_jsimg.py              # генерирует 8 .jsimg
├── run_simulations.py          # JMT CLI запуски
├── analyze_results.py          # парсит результаты → analysis.json
├── demands.json
├── K_io2.json
├── predicted_demands_m_cqrs.json
├── predicted_demands_classical_cqrs.json
├── load_arrivals.json
├── analysis.json
├── run_summary.json
├── models/                     # 8 .jsimg файлов
│   ├── m7i-gp3_{m_cqrs,classical_cqrs}.jsimg
│   ├── m7i-io2_{m_cqrs,classical_cqrs}.jsimg
│   ├── m7a-gp3_{m_cqrs,classical_cqrs}.jsimg
│   └── m7a-io2_{m_cqrs,classical_cqrs}_predicted.jsimg
├── results/                    # JMT result XMLs
└── jmt_logs/                   # verbose Response Time CSVs (300k samples/class)
```

## Воспроизведение

```bash
cd apps/JMT-prediction-v2/
python3 extract_demands.py
python3 compute_k.py
python3 build_jsimg.py
python3 run_simulations.py
python3 analyze_results.py
```
