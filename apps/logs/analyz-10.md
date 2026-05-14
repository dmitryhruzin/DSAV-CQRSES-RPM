<!-- markdownlint-disable MD024 MD040 MD013 MD032 MD060 -->

# Анализ логов (без первых 10 секунд)

Те же расчёты, что и в [analyz.md](analyz.md), но из каждого лога **исключены первые 10 секунд нагрузки** (отрезаются запросы, у которых `http.request.startedAt < t0 + 10000ms`, где `t0` — `startedAt` самого первого `http.request` в логе). Якорь — первый запрос, а не первая запись лога, чтобы пропустить именно прогрев нагрузки, а не серверный boot/idle.

Метрики вычислены из telemetry-спанов:

- **http.request** — `durationMs` спана `http.request` (полное время обработки HTTP-запроса).
- **consistency_lag** — `(event.handle.endedAt) − http.request.startedAt`, то есть время от прихода запроса до завершения последнего event handler (только для команд POST/PATCH; GET не имеет ивент-хендлера).

Pino `responseTime` НЕ используется.

## M7i.large gp3

### mCQRS Sequential

```
Source: ../logs/m7i-gp3-m_cqrs-seq.log
Parsed: 36820 log lines, 4100 unique req-ids, 4100 requests with http.request span (after 10s skip: 4034 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  3.32    3.04  3.82  4.74  2.37  24.80  22.43      2.25   1.50
  ★ consistency_lag    588  5.12    4.80  6.28  7.08  3.30  26.65  23.35      2.94   1.71

═══ PATCH (update commands) ─ 2159 total / 2060 ok / 99 failed ═══
  error rate: 99 / 2159  (4.59%)
  metric             count    avg  median   p90   p95   min      max    range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2060   3.68    3.35  4.33  5.42  2.51    29.57    27.06      2.20   1.48
  ★ consistency_lag   2060  14.21    5.72  8.28  9.44  4.06  1011.80  1007.73   7732.62  87.94

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.30    1.21  1.57  1.91  0.61  27.05  26.44      1.25   1.12
```

### mCQRS Load

```
Source: ../logs/m7i-gp3-m_cqrs-load.log
Parsed: 402125 log lines, 43421 unique req-ids, 43421 requests with http.request span (after 10s skip: 40512 analysed)

═══ POST  (create commands) ─ 11511 total / 11511 ok / 0 failed ═══
  error rate: 0 / 11511  (0.00%)
  metric             count    avg  median    p90    p95   min     max   range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────────
    http.request     11511   7.48    5.71  13.84  18.03  1.67   86.94   85.27     40.93   6.40
  ★ consistency_lag  11511  10.86    8.40  19.28  25.48  2.04  120.74  118.70     83.56   9.14

═══ PATCH (update commands) ─ 17453 total / 17448 ok / 5 failed ═══
  error rate: 5 / 17453  (0.03%)
  metric             count    avg  median    p90    p95   min      max    range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
    http.request     17448   8.33    6.25  15.36  20.30  1.99    97.58    95.59     54.13   7.36
  ★ consistency_lag  17448  17.08   12.52  29.23  38.35  3.04  3039.41  3036.37   3281.91  57.29

═══ GET   (queries) ─ 11548 total / 11548 ok / 0 failed ═══
  error rate: 0 / 11548  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request  11548  3.22    2.05  6.17  9.07  0.42  78.23  77.81     20.68   4.55
```

### Classical CQRS Sequential

```
Source: ../logs/m7i-gp3-classical_cqrs-seq.log
Parsed: 43311 log lines, 4101 unique req-ids, 4100 requests with http.request span (after 10s skip: 4032 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  2.53    2.09  3.48  3.80  1.46  28.23  26.77      1.86   1.36
  ★ consistency_lag    588  4.40    3.84  6.00  6.92  2.39  30.76  28.37      3.09   1.76

═══ PATCH (update commands) ─ 2157 total / 2157 ok / 0 failed ═══
  error rate: 0 / 2157  (0.00%)
  metric             count    avg  median   p90   p95   min      max    range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2157   3.69    3.26  4.72  5.21  2.38    27.73    25.35      2.02   1.42
  ★ consistency_lag   2157  11.08    6.10  8.18  8.96  4.08  1014.86  1010.77   4632.47  68.06

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.22    1.16  1.55  1.75  0.62  12.98  12.36      0.39   0.63
```

### Classical CQRS Load

```
Source: ../logs/m7i-gp3-classical_cqrs-load.log
Parsed: 443210 log lines, 42995 unique req-ids, 42995 requests with http.request span (after 10s skip: 40026 analysed)

═══ POST  (create commands) ─ 11429 total / 11429 ok / 0 failed ═══
  error rate: 0 / 11429  (0.00%)
  metric             count   avg  median    p90    p95   min     max   range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────────
    http.request     11429  4.06    2.96   7.52  10.27  0.97   86.82   85.85     15.69   3.96
  ★ consistency_lag  11429  6.97    5.47  12.07  15.53  1.93  131.85  129.91     34.83   5.90

═══ PATCH (update commands) ─ 17311 total / 17309 ok / 2 failed ═══
  error rate: 2 / 17311  (0.01%)
  metric             count    avg  median    p90    p95   min      max    range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
    http.request     17309   6.48    5.01  11.29  14.77  1.90   117.97   116.07     30.43   5.52
  ★ consistency_lag  17309  14.24   10.28  23.13  29.30  2.94  3046.35  3043.40   3773.30  61.43

═══ GET   (queries) ─ 11286 total / 11286 ok / 0 failed ═══
  error rate: 0 / 11286  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request  11286  2.41    1.57  4.79  6.72  0.42  51.94  51.51      8.35   2.89
```

## M7a.large gp3

### mCQRS Sequential

