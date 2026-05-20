# Эксперимент 16 — Exp 12 + AppService Processor Sharing

Exp 16 = [Exp 12](exp12-design.md) (m7i итеративная калибровка + m7a Exp 6 + GET center ×0.75; для classical ещё per-class σ-тюнинг) **плюс смена дисциплины AppService с FCFS на Processor Sharing (EPS)**. Калибровка/параметры идентичны Exp 12 — меняется только то, что станция AppService обслуживает классы по Processor-Sharing, а не FCFS.

Реализация: `_build_jsimg.py` ветка exp16 == exp12 в `get_calibrated_params()`; `service_node(ST_APP, …, ps=True)` → `ps_server_section` (JMT `PSServer` + `EPSStrategy`, схема из reference `open_1class_1stat_mg1ps.jsimg`). Сделано и для m_cqrs, и для classical (`classical/`).

## Мотивация

Node.js event-loop + libuv + OS-планировщик ближе к **Processor Sharing**, чем к FCFS: короткий запрос не блокируется «в хвост» за длинной командой. Гипотеза — PS уберёт FCFS head-of-line-blocking и улучшит p95 коротких GET за длинными POST/PATCH на AppService.

## Per-machine результаты

End-to-end MRE `measured (load) ↔ predicted (JMT)`. RC_lag = sample-convolution.

### m_cqrs

**Mean (мс)**

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
|---------------------|-----------|--------:|--------:|--------:|--------:|
| m7i-gp3 (calib)     | measured  |   3.223 |   7.477 |   8.329 |  13.984 |
| m7i-gp3 (calib)     | predicted |   1.452 |   7.559 |   8.249 |  11.623 |
| m7i-gp3 (calib)     | MRE       | −54.96% |  +1.09% |  −0.96% | −16.88% |
| m7i-io2 (calib)     | measured  |   2.172 |   5.397 |   6.110 |   9.818 |
| m7i-io2 (calib)     | predicted |   1.555 |   5.184 |   5.760 |   8.743 |
| m7i-io2 (calib)     | MRE       | −28.39% |  −3.94% |  −5.72% | −10.95% |
| m7a-gp3 (calib)     | measured  |   3.974 |   6.347 |   7.531 |  12.021 |
| m7a-gp3 (calib)     | predicted |   1.117 |   3.001 |   3.257 |   5.264 |
| m7a-gp3 (calib)     | MRE       | −71.90% | −52.72% | −56.75% | −56.21% |
| m7a-io2 (PREDICTED) | measured  |   1.001 |   2.850 |   3.123 |   5.300 |
| m7a-io2 (PREDICTED) | predicted |   0.768 |   2.388 |   2.661 |   3.908 |
| m7a-io2 (PREDICTED) | MRE       | −23.24% | −16.20% | −14.81% | −26.26% |

**Median (мс)**

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
|---------------------|-----------|--------:|--------:|--------:|--------:|
| m7i-gp3 (calib)     | measured  |   2.055 |   5.707 |   6.246 |  10.694 |
| m7i-gp3 (calib)     | predicted |   0.596 |   5.402 |   5.822 |   9.289 |
| m7i-gp3 (calib)     | MRE       | −71.01% |  −5.34% |  −6.78% | −13.14% |
| m7i-io2 (calib)     | measured  |   1.459 |   4.090 |   4.566 |   7.584 |
| m7i-io2 (calib)     | predicted |   0.887 |   4.077 |   4.462 |   7.352 |
| m7i-io2 (calib)     | MRE       | −39.19% |  −0.32% |  −2.27% |  −3.06% |
| m7a-gp3 (calib)     | measured  |   0.800 |   2.965 |   3.199 |   5.716 |
| m7a-gp3 (calib)     | predicted |   0.785 |   2.479 |   2.748 |   4.774 |
| m7a-gp3 (calib)     | MRE       |  −1.86% | −16.41% | −14.12% | −16.47% |
| m7a-io2 (PREDICTED) | measured  |   0.730 |   2.292 |   2.527 |   4.490 |
| m7a-io2 (PREDICTED) | predicted |   0.592 |   2.009 |   2.290 |   3.552 |
| m7a-io2 (PREDICTED) | MRE       | −18.90% | −12.35% |  −9.39% | −20.90% |

