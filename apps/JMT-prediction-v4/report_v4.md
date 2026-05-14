<!-- markdownlint-disable MD013 MD024 MD040 -->

# JMT-prediction-v4 — AppService K-scaling enabled

## Что изменилось vs v3

Единственное логическое изменение в `compute_k.py`: K_AppService больше **не форсится в 1.0**, а вычисляется так же, как для DB-станций:

```text
K_op^io2 = S^{M7i,io2}_op / S^{M7i,gp3}_op   (для всех станций, включая AppService)
```

**Обоснование:** M7a.gp3 и M7a.io2 хосты используют разные скорости DDR5 (4800 vs 5600 MT/s), поэтому AppService (CPU+memory) не является константой при смене дисковой подсистемы.

Всё остальное (топология, 10s skip, winsorization, 3 distribution-mode, arrival rates) — идентично v3.

## Новые K-коэффициенты

| variation | class | v3 K_App | **v4 K_App** | v4 K_ES | v4 K_SN | v4 K_PR |
|---|---|---:|---:|---:|---:|---:|
| m_cqrs | Zapyty | 1.000 | **0.921** | — | — | 0.946 |
| m_cqrs | Stvor  | 1.000 | **0.807** | 0.934 | 0.943 | — |
| m_cqrs | Onovl  | 1.000 | **0.807** | 0.973 | 0.933 | — |
| m_cqrs | RC     | 1.000 | **0.814** | — | — | 0.837 |
| classical | Zapyty | 1.000 | **0.970** | — | — | 0.973 |
| classical | Stvor  | 1.000 | **0.991** | 0.718 | 0.921 | — |
| classical | Onovl  | 1.000 | **0.989** | 0.753 | 0.832 | — |
| classical | RC     | 1.000 | **0.809** | — | — | 0.858 |

DB-K не изменились. Предсказанные v4 AppService demands ниже v3 на множитель = K.

## Aggregate MRE — v3 vs v4 (Q + Cr + Upd, обе вариации, абсолютная)

| Mode | Stat | v3 | **v4** | Δ |
|---|---|---:|---:|---:|
| Exp | avg | 25.33% | **14.42%** | −10.90 pp ✅ |
| Exp | median | 28.85% | **18.36%** | −10.49 pp ✅ |
| Exp | p90 | 54.19% | **33.00%** | −21.20 pp ✅ |
| Exp | p95 | 47.30% | **25.71%** | −21.59 pp ✅ |
| HE | avg | 25.23% | **14.42%** | −10.81 pp ✅ |
| HE | median | 28.79% | **18.38%** | −10.42 pp ✅ |
| HE | p90 | 53.93% | **33.42%** | −20.51 pp ✅ |
| HE | p95 | 47.00% | **26.21%** | −20.80 pp ✅ |
| **LN** | avg | 13.82% | **11.10%** | −2.72 pp ✅ |
| **LN** | median | 27.03% | **17.02%** | −10.01 pp ✅ |
| **LN** | p90 | **16.95%** | 19.79% | +2.83 pp ❌ |
| **LN** | p95 | **22.72%** | 25.71% | +2.99 pp ❌ |

## Predicted M7a.io2 (ms)

### mCQRS — Predicted

| Mode | Class | avg | median | p90 | p95 |
|---|---|---:|---:|---:|---:|
| Exp | Q | 1.39 | 1.08 | 2.82 | 3.61 |
| Exp | Cr | 2.75 | 2.24 | 5.37 | 6.65 |
| Exp | Upd | 2.87 | 2.40 | 5.46 | 6.68 |
| Exp | RC | 2.29 | 1.89 | 4.49 | 5.52 |
| HE | Q | 1.39 | 1.08 | 2.85 | 3.64 |
| HE | Cr | 2.76 | 2.25 | 5.40 | 6.70 |
| HE | Upd | 2.87 | 2.40 | 5.48 | 6.72 |
| HE | RC | 2.29 | 1.90 | 4.49 | 5.52 |
| **LN** | Q | 1.23 | 1.03 | **2.07** | **2.55** |
| **LN** | Cr | 2.58 | 2.46 | **3.34** | **3.73** |
| **LN** | Upd | 2.70 | 2.59 | **3.53** | **3.90** |
| **LN** | RC | 2.13 | 1.95 | **3.33** | **3.86** |

### Classical CQRS — Predicted