```
Source: ../logs/m7a-gp3-m_cqrs-seq.log
Parsed: 36840 log lines, 4100 unique req-ids, 4100 requests with http.request span (after 10s skip: 4035 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  3.00    2.79  3.44  4.34  2.23  15.55  13.32      0.94   0.97
  ★ consistency_lag    588  4.62    4.57  5.74  6.50  3.37  21.41  18.04      1.71   1.31

═══ PATCH (update commands) ─ 2160 total / 2061 ok / 99 failed ═══
  error rate: 99 / 2160  (4.58%)
  metric             count    avg  median   p90   p95   min      max    range  variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2061   3.20    2.97  3.65  4.48  2.41    23.61    21.20      1.00    1.00
  ★ consistency_lag   2061  23.53    5.14  7.10  8.21  3.76  1010.44  1006.68  17690.18  133.00

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min   max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.09    1.03  1.30  1.57  0.66  5.45   4.80      0.21   0.46
```

### mCQRS Load

```
Source: ../logs/m7a-gp3-m_cqrs-load.log
Parsed: 396187 log lines, 42839 unique req-ids, 42839 requests with http.request span (after 10s skip: 39781 analysed)

═══ POST  (create commands) ─ 11425 total / 11425 ok / 0 failed ═══
  error rate: 0 / 11425  (0.00%)
  metric             count    avg  median   p90    p95   min     max   range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────────
    http.request     11425   6.35    2.97  5.85   8.30  1.37  330.81  329.44    504.61  22.46
  ★ consistency_lag  11425  10.39    4.94  8.40  11.46  1.87  471.76  469.88   1397.06  37.38

═══ PATCH (update commands) ─ 16906 total / 16900 ok / 6 failed ═══
  error rate: 6 / 16906  (0.04%)
  metric             count    avg  median    p90    p95   min      max    range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
    http.request     16900   7.45    3.20   6.14   8.27  1.59   330.85   329.26    866.75  29.44
  ★ consistency_lag  16900  13.65    6.36  11.52  15.59  2.38  3013.03  3010.65   3794.72  61.60

═══ GET   (queries) ─ 11450 total / 11450 ok / 0 failed ═══
  error rate: 0 / 11450  (0.00%)
  metric          count   avg  median   p90   p95   min     max   range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────
    http.request  11450  3.97    0.80  2.01  3.13  0.28  323.20  322.91    587.55  24.24
```

### Classical CQRS Sequential

```
Source: ../logs/m7a-gp3-classical_cqrs-seq.log
Parsed: 43315 log lines, 4100 unique req-ids, 4100 requests with http.request span (after 10s skip: 4035 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  2.34    2.01  2.92  3.29  1.46  16.07  14.61      0.92   0.96
  ★ consistency_lag    588  4.01    3.59  5.58  5.76  2.06  18.20  16.14      1.61   1.27

═══ PATCH (update commands) ─ 2160 total / 2160 ok / 0 failed ═══
  error rate: 0 / 2160  (0.00%)
  metric             count    avg  median   p90   p95   min      max    range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2160   3.16    2.77  4.02  4.38  2.16    21.64    19.48      1.18   1.08
  ★ consistency_lag   2160  12.38    5.11  6.91  7.65  3.50  1007.72  1004.22   6912.13  83.14

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.05    1.00  1.25  1.45  0.62  16.94  16.31      0.38   0.62
```

### Classical CQRS Load

```
Source: ../logs/m7a-gp3-classical_cqrs-load.log
Parsed: 439591 log lines, 42806 unique req-ids, 42806 requests with http.request span (after 10s skip: 39919 analysed)

═══ POST  (create commands) ─ 11421 total / 11421 ok / 0 failed ═══
  error rate: 0 / 11421  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request     11421  2.42    2.03  3.90  4.84  0.86  37.52  36.66      2.84   1.68
  ★ consistency_lag  11421  4.38    3.88  6.51  7.87  0.89  52.91  52.03      5.79   2.41

═══ PATCH (update commands) ─ 17092 total / 17091 ok / 1 failed ═══
  error rate: 1 / 17092  (0.01%)
  metric             count   avg  median    p90    p95   min    max  range  variance  stdev
  ─────────────────────────────────────────────────────────────────────────────────────────
    http.request     17091  3.62    3.06   5.56   6.78  1.46  38.34  36.88      4.74   2.18
  ★ consistency_lag  17091  7.22    6.31  10.78  13.19  2.34  58.52  56.18     16.34   4.04

═══ GET   (queries) ─ 11406 total / 11406 ok / 0 failed ═══
  error rate: 0 / 11406  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request  11406  1.08    0.77  1.88  2.62  0.28  26.22  25.95      1.49   1.22
```

## M7g.large gp3

### mCQRS Sequential

```
Source: ../logs/m7g-gp3-m_cqrs-seq.log
Parsed: 36830 log lines, 4100 unique req-ids, 4100 requests with http.request span (after 10s skip: 4034 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  3.73    3.45  4.35  5.24  2.81  21.25  18.44      1.28   1.13
  ★ consistency_lag    588  5.78    5.12  7.27  8.14  3.62  24.35  20.73      2.92   1.71

═══ PATCH (update commands) ─ 2159 total / 2060 ok / 99 failed ═══
  error rate: 99 / 2159  (4.59%)
  metric             count    avg  median   p90    p95   min      max    range  variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2060   4.19    3.84  4.68   5.79  3.18    31.96    28.78      2.83    1.68
  ★ consistency_lag   2060  21.94    6.90  9.26  10.87  5.46  1010.45  1004.98  14386.04  119.94

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.39    1.36  1.69  1.98  0.82  14.50  13.68      0.49   0.70
```

### mCQRS Load