**p95 (мс)**

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
|---------------------|-----------|--------:|--------:|--------:|--------:|
| m7i-gp3 (calib)     | measured  |   9.059 |  18.026 |  20.304 |  34.350 |
| m7i-gp3 (calib)     | predicted |   5.565 |  20.321 |  22.301 |  26.907 |
| m7i-gp3 (calib)     | MRE       | −38.57% | +12.73% |  +9.84% | −21.67% |
| m7i-io2 (calib)     | measured  |   5.536 |  12.739 |  14.554 |  23.188 |
| m7i-io2 (calib)     | predicted |   4.949 |  12.534 |  14.120 |  18.672 |
| m7i-io2 (calib)     | MRE       | −10.60% |  −1.61% |  −2.98% | −19.48% |
| m7a-gp3 (calib)     | measured  |   3.125 |   8.288 |   8.292 |  14.424 |
| m7a-gp3 (calib)     | predicted |   3.130 |   6.706 |   6.987 |   9.647 |
| m7a-gp3 (calib)     | MRE       |  +0.17% | −19.08% | −15.74% | −33.12% |
| m7a-io2 (PREDICTED) | measured  |   2.246 |   5.641 |   6.010 |  10.194 |
| m7a-io2 (PREDICTED) | predicted |   1.940 |   5.165 |   5.507 |   7.061 |
| m7a-io2 (PREDICTED) | MRE       | −13.64% |  −8.44% |  −8.38% | −30.73% |

**Aggregate |MRE|**

| machine             |   mean | median |   p90 |   p95 |
|---------------------|-------:|-------:|------:|------:|
| m7i-gp3 (calib)     | 18.47% | 24.07% | 17.51% | 20.70% |
| m7i-io2 (calib)     | 12.25% | 11.21% |  8.34% |  8.67% |
| m7a-gp3 (calib)     | 59.39% | 12.22% | 14.69% | 17.03% |
| m7a-io2 (PREDICTED) | 20.13% | 15.38% | 11.06% | 15.30% |

### classical

**Mean (мс)**

| machine             | source    |  Zapyty |  Stvor |   Onovl |  RC_lag |
|---------------------|-----------|--------:|-------:|--------:|--------:|
| m7i-gp3 (calib)     | measured  |   2.410 |  4.062 |   6.475 |  10.617 |
| m7i-gp3 (calib)     | predicted |   2.574 |  4.102 |   6.754 |  10.245 |
| m7i-gp3 (calib)     | MRE       |  +6.80% | +0.99% |  +4.31% |  −3.50% |
| m7i-io2 (calib)     | measured  |   2.172 |  3.290 |   5.388 |   8.787 |
| m7i-io2 (calib)     | predicted |   2.042 |  3.210 |   5.401 |   8.151 |
| m7i-io2 (calib)     | MRE       |  −5.98% | −2.45% |  +0.24% |  −7.24% |
| m7a-gp3 (calib)     | measured  |   1.079 |  2.415 |   3.619 |   6.084 |
| m7a-gp3 (calib)     | predicted |   1.080 |  2.509 |   3.157 |   4.912 |
| m7a-gp3 (calib)     | MRE       |  +0.10% | +3.90% | −12.77% | −19.27% |
| m7a-io2 (PREDICTED) | measured  |   1.025 |  1.990 |   3.031 |   5.001 |
| m7a-io2 (PREDICTED) | predicted |   0.767 |  1.843 |   2.485 |   3.521 |
| m7a-io2 (PREDICTED) | MRE       | −25.11% | −7.38% | −18.01% | −29.59% |

**Median (мс)**

| machine             | source    |  Zapyty |  Stvor |   Onovl |  RC_lag |
|---------------------|-----------|--------:|-------:|--------:|--------:|
| m7i-gp3 (calib)     | measured  |   1.570 |  2.961 |   5.009 |   8.212 |
| m7i-gp3 (calib)     | predicted |   1.304 |  2.638 |   4.749 |   8.373 |
| m7i-gp3 (calib)     | MRE       | −16.97% | −10.89% | −5.18% |  +1.95% |
| m7i-io2 (calib)     | measured  |   1.498 |  2.385 |   4.146 |   6.802 |
| m7i-io2 (calib)     | predicted |   1.324 |  2.196 |   4.093 |   6.918 |
| m7i-io2 (calib)     | MRE       | −11.63% |  −7.96% | −1.28% |  +1.70% |
| m7a-gp3 (calib)     | measured  |   0.775 |  2.026 |   3.060 |   5.236 |
| m7a-gp3 (calib)     | predicted |   0.756 |  2.186 |   2.846 |   4.585 |
| m7a-gp3 (calib)     | MRE       |  −2.38% |  +7.89% | −6.98% | −12.44% |
| m7a-io2 (PREDICTED) | measured  |   0.780 |  1.574 |   2.548 |   4.356 |
| m7a-io2 (PREDICTED) | predicted |   0.634 |  1.613 |   2.264 |   3.315 |
| m7a-io2 (PREDICTED) | MRE       | −18.71% |  +2.51% | −11.14% | −23.90% |