| Mode | Class | avg | median | p90 | p95 |
|---|---|---:|---:|---:|---:|
| Exp | Q | 1.20 | 0.98 | 2.37 | 2.94 |
| Exp | Cr | 2.34 | 1.95 | 4.49 | 5.52 |
| Exp | Upd | 3.07 | 2.70 | 5.54 | 6.62 |
| Exp | RC | 2.04 | 1.70 | 3.98 | 4.87 |
| HE | Q | 1.20 | 0.98 | 2.37 | 2.94 |
| HE | Cr | 2.34 | 1.95 | 4.49 | 5.53 |
| HE | Upd | 3.08 | 2.70 | 5.53 | 6.62 |
| HE | RC | 2.03 | 1.69 | 3.97 | 4.86 |
| **LN** | Q | 1.12 | 1.00 | **1.63** | **2.00** |
| **LN** | Cr | 2.05 | 1.90 | **2.82** | **3.21** |
| **LN** | Upd | 2.78 | 2.63 | **3.65** | **4.07** |
| **LN** | RC | 1.95 | 1.81 | **2.95** | **3.39** |

## Поячеечная MRE — v3 → v4 (Lognormal, signed bias %)

### mCQRS LN

| Class | avg v3→v4 | med v3→v4 | p90 v3→v4 | p95 v3→v4 |
|---|---|---|---|---|
| Zapyty | +43.0 → +22.9 | +55.0 → +41.0 | +56.3 → +25.4 | +42.2 → +13.2 |
| Stvor | +10.5 → −9.6 | +28.9 → +7.2 | −2.9 → −23.1 | −15.2 → −34.0 |
| Onovl | +4.0 → −13.7 | +21.4 → +2.4 | −8.1 → −25.9 | −17.9 → −35.2 |

### Classical LN

| Class | avg v3→v4 | med v3→v4 | p90 v3→v4 | p95 v3→v4 |
|---|---|---|---|---|
| Zapyty | +13.5 → +9.0 | +31.0 → +28.0 | −2.2 → −8.2 | −10.8 → −17.8 |
| Stvor | +4.8 → +3.2 | +21.8 → +20.6 | −12.6 → −15.1 | −22.0 → −24.5 |
| Onovl | −7.1 → −8.2 | +4.1 → +3.1 | −19.6 → −21.1 | −28.3 → −29.6 |

## Интерпретация

**AppService K-scaling улучшает прогноз центра распределения (avg/median) для всех 3 mode:**

- **Exp / HE:** обвальное улучшение — aggregate avg MRE с ~25% до ~14%, p90/p95 — с ~50% до ~30%. Систематический положительный bias v3 (модель переоценивала на всех percentile) почти полностью убран; для mCQRS Stvor/Onovl avg/median bias теперь близок к нулю или слегка отрицательный.
- **Lognormal:** avg MRE улучшилась (13.82% → 11.10%), median — резко улучшилась (27.03% → 17.02%). НО p90/p95 чуть ухудшились (+3 pp).

**Почему LN tail чуть хуже:** v3 LN уже **недооценивал** хвосты (p90/p95 bias был отрицательный для Stvor/Onovl). Уменьшение AppService demand двигает всё распределение ниже, что:
- помогает mean/median (которые v3 переоценивал)
- но усиливает существующую недооценку tail

**Acceptance criterion (LN лучше v3 по всем):** частично выполнен — avg и median ✅, p90/p95 ❌. Физика правильная, но для LN tail нужна другая корректировка (возможно, не масштабировать variance как K², а оставлять constant).

## Рекомендация

| Метрика | v3 | v4 | Лучший выбор |
|---|---:|---:|---|
| LN avg | 13.8% | **11.1%** | **v4** |
| LN median | 27.0% | **17.0%** | **v4** |
| LN p90 | **17.0%** | 19.8% | v3 |
| LN p95 | **22.7%** | 25.7% | v3 |
| Exp avg | 25.3% | **14.4%** | **v4** |
| Exp p95 | 47.3% | **25.7%** | **v4** |

**Для центра распределения (avg/median)** — v4 строго лучше. **Для percentile хвостов** — v3 LN остаётся лучшим, но Exp/HE в v4 теперь существенно лучше своих v3-аналогов.

## Структура папки

```text
apps/JMT-prediction-v4/
├── extract_demands.py            # унаследована из v3 (без изменений)
├── compute_k.py                  # ИЗМЕНЕНО: K_AppService теперь вычисляется, не 1.0
├── build_jsimg.py                # унаследован
├── run_simulations.py            # унаследован
├── analyze_results.py            # пишет analysis_v4.json
├── demands.json                  # копия из v3
├── K_io2.json                    # новые K с AppService
├── predicted_demands_m_cqrs.json
├── predicted_demands_classical_cqrs.json
├── models_{exp,hyperexp,lognormal}/   # 8 .jsimg each
├── results_{exp,hyperexp,lognormal}/  # JMT result XMLs
├── jmt_logs/{exp,hyperexp,lognormal}/ # 300k-sample CSVs
├── run_summary_{exp,hyperexp,lognormal}.json
├── analysis_v4.json
└── report_v4.md                  # this report
```

## Воспроизведение

```bash
cd apps/JMT-prediction-v4/
python3 compute_k.py
python3 build_jsimg.py
python3 run_simulations.py --skip-baselines
python3 analyze_results.py
```

(extract_demands.py не запускается — demands.json копируется из v3 как input.)