```
Source: ../logs/m7g-gp3-m_cqrs-load.log
Parsed: 385537 log lines, 42444 unique req-ids, 42444 requests with http.request span (after 10s skip: 39658 analysed)

═══ POST  (create commands) ─ 11421 total / 11421 ok / 0 failed ═══
  error rate: 0 / 11421  (0.00%)
  metric             count      avg   median      p90      p95      min      max    range    variance    stdev
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────
    http.request     11421  2694.84  2486.84  4947.78  5520.68   854.70  6673.03  5818.33  1809013.88  1345.00
  ★ consistency_lag  11421  4725.96  4598.18  7425.16  8220.37  1748.07  9942.01  8193.94  3364904.81  1834.37

═══ PATCH (update commands) ─ 16992 total / 15893 ok / 1099 failed ═══
  error rate: 1099 / 16992  (6.47%)
  metric             count      avg   median      p90       p95      min       max     range    variance    stdev
  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
    http.request     15893  4096.66  3637.70  6275.78   6429.47  1745.53   6689.22   4943.68  1799310.15  1341.38
  ★ consistency_lag  15893  6508.11  6330.10  9628.63  10062.36  2657.65  13032.34  10374.69  4924719.70  2219.17

═══ GET   (queries) ─ 11245 total / 11245 ok / 0 failed ═══
  error rate: 0 / 11245  (0.00%)
  metric          count      avg   median      p90      p95     min      max    range    variance    stdev
  ────────────────────────────────────────────────────────────────────────────────────────────────────────
    http.request  11245  2966.96  2604.53  5239.89  6267.10  845.47  6659.93  5814.46  2176362.22  1475.25
```

### Classical CQRS Sequential

```
Source: ../logs/m7g-gp3-classical_cqrs-seq.log
Parsed: 43315 log lines, 4100 unique req-ids, 4100 requests with http.request span (after 10s skip: 4034 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  2.84    2.31  3.76  4.18  1.78  20.05  18.27      1.93   1.39
  ★ consistency_lag    588  4.92    4.17  6.84  7.28  2.76  24.23  21.47      3.05   1.75

═══ PATCH (update commands) ─ 2159 total / 2159 ok / 0 failed ═══
  error rate: 0 / 2159  (0.00%)
  metric             count    avg  median   p90    p95   min      max    range  variance  stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2159   4.11    3.62  5.16   5.71  2.89    50.40    47.51      2.39   1.55
  ★ consistency_lag   2159  12.29    6.80  9.02  10.04  4.62  1012.79  1008.18   5091.39  71.35

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.40    1.32  1.74  2.26  0.80  20.45  19.65      0.86   0.93
```

### Classical CQRS Load

```
Source: ../logs/m7g-gp3-classical_cqrs-load.log
Parsed: 439687 log lines, 43336 unique req-ids, 43336 requests with http.request span (after 10s skip: 40361 analysed)

═══ POST  (create commands) ─ 11387 total / 11387 ok / 0 failed ═══
  error rate: 0 / 11387  (0.00%)
  metric             count      avg   median      p90       p95      min       max    range    variance    stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
    http.request     11387  3121.60  2485.55  7234.28   7896.22   803.41   8353.40  7550.00  4600329.35  2144.84
  ★ consistency_lag  11387  5003.24  4683.25  9647.14  10483.41  1662.32  11242.32  9580.01  6208428.75  2491.67

═══ PATCH (update commands) ─ 17504 total / 16502 ok / 1002 failed ═══
  error rate: 1002 / 17504  (5.72%)
  metric             count      avg   median       p90       p95      min       max     range    variance    stdev
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    http.request     16502  5988.07  6070.27   8200.09   9627.70  2513.00  11240.30   8727.30  4261847.39  2064.42
  ★ consistency_lag  16502  8255.65  8240.78  12034.35  13268.87  3369.61  27070.35  23700.74  8232449.39  2869.22

═══ GET   (queries) ─ 11470 total / 11470 ok / 0 failed ═══
  error rate: 0 / 11470  (0.00%)
  metric          count      avg   median      p90      p95     min      max    range    variance    stdev
  ────────────────────────────────────────────────────────────────────────────────────────────────────────
    http.request  11470  2736.72  2421.31  5082.77  5381.69  803.32  5686.76  4883.45  1835281.03  1354.73
```

## M7i.large io2

### mCQRS Sequential

```
Source: ../logs/m7i-io2-m_cqrs-seq.log
Parsed: 36835 log lines, 4100 unique req-ids, 4100 requests with http.request span (after 10s skip: 4033 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  2.77    2.55  3.28  4.12  1.91  15.23  13.32      0.92   0.96
  ★ consistency_lag    588  4.11    3.67  4.99  5.97  2.16  24.05  21.88      1.85   1.36

═══ PATCH (update commands) ─ 2158 total / 2059 ok / 99 failed ═══
  error rate: 99 / 2158  (4.59%)
  metric             count    avg  median   p90   p95   min      max    range  variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2059   3.18    2.86  3.69  4.88  2.16    28.75    26.59      2.56    1.60
  ★ consistency_lag   2059  22.49    5.07  7.20  8.84  3.64  1011.31  1007.67  16750.92  129.43

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.21    1.11  1.51  1.75  0.56  18.68  18.12      0.87   0.93
```

### mCQRS Load

```
Source: ../logs/m7i-io2-m_cqrs-load.log
Parsed: 378694 log lines, 41000 unique req-ids, 41000 requests with http.request span (after 10s skip: 38162 analysed)

═══ POST  (create commands) ─ 11042 total / 11042 ok / 0 failed ═══
  error rate: 0 / 11042  (0.00%)
  metric             count   avg  median    p90    p95   min    max  range  variance  stdev
  ─────────────────────────────────────────────────────────────────────────────────────────
    http.request     11042  5.40    4.09   9.90  12.74  1.56  64.78  63.22     19.90   4.46
  ★ consistency_lag  11042  7.53    5.93  13.09  16.60  2.02  93.24  91.23     35.35   5.95

═══ PATCH (update commands) ─ 16149 total / 16144 ok / 5 failed ═══
  error rate: 5 / 16149  (0.03%)
  metric             count    avg  median    p90    p95   min     max   range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────────
    http.request     16144   6.11    4.57  11.00  14.58  1.93   69.18   67.25     27.56   5.25
  ★ consistency_lag  16144  11.38    8.83  20.27  26.70  2.72  122.02  119.29     78.51   8.86

═══ GET   (queries) ─ 10971 total / 10971 ok / 0 failed ═══
  error rate: 0 / 10971  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request  10971  2.17    1.46  4.10  5.54  0.45  56.03  55.58      7.81   2.80
```