**p95 (мс)**

| machine             | source    |  Zapyty |   Stvor |   Onovl |  RC_lag |
|---------------------|-----------|--------:|--------:|--------:|--------:|
| m7i-gp3 (calib)     | measured  |   6.711 |  10.270 |  14.763 |  25.837 |
| m7i-gp3 (calib)     | predicted |   8.943 |  12.263 |  17.998 |  23.281 |
| m7i-gp3 (calib)     | MRE       | +33.25% | +19.41% | +21.91% |  −9.89% |
| m7i-io2 (calib)     | measured  |   5.870 |   8.232 |  12.443 |  21.779 |
| m7i-io2 (calib)     | predicted |   6.093 |   9.067 |  13.634 |  17.430 |
| m7i-io2 (calib)     | MRE       |  +3.80% | +10.15% |  +9.57% | −19.97% |
| m7a-gp3 (calib)     | measured  |   2.619 |   4.838 |   6.775 |  11.787 |
| m7a-gp3 (calib)     | predicted |   2.912 |   5.104 |   5.885 |   8.323 |
| m7a-gp3 (calib)     | MRE       | +11.20% |  +5.49% | −13.14% | −29.39% |
| m7a-io2 (PREDICTED) | measured  |   2.431 |   4.256 |   5.780 |  10.157 |
| m7a-io2 (PREDICTED) | predicted |   1.684 |   3.666 |   4.492 |   5.770 |
| m7a-io2 (PREDICTED) | MRE       | −30.75% | −13.85% | −22.29% | −43.19% |

**Aggregate |MRE|**

| machine             |  mean | median |   p90 |   p95 |
|---------------------|------:|-------:|------:|------:|
| m7i-gp3 (calib)     |  3.90% |  8.75% | 19.21% | 21.12% |
| m7i-io2 (calib)     |  3.97% |  5.64% |  7.99% | 10.87% |
| m7a-gp3 (calib)     |  9.01% |  7.42% | 15.34% | 14.80% |
| m7a-io2 (PREDICTED) | 20.02% | 14.07% | 22.00% | 27.52% |

## Сравнение Exp 12 (FCFS) vs Exp 16 (PS), m7a-io2 PREDICTED aggregate

|                  | m_cqrs mean | m_cqrs p95 | classical mean | classical p95 |
|------------------|------------:|-----------:|---------------:|--------------:|
| Exp 12 (FCFS)    |       18.0% |      14.9% |          20.2% |         27.6% |
| Exp 16 (PS)      |       20.1% |      15.3% |          20.0% |         27.5% |

## Выводы

- **PS НЕ улучшает целевую m7a-io2** ни для m_cqrs (p95 14.9→15.3, mean 18→20 — чуть хуже), ни для classical (≈без изменений). Причина: m7i калибровка и GET-center×0.75 в Exp 12 подбирались **под FCFS**; смена дисциплины поверх FCFS-настроек = рассогласование.
- **PS улучшает calib-машины** (особенно classical m7i-gp3: mean 16→3.9%, p95 34→21) — но это **артефакт калибровочной машины**: PS убирает over-prediction от σ-утолщения команд + FCFS HOL-blocking. m7i — не deliverable.
- m_cqrs m7i-gp3 калибровка **хуже** под PS (mean 8→18) — итеративные центры фитились под FCFS-очередь.
- **Чтобы PS реально помог**, нужен полный re-tune Exp 12 под PS-топологию (перекалибровка m7i + переподбор GET-deflation/σ под PS), а не PS поверх FCFS-настроек.

**Решение:** Exp 12 (FCFS) остаётся рабочим для предсказания m7a-io2. Exp 16 сохранён как контрольная точка (PS физически корректнее, но требует собственного re-tune).

## Артефакты

| Файл | Содержание |
| ---- | ---------- |
| [_build_jsimg.py](../_build_jsimg.py) / [classical/_build_jsimg.py](../classical/_build_jsimg.py) | ветка exp16 (= exp12 calib + `ps=True` для AppService) |
| [_export_exp16_per_machine.py](../_export_exp16_per_machine.py) | источник m_cqrs таблиц |
| [classical/_export_exp16_per_machine.py](../classical/_export_exp16_per_machine.py) | источник classical таблиц |
| models/*_exp16* | JMT-модели + результаты (обе вариации) |
| [exp12-design.md](exp12-design.md) | базовая методология (FCFS) |
| [exp12-classical-design.md](exp12-classical-design.md) | classical Exp 12 |