### Classical CQRS Sequential

```
Source: ../logs/m7i-io2-classical_cqrs-seq.log
Parsed: 43305 log lines, 4100 unique req-ids, 4100 requests with http.request span (after 10s skip: 4033 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  2.06    1.65  3.01  3.41  1.23   6.80   5.57      0.67   0.82
  ★ consistency_lag    588  3.43    3.29  4.90  5.66  2.03  22.69  20.65      1.98   1.41

═══ PATCH (update commands) ─ 2158 total / 2158 ok / 0 failed ═══
  error rate: 0 / 2158  (0.00%)
  metric             count   avg  median   p90   p95   min      max    range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────────
    http.request      2158  3.12    2.83  3.95  4.39  2.03    21.64    19.61      1.09   1.04
  ★ consistency_lag   2158  7.78    5.05  7.11  8.18  3.70  1006.45  1002.75   2313.08  48.09

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min   max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.19    1.13  1.53  1.79  0.55  8.52   7.97      0.32   0.56
```

### Classical CQRS Load

```
Source: ../logs/m7i-io2-classical_cqrs-load.log
Parsed: 421955 log lines, 41173 unique req-ids, 41173 requests with http.request span (after 10s skip: 38361 analysed)

═══ POST  (create commands) ─ 11118 total / 11118 ok / 0 failed ═══
  error rate: 0 / 11118  (0.00%)
  metric             count   avg  median   p90    p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
    http.request     11118  3.29    2.39  6.31   8.23  0.98  52.30  51.33      8.76   2.96
  ★ consistency_lag  11118  5.56    4.40  9.98  12.73  0.96  67.42  66.46     17.43   4.17

═══ PATCH (update commands) ─ 16276 total / 16274 ok / 2 failed ═══
  error rate: 2 / 16276  (0.01%)
  metric             count    avg  median    p90    p95   min      max    range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
    http.request     16274   5.39    4.14   9.52  12.44  1.82    67.85    66.03     17.68   4.20
  ★ consistency_lag  16274  11.91    8.63  19.56  25.74  2.65  3028.65  3026.00   2845.95  53.35

═══ GET   (queries) ─ 10967 total / 10967 ok / 0 failed ═══
  error rate: 0 / 10967  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request  10967  2.17    1.50  4.26  5.87  0.45  42.87  42.42      5.25   2.29
```

## M7a.large io2

### mCQRS Sequential

```
Source: ../logs/m7a-io2-m_cqrs-seq.log
Parsed: 36845 log lines, 4100 unique req-ids, 4100 requests with http.request span (after 10s skip: 4033 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  2.72    2.50  3.13  3.94  2.01  14.99  12.97      1.00   1.00
  ★ consistency_lag    588  3.97    3.50  5.13  5.71  2.15  16.55  14.40      1.49   1.22

═══ PATCH (update commands) ─ 2158 total / 2059 ok / 99 failed ═══
  error rate: 99 / 2158  (4.59%)
  metric             count    avg  median   p90   p95   min      max    range  variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2059   2.93    2.72  3.34  4.30  2.27    13.93    11.67      0.65    0.81
  ★ consistency_lag   2059  24.33    4.72  6.40  7.91  3.46  1008.58  1005.13  19108.30  138.23

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.12    1.03  1.30  1.66  0.65  16.50  15.86      0.53   0.73
```

### mCQRS Load

```
Source: ../logs/m7a-io2-m_cqrs-load.log
Parsed: 384369 log lines, 41378 unique req-ids, 41377 requests with http.request span (after 10s skip: 38614 analysed)

═══ POST  (create commands) ─ 11102 total / 11102 ok / 0 failed ═══
  error rate: 0 / 11102  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request     11102  2.85    2.29  4.34  5.65  1.25  63.90  62.65      5.13   2.26
  ★ consistency_lag  11102  4.28    3.59  6.32  7.86  1.80  75.28  73.48      8.61   2.93

═══ PATCH (update commands) ─ 16622 total / 16620 ok / 2 failed ═══
  error rate: 2 / 16622  (0.01%)
  metric             count   avg  median   p90    p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
    http.request     16620  3.12    2.53  4.76   6.02  1.55  52.98  51.43      5.50   2.34
  ★ consistency_lag  16620  5.98    5.08  8.97  11.14  2.32  93.61  91.29     15.45   3.93

═══ GET   (queries) ─ 10890 total / 10890 ok / 0 failed ═══
  error rate: 0 / 10890  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request  10890  1.00    0.73  1.65  2.25  0.29  31.47  31.18      1.58   1.26
```

### Classical CQRS Sequential

```
Source: ../logs/m7a-io2-classical_cqrs-seq.log
Parsed: 43330 log lines, 4100 unique req-ids, 4100 requests with http.request span (after 10s skip: 4033 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  2.11    1.84  2.81  3.07  1.34  10.92   9.58      0.66   0.81
  ★ consistency_lag    588  3.40    3.23  4.89  5.21  1.90  12.80  10.90      1.30   1.14

═══ PATCH (update commands) ─ 2158 total / 2158 ok / 0 failed ═══
  error rate: 0 / 2158  (0.00%)
  metric             count    avg  median   p90   p95   min      max    range  variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2158   2.85    2.60  3.65  4.14  2.00    12.25    10.26      0.65    0.81
  ★ consistency_lag   2158  18.72    4.65  6.31  7.33  3.43  1009.52  1006.09  13745.27  117.24

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.07    1.01  1.26  1.52  0.66  15.10  14.44      0.39   0.62
```

### Classical CQRS Load

```
Source: ../logs/m7a-io2-classical_cqrs-load.log
Parsed: 415302 log lines, 40626 unique req-ids, 40625 requests with http.request span (after 10s skip: 37903 analysed)

═══ POST  (create commands) ─ 11041 total / 11041 ok / 0 failed ═══
  error rate: 0 / 11041  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request     11041  1.99    1.57  3.32  4.26  0.82  27.51  26.69      2.40   1.55
  ★ consistency_lag  11041  3.48    3.04  5.47  6.71  0.80  36.88  36.08      4.74   2.18

═══ PATCH (update commands) ─ 15960 total / 15960 ok / 0 failed ═══
  error rate: 0 / 15960  (0.00%)
  metric             count   avg  median   p90    p95   min      max    range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────────
    http.request     15960  3.03    2.55  4.63   5.79  1.49    33.15    31.66      3.22   1.79
  ★ consistency_lag  15960  6.80    5.22  9.20  11.45  2.30  3017.76  3015.46   2274.85  47.70

═══ GET   (queries) ─ 10902 total / 10902 ok / 0 failed ═══
  error rate: 0 / 10902  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request  10902  1.02    0.78  1.78  2.44  0.29  18.68  18.39      0.87   0.93
```

## M7g.large io2

### mCQRS Sequential

```
Source: ../logs/m7g-io2-m_cqrs-seq.log
Parsed: 36825 log lines, 4100 unique req-ids, 4100 requests with http.request span (after 10s skip: 4033 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  3.13    2.84  3.76  4.80  2.30  29.20  26.90      1.74   1.32
  ★ consistency_lag    588  4.40    4.33  5.74  6.39  3.06  30.37  27.31      2.24   1.50

═══ PATCH (update commands) ─ 2158 total / 2059 ok / 99 failed ═══
  error rate: 99 / 2158  (4.59%)
  metric             count    avg  median   p90   p95   min      max    range  variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2059   3.58    3.19  4.14  5.52  2.69    32.41    29.72      3.25    1.80
  ★ consistency_lag   2059  18.16    5.30  7.89  9.21  3.89  1011.78  1007.89  12029.37  109.68

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.43    1.31  1.71  2.50  0.80  19.99  19.19      1.22   1.10
```

### mCQRS Load

```
Source: ../logs/m7g-io2-m_cqrs-load.log
Parsed: 378269 log lines, 41044 unique req-ids, 41044 requests with http.request span (after 10s skip: 38341 analysed)

═══ POST  (create commands) ─ 11184 total / 11184 ok / 0 failed ═══
  error rate: 0 / 11184  (0.00%)
  metric             count    avg  median     p90     p95   min      max    range  variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────────
    http.request     11184  49.08    9.74   72.58  353.92  1.70  1018.97  1017.26  17803.90  133.43
  ★ consistency_lag  11184  79.88   12.60  111.32  601.50  1.96  1504.74  1502.78  48187.95  219.52

═══ PATCH (update commands) ─ 16226 total / 16165 ok / 61 failed ═══
  error rate: 61 / 16226  (0.38%)
  metric             count     avg  median     p90     p95   min      max    range  variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────────
    http.request     16165   66.96   11.20   87.20  494.22  2.15  1016.54  1014.39  32687.75  180.80
  ★ consistency_lag  16165  108.64   20.51  147.12  754.89  3.78  3064.22  3060.43  82462.72  287.16

═══ GET   (queries) ─ 10931 total / 10931 ok / 0 failed ═══
  error rate: 0 / 10931  (0.00%)
  metric          count    avg  median    p90     p95   min     max   range  variance   stdev
  ───────────────────────────────────────────────────────────────────────────────────────────
    http.request  10931  47.35    3.87  68.85  376.10  0.51  987.68  987.17  20874.52  144.48
```

### Classical CQRS Sequential

```
Source: ../logs/m7g-io2-classical_cqrs-seq.log
Parsed: 43327 log lines, 4102 unique req-ids, 4100 requests with http.request span (after 10s skip: 4033 analysed)

═══ POST  (create commands) ─ 588 total / 588 ok / 0 failed ═══
  error rate: 0 / 588  (0.00%)
  metric             count   avg  median   p90   p95   min    max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
    http.request       588  2.17    1.67  3.13  3.59  1.35  14.84  13.50      1.02   1.01
  ★ consistency_lag    588  3.47    3.28  4.80  5.59  1.99  17.84  15.85      1.71   1.31

═══ PATCH (update commands) ─ 2158 total / 2158 ok / 0 failed ═══
  error rate: 0 / 2158  (0.00%)
  metric             count    avg  median   p90   p95   min      max    range  variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
    http.request      2158   3.30    2.90  4.05  4.86  2.35    28.58    26.23      1.92    1.38
  ★ consistency_lag   2158  17.21    5.15  7.37  8.50  3.74  1012.95  1009.21  11496.79  107.22

═══ GET   (queries) ─ 1287 total / 1287 ok / 0 failed ═══
  error rate: 0 / 1287  (0.00%)
  metric          count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────
    http.request   1287  1.29    1.25  1.57  1.80  0.79  10.99  10.20      0.33   0.57
```

### Classical CQRS Load

```
Source: ../logs/m7g-io2-classical_cqrs-load.log
Parsed: 422498 log lines, 41284 unique req-ids, 41284 requests with http.request span (after 10s skip: 38389 analysed)

═══ POST  (create commands) ─ 11233 total / 11233 ok / 0 failed ═══
  error rate: 0 / 11233  (0.00%)
  metric             count     avg  median     p90      p95   min      max    range   variance   stdev
  ────────────────────────────────────────────────────────────────────────────────────────────────────
    http.request     11233  121.14    4.76  443.10   662.22  0.90  1993.30  1992.40  103318.85  321.43
  ★ consistency_lag  11233  191.82    8.04  757.72  1260.86  1.05  2615.07  2614.03  215419.74  464.13

═══ PATCH (update commands) ─ 16399 total / 16264 ok / 135 failed ═══
  error rate: 135 / 16399  (0.82%)
  metric             count     avg  median      p90      p95   min      max    range   variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────────────
    http.request     16264  221.41    8.22   962.68  1700.99  1.93  2612.20  2610.27  260172.53  510.07
  ★ consistency_lag  16264  315.33   17.55  1350.63  2324.93  2.71  7844.14  7841.43  519645.44  720.86

═══ GET   (queries) ─ 10757 total / 10757 ok / 0 failed ═══
  error rate: 0 / 10757  (0.00%)
  metric          count     avg  median     p90     p95   min      max    range  variance   stdev
  ───────────────────────────────────────────────────────────────────────────────────────────────
    http.request  10757  108.72    3.61  447.46  672.70  0.50  1405.29  1404.78  67453.51  259.72
```

## Summary

Сравнение всех кандидатов **после отбрасывания первых 10 секунд логов**. Метрики:

- **Error rate** — общая доля неудачных запросов (по всем методам, после фильтра).
- **req** — `http.request.durationMs`.
- **cons** — `consistency_lag = event_handler_end − http.request.startedAt` (для GET нет).

Для каждой пары (request-time / consistency-lag) показаны: **avg, median, p90, p95, range, variance, stdev**.

**Predicted rows** (`M7a.io2 (pred Exp/HE/LN)`) — прогнозы из JMT-prediction-v3 для **M7a.large io2** под нагрузкой 100Q+100POST+150PATCH+250RC /s. Калибровка из Sequential логов (баз M7i.gp3, M7i.io2, M7a.gp3) с дисковым K-масштабированием по методу Brunnert et al. Три распределения времени обслуживания: **Exp** (M/M/1), **HE** (HyperExp), **LN** (Lognormal). Сам v3 калиброван post-10s skip — измеренные базы здесь и есть его ground truth. Подробности — [JMT-prediction-v3/report_v3.md](../JMT-prediction-v3/report_v3.md).

В predicted-строках:
- `POST req / PATCH req / GET req` — отклик классов Команди створення / Команди оновлення / Запити.
- `POST cons / PATCH cons` — отклик RC класса (Процеси досягнення узгодженості) standalone из той же симуляции. Это НЕ прямой эквивалент measured `consistency_lag` (от прихода запроса до конца хендлера); это самостоятельный response-time event-handler класса в QN.

### Load mode — avg

| Candidate         |      Err | POST req | POST cons | PATCH req | PATCH cons |  GET req |
|:------------------| -------:| -------:| -------:| -------:| -------:| -------:|
| M7i gp3 mCQRS     |    0.01% |     7.48 |    10.86 |     8.33 |    17.08 |     3.22 |
| M7i gp3 Classical |    0.00% |     4.06 |     6.97 |     6.48 |    14.24 |     2.41 |
| M7a gp3 mCQRS     |    0.02% |     6.35 |    10.39 |     7.45 |    13.65 |     3.97 |
| M7a gp3 Classical |    0.00% |     2.42 |     4.38 |     3.62 |     7.22 |     1.08 |
| M7g gp3 mCQRS     |    2.77% |  2694.84 |  4725.96 |  4096.66 |  6508.11 |  2966.96 |
| M7g gp3 Classical |    2.48% |  3121.60 |  5003.24 |  5988.07 |  8255.65 |  2736.72 |
| M7i io2 mCQRS     |    0.01% |     5.40 |     7.53 |     6.11 |    11.38 |     2.17 |
| M7i io2 Classical |    0.01% |     3.29 |     5.56 |     5.39 |    11.91 |     2.17 |
| M7a io2 mCQRS     |    0.01% |     2.85 |     4.28 |     3.12 |     5.98 |     1.00 |
| M7a io2 Classical |    0.00% |     1.99 |     3.48 |     3.03 |     6.80 |     1.02 |
| M7g io2 mCQRS     |    0.16% |    49.08 |    79.88 |    66.96 |   108.64 |    47.35 |
| M7g io2 Classical |    0.35% |   121.14 |   191.82 |   221.41 |   315.33 |   108.72 |
| M7a.io2 mCQRS (pred Exp)     | — |     3.43 |      2.86 |      3.53 |       2.86 |    1.71 |
| M7a.io2 mCQRS (pred HE)      | — |     3.44 |      2.85 |      3.53 |       2.85 |    1.72 |
| M7a.io2 mCQRS (pred LN)      | — |     3.15 |      2.57 |      3.25 |       2.57 |    1.43 |
| M7a.io2 Classical (pred Exp) | — |     2.39 |      2.37 |      3.13 |       2.37 |    1.27 |
| M7a.io2 Classical (pred HE)  | — |     2.39 |      2.38 |      3.13 |       2.38 |    1.26 |
| M7a.io2 Classical (pred LN)  | — |     2.09 |      2.26 |      2.82 |       2.26 |    1.16 |

### Load mode — median

| Candidate         | POST req | POST cons | PATCH req | PATCH cons |  GET req |
|:------------------| -------:| -------:| -------:| -------:| -------:|
| M7i gp3 mCQRS     |     5.71 |     8.40 |     6.25 |    12.52 |     2.05 |
| M7i gp3 Classical |     2.96 |     5.47 |     5.01 |    10.28 |     1.57 |
| M7a gp3 mCQRS     |     2.97 |     4.94 |     3.20 |     6.36 |     0.80 |
| M7a gp3 Classical |     2.03 |     3.88 |     3.06 |     6.31 |     0.77 |
| M7g gp3 mCQRS     |  2486.84 |  4598.18 |  3637.70 |  6330.10 |  2604.53 |
| M7g gp3 Classical |  2485.55 |  4683.25 |  6070.27 |  8240.78 |  2421.31 |
| M7i io2 mCQRS     |     4.09 |     5.93 |     4.57 |     8.83 |     1.46 |
| M7i io2 Classical |     2.39 |     4.40 |     4.14 |     8.63 |     1.50 |
| M7a io2 mCQRS     |     2.29 |     3.59 |     2.53 |     5.08 |     0.73 |
| M7a io2 Classical |     1.57 |     3.04 |     2.55 |     5.22 |     0.78 |
| M7g io2 mCQRS     |     9.74 |    12.60 |    11.20 |    20.51 |     3.87 |
| M7g io2 Classical |     4.76 |     8.04 |     8.22 |    17.55 |     3.61 |
| M7a.io2 mCQRS (pred Exp)     |     2.77 |      2.33 |      2.92 |       2.33 |    1.25 |
| M7a.io2 mCQRS (pred HE)      |     2.77 |      2.32 |      2.92 |       2.32 |    1.26 |
| M7a.io2 mCQRS (pred LN)      |     2.95 |      2.33 |      3.07 |       2.33 |    1.13 |
| M7a.io2 Classical (pred Exp) |     1.99 |      1.95 |      2.75 |       1.95 |    1.02 |
| M7a.io2 Classical (pred HE)  |     1.99 |      1.96 |      2.74 |       1.96 |    1.02 |
| M7a.io2 Classical (pred LN)  |     1.92 |      2.10 |      2.65 |       2.10 |    1.02 |

### Load mode — p90

| Candidate         | POST req | POST cons | PATCH req | PATCH cons |  GET req |
|:------------------| -------:| -------:| -------:| -------:| -------:|
| M7i gp3 mCQRS     |    13.84 |    19.28 |    15.36 |    29.23 |     6.17 |
| M7i gp3 Classical |     7.52 |    12.07 |    11.29 |    23.13 |     4.79 |
| M7a gp3 mCQRS     |     5.85 |     8.40 |     6.14 |    11.52 |     2.01 |
| M7a gp3 Classical |     3.90 |     6.51 |     5.56 |    10.78 |     1.88 |
| M7g gp3 mCQRS     |  4947.78 |  7425.16 |  6275.78 |  9628.63 |  5239.89 |
| M7g gp3 Classical |  7234.28 |  9647.14 |  8200.09 | 12034.35 |  5082.77 |
| M7i io2 mCQRS     |     9.90 |    13.09 |    11.00 |    20.27 |     4.10 |
| M7i io2 Classical |     6.31 |     9.98 |     9.52 |    19.56 |     4.26 |
| M7a io2 mCQRS     |     4.34 |     6.32 |     4.76 |     8.97 |     1.65 |
| M7a io2 Classical |     3.32 |     5.47 |     4.63 |     9.20 |     1.78 |
| M7g io2 mCQRS     |    72.58 |   111.32 |    87.20 |   147.12 |    68.85 |
| M7g io2 Classical |   443.10 |   757.72 |   962.68 |  1350.63 |   447.46 |
| M7a.io2 mCQRS (pred Exp)     |     6.83 |      5.68 |      6.87 |       5.68 |    3.64 |
| M7a.io2 mCQRS (pred HE)      |     6.83 |      5.68 |      6.87 |       5.68 |    3.63 |
| M7a.io2 mCQRS (pred LN)      |     4.21 |      4.09 |      4.37 |       4.09 |    2.58 |
| M7a.io2 Classical (pred Exp) |     4.60 |      4.67 |      5.64 |       4.67 |    2.52 |
| M7a.io2 Classical (pred HE)  |     4.60 |      4.68 |      5.64 |       4.68 |    2.51 |
| M7a.io2 Classical (pred LN)  |     2.90 |      3.41 |      3.72 |       3.41 |    1.74 |

### Load mode — p95

| Candidate         | POST req | POST cons | PATCH req | PATCH cons |  GET req |
|:------------------| -------:| -------:| -------:| -------:| -------:|
| M7i gp3 mCQRS     |    18.03 |    25.48 |    20.30 |    38.35 |     9.07 |
| M7i gp3 Classical |    10.27 |    15.53 |    14.77 |    29.30 |     6.72 |
| M7a gp3 mCQRS     |     8.30 |    11.46 |     8.27 |    15.59 |     3.13 |
| M7a gp3 Classical |     4.84 |     7.87 |     6.78 |    13.19 |     2.62 |
| M7g gp3 mCQRS     |  5520.68 |  8220.37 |  6429.47 | 10062.36 |  6267.10 |
| M7g gp3 Classical |  7896.22 | 10483.41 |  9627.70 | 13268.87 |  5381.69 |
| M7i io2 mCQRS     |    12.74 |    16.60 |    14.58 |    26.70 |     5.54 |
| M7i io2 Classical |     8.23 |    12.73 |    12.44 |    25.74 |     5.87 |
| M7a io2 mCQRS     |     5.65 |     7.86 |     6.02 |    11.14 |     2.25 |
| M7a io2 Classical |     4.26 |     6.71 |     5.79 |    11.45 |     2.44 |
| M7g io2 mCQRS     |   353.92 |   601.50 |   494.22 |   754.89 |   376.10 |
| M7g io2 Classical |   662.22 |  1260.86 |  1700.99 |  2324.93 |   672.70 |
| M7a.io2 mCQRS (pred Exp)     |     8.47 |      7.03 |      8.46 |       7.03 |    4.81 |
| M7a.io2 mCQRS (pred HE)      |     8.49 |      7.05 |      8.44 |       7.05 |    4.79 |
| M7a.io2 mCQRS (pred LN)      |     4.79 |      4.75 |      4.94 |       4.75 |    3.20 |
| M7a.io2 Classical (pred Exp) |     5.64 |      5.73 |      6.76 |       5.73 |    3.17 |
| M7a.io2 Classical (pred HE)  |     5.65 |      5.77 |      6.74 |       5.77 |    3.15 |
| M7a.io2 Classical (pred LN)  |     3.32 |      3.91 |      4.15 |       3.91 |    2.17 |

### Load mode — range (max − min)

| Candidate         | POST req | POST cons | PATCH req | PATCH cons |  GET req |
|:------------------| -------:| -------:| -------:| -------:| -------:|
| M7i gp3 mCQRS     |    85.27 |   118.70 |    95.59 |  3036.37 |    77.81 |
| M7i gp3 Classical |    85.85 |   129.91 |   116.07 |  3043.40 |    51.51 |
| M7a gp3 mCQRS     |   329.44 |   469.88 |   329.26 |  3010.65 |   322.91 |
| M7a gp3 Classical |    36.66 |    52.03 |    36.88 |    56.18 |    25.95 |
| M7g gp3 mCQRS     |  5818.33 |  8193.94 |  4943.68 | 10374.69 |  5814.46 |
| M7g gp3 Classical |  7550.00 |  9580.01 |  8727.30 | 23700.74 |  4883.45 |
| M7i io2 mCQRS     |    63.22 |    91.23 |    67.25 |   119.29 |    55.58 |
| M7i io2 Classical |    51.33 |    66.46 |    66.03 |  3026.00 |    42.42 |
| M7a io2 mCQRS     |    62.65 |    73.48 |    51.43 |    91.29 |    31.18 |
| M7a io2 Classical |    26.69 |    36.08 |    31.66 |  3015.46 |    18.39 |
| M7g io2 mCQRS     |  1017.26 |  1502.78 |  1014.39 |  3060.43 |   987.17 |
| M7g io2 Classical |  1992.40 |  2614.03 |  2610.27 |  7841.43 |  1404.78 |
| M7a.io2 mCQRS (pred Exp)     |    26.78 |     25.27 |     32.04 |      25.27 |   19.97 |
| M7a.io2 mCQRS (pred HE)      |    29.28 |     22.62 |     27.38 |      22.62 |   21.79 |
| M7a.io2 mCQRS (pred LN)      |    12.08 |     14.73 |     13.66 |      14.73 |   12.15 |
| M7a.io2 Classical (pred Exp) |    24.62 |     19.00 |     23.29 |      19.00 |   14.15 |
| M7a.io2 Classical (pred HE)  |    20.80 |     23.33 |     22.33 |      23.33 |   12.02 |
| M7a.io2 Classical (pred LN)  |    11.13 |     11.89 |      9.59 |      11.89 |   10.49 |

### Load mode — variance

| Candidate         | POST req | POST cons | PATCH req | PATCH cons |  GET req |
|:------------------| -------:| -------:| -------:| -------:| -------:|
| M7i gp3 mCQRS     |    40.93 |    83.56 |    54.13 |  3281.91 |    20.68 |
| M7i gp3 Classical |    15.69 |    34.83 |    30.43 |  3773.30 |     8.35 |
| M7a gp3 mCQRS     |   504.61 |  1397.06 |   866.75 |  3794.72 |   587.55 |
| M7a gp3 Classical |     2.84 |     5.79 |     4.74 |    16.34 |     1.49 |
| M7g gp3 mCQRS     | 1809013.88 | 3364904.81 | 1799310.15 | 4924719.70 | 2176362.22 |
| M7g gp3 Classical | 4600329.35 | 6208428.75 | 4261847.39 | 8232449.39 | 1835281.03 |
| M7i io2 mCQRS     |    19.90 |    35.35 |    27.56 |    78.51 |     7.81 |
| M7i io2 Classical |     8.76 |    17.43 |    17.68 |  2845.95 |     5.25 |
| M7a io2 mCQRS     |     5.13 |     8.61 |     5.50 |    15.45 |     1.58 |
| M7a io2 Classical |     2.40 |     4.74 |     3.22 |  2274.85 |     0.87 |
| M7g io2 mCQRS     | 17803.90 | 48187.95 | 32687.75 | 82462.72 | 20874.52 |
| M7g io2 Classical | 103318.85 | 215419.74 | 260172.53 | 519645.44 | 67453.51 |
| M7a.io2 mCQRS (pred Exp)     |       6.54 |       4.59 |       6.33 |       4.59 |       2.43 |
| M7a.io2 mCQRS (pred HE)      |       6.56 |       4.59 |       6.33 |       4.59 |       2.43 |
| M7a.io2 mCQRS (pred LN)      |       0.70 |       1.32 |       0.79 |       1.32 |       0.75 |
| M7a.io2 Classical (pred Exp) |       2.82 |       3.01 |       3.58 |       3.01 |       0.96 |
| M7a.io2 Classical (pred HE)  |       2.82 |       3.05 |       3.59 |       3.05 |       0.96 |
| M7a.io2 Classical (pred LN)  |       0.39 |       0.77 |       0.47 |       0.77 |       0.27 |

### Load mode — stdev

| Candidate         | POST req | POST cons | PATCH req | PATCH cons |  GET req |
|:------------------| -------:| -------:| -------:| -------:| -------:|
| M7i gp3 mCQRS     |     6.40 |     9.14 |     7.36 |    57.29 |     4.55 |
| M7i gp3 Classical |     3.96 |     5.90 |     5.52 |    61.43 |     2.89 |
| M7a gp3 mCQRS     |    22.46 |    37.38 |    29.44 |    61.60 |    24.24 |
| M7a gp3 Classical |     1.68 |     2.41 |     2.18 |     4.04 |     1.22 |
| M7g gp3 mCQRS     |  1345.00 |  1834.37 |  1341.38 |  2219.17 |  1475.25 |
| M7g gp3 Classical |  2144.84 |  2491.67 |  2064.42 |  2869.22 |  1354.73 |
| M7i io2 mCQRS     |     4.46 |     5.95 |     5.25 |     8.86 |     2.80 |
| M7i io2 Classical |     2.96 |     4.17 |     4.20 |    53.35 |     2.29 |
| M7a io2 mCQRS     |     2.26 |     2.93 |     2.34 |     3.93 |     1.26 |
| M7a io2 Classical |     1.55 |     2.18 |     1.79 |    47.70 |     0.93 |
| M7g io2 mCQRS     |   133.43 |   219.52 |   180.80 |   287.16 |   144.48 |
| M7g io2 Classical |   321.43 |   464.13 |   510.07 |   720.86 |   259.72 |
| M7a.io2 mCQRS (pred Exp)     |     2.56 |      2.14 |      2.52 |       2.14 |    1.56 |
| M7a.io2 mCQRS (pred HE)      |     2.56 |      2.14 |      2.52 |       2.14 |    1.56 |
| M7a.io2 mCQRS (pred LN)      |     0.84 |      1.15 |      0.89 |       1.15 |    0.87 |
| M7a.io2 Classical (pred Exp) |     1.68 |      1.74 |      1.89 |       1.74 |    0.98 |
| M7a.io2 Classical (pred HE)  |     1.68 |      1.75 |      1.89 |       1.75 |    0.98 |
| M7a.io2 Classical (pred LN)  |     0.62 |      0.88 |      0.69 |       0.88 |    0.52 |
