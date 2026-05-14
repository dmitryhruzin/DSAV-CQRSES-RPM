<!-- markdownlint-disable MD024 MD040 MD013 MD032 MD060 -->

# Анализ логов

Метрики вычислены из telemetry-спанов:

- **http.request** — `durationMs` спана `http.request` (полное время обработки HTTP-запроса).
- **consistency_lag** — `(event.handle.endedAt) − http.request.startedAt`, то есть время от прихода запроса до завершения последнего event handler (только для команд POST/PATCH; GET не имеет ивент-хендлера).

Pino `responseTime` НЕ используется.

## M7i.large gp3

### mCQRS Sequential

```
Source: ../logs/m7i-gp3-m_cqrs-seq.log
Parsed: 36820 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  3.36    3.06  3.91  4.81  2.37  24.80  22.43      2.33   1.53
  ★ consistency_lag     600  5.17    4.81  6.34  7.18  3.30  26.65  23.35      3.11   1.76

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  metric              count    avg  median   p90   p95   min      max    range  variance  stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   3.59    3.34  4.40  5.47  0.78    29.57    28.80      2.51   1.58
  ★ consistency_lag    2100  16.02    5.77  8.37  9.55  4.06  1014.26  1010.20   9471.41  97.32

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.31    1.21  1.59  2.00  0.61  27.05  26.44      1.24   1.11
```

### mCQRS Load

```
Source: ../logs/m7i-gp3-m_cqrs-load.log
Parsed: 402125 log lines, 43421 unique req-ids, 43421 requests with http.request span

═══ POST  (create commands) ─ 12319 total / 12319 ok / 0 failed ═══
  error rate: 0 / 12319  (0.00%)
  metric              count    avg  median    p90     p95   min     max   range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
  http.request        12319  19.40    6.03  19.12   86.94  1.67  450.47  448.80   2988.90  54.67
  ★ consistency_lag   12319  31.21    8.82  26.74  148.73  2.04  675.13  673.09   8107.65  90.04

═══ PATCH (update commands) ─ 18740 total / 18566 ok / 174 failed ═══
  error rate: 174 / 18740  (0.93%)
  metric              count    avg  median    p90     p95   min      max    range  variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        18740  25.48    6.61  21.72  133.21  1.54   452.53   450.99   5543.63   74.46
  ★ consistency_lag   18566  41.61   13.10  37.86   93.03  3.04  4275.29  4272.24  21793.63  147.63

═══ GET   (queries) ─ 12362 total / 12362 ok / 0 failed ═══
  error rate: 0 / 12362  (0.00%)
  metric              count    avg  median   p90    p95   min     max   range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────────
  http.request        12362  14.74    2.19  9.58  56.63  0.42  438.01  437.59   3014.46  54.90
```

### Classical CQRS Sequential

```
Source: ../logs/m7i-gp3-classical_cqrs-seq.log
Parsed: 43311 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  2.56    2.09  3.49  3.85  1.46  28.23  26.77      1.90   1.38
  ★ consistency_lag     600  4.43    3.85  6.01  6.97  2.39  30.76  28.37      3.18   1.78

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  metric              count    avg  median   p90   p95   min      max    range  variance  stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   3.72    3.28  4.75  5.31  2.38    27.73    25.35      2.22   1.49
  ★ consistency_lag    2200  11.03    6.15  8.21  9.12  4.08  1014.86  1010.77   4542.26  67.40

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.22    1.17  1.56  1.82  0.62  12.98  12.36      0.40   0.63
```

### Classical CQRS Load

```
Source: ../logs/m7i-gp3-classical_cqrs-load.log
Parsed: 443210 log lines, 42995 unique req-ids, 42995 requests with http.request span

═══ POST  (create commands) ─ 12276 total / 12276 ok / 0 failed ═══
  error rate: 0 / 12276  (0.00%)
  metric              count    avg  median    p90    p95   min     max   range  variance  stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
  http.request        12276   9.07    3.07   8.94  14.45  0.97  532.98  532.01   1426.98  37.78
  ★ consistency_lag   12276  14.76    5.64  14.04  22.02  1.93  690.29  688.36   2950.94  54.32

═══ PATCH (update commands) ─ 18576 total / 18493 ok / 83 failed ═══
  error rate: 83 / 18576  (0.45%)
  metric              count    avg  median    p90    p95   min      max    range  variance   stdev
  ────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        18576  14.95    5.17  12.99  20.02  1.90   673.35   671.44   3255.27   57.05
  ★ consistency_lag   18493  26.86   10.58  25.86  36.77  2.94  4046.06  4043.12  20349.77  142.65

═══ GET   (queries) ─ 12143 total / 12143 ok / 0 failed ═══
  error rate: 0 / 12143  (0.00%)
  metric              count   avg  median   p90   p95   min     max   range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────
  http.request        12143  6.37    1.63  5.71  9.84  0.42  382.67  382.25    801.68  28.31
```

## M7a.large gp3

### mCQRS Sequential

```
Source: ../logs/m7a-gp3-m_cqrs-seq.log
Parsed: 36840 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  3.04    2.80  3.55  4.40  2.23  15.55  13.32      1.07   1.03
  ★ consistency_lag     600  4.68    4.58  5.77  6.57  3.37  21.41  18.04      1.98   1.41

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  metric              count    avg  median   p90   p95   min      max    range  variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   3.12    2.96  3.68  4.48  0.74    23.61    22.87      1.19    1.09
  ★ consistency_lag    2100  24.66    5.15  7.16  8.32  3.76  1010.44  1006.68  18750.33  136.93

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min   max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.10    1.03  1.31  1.60  0.66  5.45   4.80      0.22   0.47
```

### mCQRS Load

```
Source: ../logs/m7a-gp3-m_cqrs-load.log
Parsed: 396187 log lines, 42839 unique req-ids, 42839 requests with http.request span

═══ POST  (create commands) ─ 12314 total / 12314 ok / 0 failed ═══
  error rate: 0 / 12314  (0.00%)
  metric              count    avg  median   p90    p95   min     max   range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────────
  http.request        12314   8.56    3.02  6.57  14.06  1.37  330.81  329.44    807.58  28.42
  ★ consistency_lag   12314  14.01    4.98  9.50  19.07  1.87  471.76  469.88   2164.80  46.53

═══ PATCH (update commands) ─ 18222 total / 18124 ok / 98 failed ═══
  error rate: 98 / 18222  (0.54%)
  metric              count    avg  median    p90    p95   min      max    range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────────────
  http.request        18222  10.65    3.27   6.93  14.96  1.59   330.85   329.26   1423.98  37.74
  ★ consistency_lag   18124  18.00    6.47  12.57  21.42  2.38  3252.48  3250.10   7177.89  84.72

═══ GET   (queries) ─ 12303 total / 12303 ok / 0 failed ═══
  error rate: 0 / 12303  (0.00%)
  metric              count   avg  median   p90   p95   min     max   range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────
  http.request        12303  6.26    0.82  2.31  5.74  0.28  323.20  322.91    921.36  30.35
```

### Classical CQRS Sequential

```
Source: ../logs/m7a-gp3-classical_cqrs-seq.log
Parsed: 43315 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  2.36    2.01  2.97  3.39  1.46  16.07  14.61      0.95   0.98
  ★ consistency_lag     600  4.04    3.59  5.62  5.82  2.06  18.20  16.14      1.71   1.31

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  metric              count    avg  median   p90   p95   min      max    range  variance  stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   3.18    2.77  4.05  4.50  2.16    21.64    19.48      1.22   1.11
  ★ consistency_lag    2200  12.30    5.12  7.01  7.77  3.50  1007.72  1004.22   6786.93  82.38

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.06    1.00  1.28  1.50  0.62  16.94  16.31      0.39   0.62
```

### Classical CQRS Load

```
Source: ../logs/m7a-gp3-classical_cqrs-load.log
Parsed: 439591 log lines, 42806 unique req-ids, 42806 requests with http.request span

═══ POST  (create commands) ─ 12276 total / 12276 ok / 0 failed ═══
  error rate: 0 / 12276  (0.00%)
  metric              count   avg  median   p90   p95   min     max   range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────
  http.request        12276  2.77    2.04  3.99  5.06  0.86  154.87  154.01     33.77   5.81
  ★ consistency_lag   12276  4.93    3.90  6.65  8.18  0.89  206.80  205.92     69.75   8.35

═══ PATCH (update commands) ─ 18314 total / 18285 ok / 29 failed ═══
  error rate: 29 / 18314  (0.16%)
  metric              count   avg  median    p90    p95   min      max    range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
  http.request        18314  4.35    3.08   5.75   7.24  1.46   197.45   195.99     89.56   9.46
  ★ consistency_lag   18285  8.83    6.36  11.16  13.97  2.34  1256.56  1254.22    996.15  31.56

═══ GET   (queries) ─ 12216 total / 12216 ok / 0 failed ═══
  error rate: 0 / 12216  (0.00%)
  metric              count   avg  median   p90   p95   min     max   range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────
  http.request        12216  1.47    0.79  2.01  2.93  0.28  105.65  105.38     25.65   5.06
```

## M7g.large gp3

### mCQRS Sequential

```
Source: ../logs/m7g-gp3-m_cqrs-seq.log
Parsed: 36830 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  3.76    3.46  4.40  5.56  2.81  21.25  18.44      1.40   1.18
  ★ consistency_lag     600  5.81    5.12  7.29  8.19  3.62  24.35  20.73      3.09   1.76

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  metric              count    avg  median   p90    p95   min      max    range  variance   stdev
  ───────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   4.07    3.83  4.77   5.92  0.91    31.96    31.05      3.11    1.76
  ★ consistency_lag    2100  21.69    6.90  9.32  11.06  5.46  1010.45  1004.98  14115.25  118.81

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.40    1.36  1.70  2.10  0.82  14.50  13.68      0.50   0.70
```

### mCQRS Load

```
Source: ../logs/m7g-gp3-m_cqrs-load.log
Parsed: 385537 log lines, 42444 unique req-ids, 42444 requests with http.request span

═══ POST  (create commands) ─ 12212 total / 12212 ok / 0 failed ═══
  error rate: 0 / 12212  (0.00%)
  metric              count      avg   median      p90      p95   min      max    range    variance    stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        12212  2577.24  2408.12  4904.67  5386.55  4.73  6673.03  6668.30  1905308.45  1380.33
  ★ consistency_lag   12212  4522.22  4311.31  7390.29  8043.69  6.46  9942.01  9935.55  3773382.62  1942.52

═══ PATCH (update commands) ─ 18169 total / 16783 ok / 1386 failed ═══
  error rate: 1386 / 18169  (7.63%)
  metric              count      avg   median      p90       p95   min       max     range    variance    stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        18169  3893.58  3588.37  6193.49   6416.88  2.11   6689.22   6687.10  2169880.46  1473.05
  ★ consistency_lag   16783  6281.05  5819.42  9591.67  10025.92  7.19  13032.34  13025.15  5622257.03  2371.13

═══ GET   (queries) ─ 12063 total / 12063 ok / 0 failed ═══
  error rate: 0 / 12063  (0.00%)
  metric              count      avg   median      p90      p95   min      max    range    variance    stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        12063  2830.55  2531.52  5204.80  6175.57  1.52  6659.93  6658.41  2302183.42  1517.29
```

### Classical CQRS Sequential

```
Source: ../logs/m7g-gp3-classical_cqrs-seq.log
Parsed: 43315 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  2.87    2.32  3.81  4.29  1.78  20.05  18.27      2.03   1.43
  ★ consistency_lag     600  4.97    4.19  6.91  7.31  2.76  24.23  21.47      3.31   1.82

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  metric              count    avg  median   p90    p95   min      max    range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   4.14    3.63  5.21   5.89  2.89    50.40    47.51      2.53   1.59
  ★ consistency_lag    2200  14.07    6.83  9.17  10.22  4.62  1013.02  1008.41   6810.33  82.52

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.41    1.33  1.77  2.33  0.80  20.45  19.65      0.86   0.93
```

### Classical CQRS Load

```
Source: ../logs/m7g-gp3-classical_cqrs-load.log
Parsed: 439687 log lines, 43336 unique req-ids, 43336 requests with http.request span

═══ POST  (create commands) ─ 12266 total / 12266 ok / 0 failed ═══
  error rate: 0 / 12266  (0.00%)
  metric              count      avg   median      p90       p95   min       max     range    variance    stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        12266  2966.89  2414.11  7192.61   7867.03  3.33   8353.40   8350.07  4623857.14  2150.32
  ★ consistency_lag   12266  4758.50  4552.29  9564.53  10444.02  5.98  11242.32  11236.34  6608667.28  2570.73

═══ PATCH (update commands) ─ 18752 total / 17477 ok / 1275 failed ═══
  error rate: 1275 / 18752  (6.80%)
  metric              count      avg   median       p90       p95   min       max     range    variance    stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        18752  5668.29  5803.45   8142.32   9192.39  4.34  11240.30  11235.96  5080525.61  2254.00
  ★ consistency_lag   17477  7951.12  8022.22  11995.54  13130.15  7.29  27070.35  27063.07  9454585.16  3074.83

═══ GET   (queries) ─ 12318 total / 12318 ok / 0 failed ═══
  error rate: 0 / 12318  (0.00%)
  metric              count      avg   median      p90      p95   min      max    range    variance    stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        12318  2607.71  2328.55  4963.73  5359.77  1.59  5686.76  5685.18  1953151.83  1397.55
```

## M7i.large io2

### mCQRS Sequential

```
Source: ../logs/m7i-io2-m_cqrs-seq.log
Parsed: 36835 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  2.82    2.55  3.43  4.32  1.91  15.23  13.32      1.25   1.12
  ★ consistency_lag     600  4.18    3.73  5.05  6.18  2.16  24.05  21.88      2.39   1.55

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  metric              count    avg  median   p90   p95   min      max    range  variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   3.11    2.86  3.79  5.00  0.65    28.75    28.11      2.71    1.65
  ★ consistency_lag    2100  22.21    5.08  7.40  9.09  3.64  1011.31  1007.67  16427.91  128.17

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.22    1.12  1.52  1.81  0.56  18.68  18.12      0.87   0.93
```

### mCQRS Load

```
Source: ../logs/m7i-io2-m_cqrs-load.log
Parsed: 378694 log lines, 41000 unique req-ids, 41000 requests with http.request span

═══ POST  (create commands) ─ 11889 total / 11889 ok / 0 failed ═══
  error rate: 0 / 11889  (0.00%)
  metric              count    avg  median    p90    p95   min     max   range  variance  stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
  http.request        11889  15.13    4.28  12.42  24.86  1.56  561.99  560.44   2842.78  53.32
  ★ consistency_lag   11889  24.15    6.22  16.22  34.32  2.02  797.36  795.35   7732.59  87.94

═══ PATCH (update commands) ─ 17355 total / 17210 ok / 145 failed ═══
  error rate: 145 / 17355  (0.84%)
  metric              count    avg  median    p90    p95   min      max    range  variance   stdev
  ────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        17355  19.79    4.78  13.81  30.35  1.43   559.43   558.00   5201.62   72.12
  ★ consistency_lag   17210  28.44    9.14  24.14  40.62  2.72  1059.24  1056.51  10234.31  101.16

═══ GET   (queries) ─ 11756 total / 11756 ok / 0 failed ═══
  error rate: 0 / 11756  (0.00%)
  metric              count    avg  median   p90    p95   min     max   range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────────
  http.request        11756  11.86    1.54  5.17  12.74  0.45  543.62  543.17   3029.67  55.04
```

### Classical CQRS Sequential

```
Source: ../logs/m7i-io2-classical_cqrs-seq.log
Parsed: 43305 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  2.09    1.66  3.05  3.43  1.23   7.59   6.37      0.78   0.88
  ★ consistency_lag     600  3.47    3.30  4.91  5.73  2.03  22.69  20.65      2.14   1.46

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  metric              count   avg  median   p90   p95   min      max    range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200  3.16    2.85  4.02  4.59  2.03    21.64    19.61      1.28   1.13
  ★ consistency_lag    2200  7.80    5.07  7.23  8.37  3.70  1006.45  1002.75   2269.18  47.64

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min   max  range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.19    1.13  1.54  1.81  0.55  8.52   7.97      0.32   0.57
```

### Classical CQRS Load

```
Source: ../logs/m7i-io2-classical_cqrs-load.log
Parsed: 421955 log lines, 41173 unique req-ids, 41173 requests with http.request span

═══ POST  (create commands) ─ 11903 total / 11903 ok / 0 failed ═══
  error rate: 0 / 11903  (0.00%)
  metric              count    avg  median    p90    p95   min     max   range  variance  stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────
  http.request        11903   9.80    2.47   7.55  13.06  0.98  599.61  598.64   2059.74  45.38
  ★ consistency_lag   11903  15.90    4.55  11.68  19.44  0.96  785.73  784.77   4386.69  66.23

═══ PATCH (update commands) ─ 17508 total / 17409 ok / 99 failed ═══
  error rate: 99 / 17508  (0.57%)
  metric              count    avg  median    p90    p95   min      max    range  variance   stdev
  ────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        17508  18.27    4.29  11.45  21.38  1.82   777.05   775.23   5737.82   75.75
  ★ consistency_lag   17409  30.42    8.89  23.18  37.07  2.65  4212.64  4209.99  27147.41  164.76

═══ GET   (queries) ─ 11762 total / 11762 ok / 0 failed ═══
  error rate: 0 / 11762  (0.00%)
  metric              count   avg  median   p90    p95   min     max   range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────────
  http.request        11762  8.17    1.56  5.32  10.39  0.45  417.76  417.31   1421.85  37.71
```

## M7a.large io2

### mCQRS Sequential

```
Source: ../logs/m7a-io2-m_cqrs-seq.log
Parsed: 36845 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  2.75    2.51  3.20  4.26  2.01  14.99  12.97      1.07   1.04
  ★ consistency_lag     600  4.02    3.55  5.15  5.93  2.15  16.55  14.40      1.64   1.28

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  metric              count    avg  median   p90   p95   min      max    range  variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   2.86    2.71  3.40  4.30  0.74    13.93    13.19      0.81    0.90
  ★ consistency_lag    2100  26.37    4.73  6.58  8.09  3.46  1009.68  1006.22  21038.77  145.05

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.12    1.03  1.32  1.78  0.65  16.50  15.86      0.53   0.73
```

### mCQRS Load

```
Source: ../logs/m7a-io2-m_cqrs-load.log
Parsed: 384369 log lines, 41377 unique req-ids, 41377 requests with http.request span

═══ POST  (create commands) ─ 11886 total / 11886 ok / 0 failed ═══
  error rate: 0 / 11886  (0.00%)
  metric              count   avg  median   p90   p95   min     max   range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────
  http.request        11886  3.67    2.33  4.66  6.46  1.25  165.13  163.88     71.84   8.48
  ★ consistency_lag   11886  5.58    3.66  6.68  9.02  1.80  236.42  234.62    175.63  13.25

═══ PATCH (update commands) ─ 17818 total / 17778 ok / 40 failed ═══
  error rate: 40 / 17818  (0.22%)
  metric              count   avg  median   p90    p95   min     max   range  variance  stdev
  ───────────────────────────────────────────────────────────────────────────────────────────
  http.request        17818  4.21    2.56  5.06   6.76  1.53  164.42  162.89    121.94  11.04
  ★ consistency_lag   17778  7.44    5.14  9.39  12.17  2.32  351.98  349.65    268.84  16.40

═══ GET   (queries) ─ 11673 total / 11673 ok / 0 failed ═══
  error rate: 0 / 11673  (0.00%)
  metric              count   avg  median   p90   p95   min     max   range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────
  http.request        11673  1.63    0.74  1.76  2.57  0.29  150.46  150.17     56.93   7.54
```

### Classical CQRS Sequential

```
Source: ../logs/m7a-io2-classical_cqrs-seq.log
Parsed: 43330 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  2.13    1.86  2.83  3.09  1.34  10.92   9.58      0.70   0.84
  ★ consistency_lag     600  3.43    3.23  4.94  5.31  1.90  12.80  10.90      1.41   1.19

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  metric              count    avg  median   p90   p95   min      max    range  variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   2.86    2.61  3.69  4.20  2.00    12.25    10.26      0.67    0.82
  ★ consistency_lag    2200  18.49    4.65  6.41  7.42  3.43  1009.52  1006.09  13485.66  116.13

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.08    1.01  1.28  1.63  0.66  15.10  14.44      0.42   0.65
```

### Classical CQRS Load

```
Source: ../logs/m7a-io2-classical_cqrs-load.log
Parsed: 415302 log lines, 40625 unique req-ids, 40625 requests with http.request span

═══ POST  (create commands) ─ 11819 total / 11819 ok / 0 failed ═══
  error rate: 0 / 11819  (0.00%)
  metric              count   avg  median   p90   p95   min     max   range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────
  http.request        11819  2.76    1.60  3.48  4.74  0.82  171.42  170.60     76.21   8.73
  ★ consistency_lag   11819  4.68    3.07  5.71  7.39  0.80  227.93  227.14    157.47  12.55

═══ PATCH (update commands) ─ 17135 total / 17111 ok / 24 failed ═══
  error rate: 24 / 17135  (0.14%)
  metric              count    avg  median   p90    p95   min      max    range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
  http.request        17135   4.27    2.57  4.89   6.40  1.49   221.61   220.12    162.45  12.75
  ★ consistency_lag   17111  10.48    5.28  9.62  12.45  2.30  3328.33  3326.03   9536.78  97.66

═══ GET   (queries) ─ 11671 total / 11671 ok / 0 failed ═══
  error rate: 0 / 11671  (0.00%)
  metric              count   avg  median   p90   p95   min     max   range  variance  stdev
  ──────────────────────────────────────────────────────────────────────────────────────────
  http.request        11671  1.64    0.79  1.90  2.79  0.29  122.26  121.97     37.05   6.09
```

## M7g.large io2

### mCQRS Sequential

```
Source: ../logs/m7g-io2-m_cqrs-seq.log
Parsed: 36825 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  3.19    2.86  3.94  5.09  2.30  29.20  26.90      2.13   1.46
  ★ consistency_lag     600  4.48    4.34  5.85  6.73  3.06  30.37  27.31      2.86   1.69

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  metric              count    avg  median   p90   p95   min      max    range  variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   3.50    3.18  4.25  5.63  0.87    32.41    31.54      3.38    1.84
  ★ consistency_lag    2100  17.97    5.32  8.10  9.35  3.89  1011.78  1007.89  11796.37  108.61

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.44    1.32  1.76  2.52  0.80  19.99  19.19      1.21   1.10
```

### mCQRS Load

```
Source: ../logs/m7g-io2-m_cqrs-load.log
Parsed: 378269 log lines, 41044 unique req-ids, 41044 requests with http.request span

═══ POST  (create commands) ─ 11955 total / 11955 ok / 0 failed ═══
  error rate: 0 / 11955  (0.00%)
  metric              count     avg  median     p90      p95   min      max    range   variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        11955   85.47   11.00  381.92   524.44  1.70  1171.36  1169.65   40824.63  202.05
  ★ consistency_lag   11955  144.06   14.09  726.10  1002.88  1.96  1727.46  1725.50  113048.81  336.23

═══ PATCH (update commands) ─ 17345 total / 17013 ok / 332 failed ═══
  error rate: 332 / 17345  (1.91%)
  metric              count     avg  median     p90      p95   min      max    range   variance   stdev
  ─────────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        17345  122.31   12.67  583.61   929.36  1.79  1181.03  1179.24   77872.84  279.06
  ★ consistency_lag   17013  175.84   22.29  554.83  1397.22  3.78  3064.22  3060.43  174314.44  417.51

═══ GET   (queries) ─ 11744 total / 11744 ok / 0 failed ═══
  error rate: 0 / 11744  (0.00%)
  metric              count    avg  median     p90     p95   min      max    range  variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        11744  89.38    4.41  402.01  602.10  0.51  1168.25  1167.74  50004.36  223.62
```

### Classical CQRS Sequential

```
Source: ../logs/m7g-io2-classical_cqrs-seq.log
Parsed: 43327 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request          600  2.20    1.69  3.16  3.67  1.35  14.84  13.50      1.11   1.05
  ★ consistency_lag     600  3.51    3.29  4.84  5.78  1.99  17.84  15.85      1.87   1.37

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  metric              count    avg  median   p90   p95   min      max    range  variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────
  http.request         2200   3.32    2.92  4.13  4.97  2.35    28.58    26.23      1.94    1.39
  ★ consistency_lag    2200  17.04    5.17  7.47  8.69  3.74  1012.95  1009.21  11279.04  106.20

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  metric              count   avg  median   p90   p95   min    max  range  variance  stdev
  ────────────────────────────────────────────────────────────────────────────────────────
  http.request         1300  1.29    1.25  1.59  1.94  0.79  10.99  10.20      0.34   0.58
```

### Classical CQRS Load

```
Source: ../logs/m7g-io2-classical_cqrs-load.log
Parsed: 422498 log lines, 41284 unique req-ids, 41284 requests with http.request span

═══ POST  (create commands) ─ 12076 total / 12076 ok / 0 failed ═══
  error rate: 0 / 12076  (0.00%)
  metric              count     avg  median      p90      p95   min      max    range   variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        12076  169.09    5.44   594.59   979.58  0.90  1993.30  1992.40  151025.31  388.62
  ★ consistency_lag   12076  268.64    9.04  1171.35  1378.83  1.05  2615.07  2614.03  314172.28  560.51

═══ PATCH (update commands) ─ 17616 total / 17259 ok / 357 failed ═══
  error rate: 357 / 17616  (2.03%)
  metric              count     avg  median      p90      p95   min      max    range   variance   stdev
  ──────────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        17616  314.62    9.43  1468.44  1823.54  1.93  2612.20  2610.27  371974.13  609.90
  ★ consistency_lag   17259  426.56   19.41  1863.36  2478.83  2.71  8682.89  8680.18  783506.01  885.16

═══ GET   (queries) ─ 11592 total / 11592 ok / 0 failed ═══
  error rate: 0 / 11592  (0.00%)
  metric              count     avg  median     p90     p95   min      max    range  variance   stdev
  ───────────────────────────────────────────────────────────────────────────────────────────────────
  http.request        11592  148.59    4.17  604.91  887.62  0.50  1405.29  1404.78  92892.74  304.78
```

## Summary

Сравнение всех кандидатов. Метрики:

- **Error rate** — общая доля неудачных запросов (по всем методам).
- **req** — `http.request.durationMs` (полное серверное время обработки HTTP-запроса).
- **cons** — `consistency_lag = event_handler_end − http.request.startedAt` (для GET нет — нет ивент-хендлера).

Для каждой пары (request-time / consistency-lag) показаны: **avg, median, p90, p95, range (max−min), variance, stdev**.

**Predicted rows** (`M7a.io2 (pred Exp/HE/LN)`) — прогнозы из JMT-prediction-v3 для **M7a.large io2** под нагрузкой 100Q+100POST+150PATCH+250RC /s. Калибровка из Sequential логов (баз M7i.gp3, M7i.io2, M7a.gp3) с дисковым K-масштабированием по методу Brunnert et al. Три распределения времени обслуживания: **Exp** (M/M/1), **HE** (HyperExp), **LN** (Lognormal). Подробности — [JMT-prediction-v3/report_v3.md](../JMT-prediction-v3/report_v3.md).

В predicted-строках:
- `POST req / PATCH req / GET req` — отклик классов Команди створення / Команди оновлення / Запити.
- `POST cons / PATCH cons` — отклик RC класса (Процеси досягнення узгодженості) standalone из той же симуляции. Это НЕ прямой эквивалент measured `consistency_lag` (от прихода запроса до конца хендлера); это самостоятельный response-time event-handler класса в QN.

### Load mode — avg

| Candidate         |   Err | POST req | POST cons | PATCH req | PATCH cons | GET req |
|:------------------|------:|---------:|----------:|----------:|-----------:|--------:|
| M7i gp3 mCQRS     | 0.40% |    19.40 |     31.21 |     25.48 |      41.61 |   14.74 |
| M7i io2 mCQRS     | 0.35% |    15.13 |     24.15 |     19.79 |      28.44 |   11.86 |
| M7a gp3 mCQRS     | 0.23% |     8.56 |     14.01 |     10.65 |      18.00 |    6.26 |
| M7a io2 mCQRS     | 0.10% |     3.67 |      5.58 |      4.21 |       7.44 |    1.63 |
| M7g gp3 mCQRS     | 3.27% |  2577.24 |   4522.22 |   3893.58 |    6281.05 | 2830.55 |
| M7g io2 mCQRS     | 0.81% |    85.47 |    144.06 |    122.31 |     175.84 |   89.38 |
| M7i gp3 Classical | 0.19% |     9.07 |     14.76 |     14.95 |      26.86 |    6.37 |
| M7i io2 Classical | 0.24% |     9.80 |     15.90 |     18.27 |      30.42 |    8.17 |
| M7a gp3 Classical | 0.07% |     2.77 |      4.93 |      4.35 |       8.83 |    1.47 |
| M7a io2 Classical | 0.06% |     2.76 |      4.68 |      4.27 |      10.48 |    1.64 |
| M7g gp3 Classical | 2.94% |  2966.89 |   4758.50 |   5668.29 |    7951.12 | 2607.71 |
| M7g io2 Classical | 0.86% |   169.09 |    268.64 |    314.62 |     426.56 |  148.59 |
| M7a.io2 mCQRS (pred Exp)     | — |     3.43 |      2.86 |      3.53 |       2.86 |    1.71 |
| M7a.io2 mCQRS (pred HE)      | — |     3.44 |      2.85 |      3.53 |       2.85 |    1.72 |
| M7a.io2 mCQRS (pred LN)      | — |     3.15 |      2.57 |      3.25 |       2.57 |    1.43 |
| M7a.io2 Classical (pred Exp) | — |     2.39 |      2.37 |      3.13 |       2.37 |    1.27 |
| M7a.io2 Classical (pred HE)  | — |     2.39 |      2.38 |      3.13 |       2.38 |    1.26 |
| M7a.io2 Classical (pred LN)  | — |     2.09 |      2.26 |      2.82 |       2.26 |    1.16 |

### Load mode — median

| Candidate         | POST req | POST cons | PATCH req | PATCH cons | GET req |
|:------------------|---------:|----------:|----------:|-----------:|--------:|
| M7i gp3 mCQRS     |     6.03 |      8.82 |      6.61 |      13.10 |    2.19 |
| M7i io2 mCQRS     |     4.28 |      6.22 |      4.78 |       9.14 |    1.54 |
| M7a gp3 mCQRS     |     3.02 |      4.98 |      3.27 |       6.47 |    0.82 |
| M7a io2 mCQRS     |     2.33 |      3.66 |      2.56 |       5.14 |    0.74 |
| M7g gp3 mCQRS     |  2408.12 |   4311.31 |   3588.37 |    5819.42 | 2531.52 |
| M7g io2 mCQRS     |    11.00 |     14.09 |     12.67 |      22.29 |    4.41 |
| M7i gp3 Classical |     3.07 |      5.64 |      5.17 |      10.58 |    1.63 |
| M7i io2 Classical |     2.47 |      4.55 |      4.29 |       8.89 |    1.56 |
| M7a gp3 Classical |     2.04 |      3.90 |      3.08 |       6.36 |    0.79 |
| M7a io2 Classical |     1.60 |      3.07 |      2.57 |       5.28 |    0.79 |
| M7g gp3 Classical |  2414.11 |   4552.29 |   5803.45 |    8022.22 | 2328.55 |
| M7g io2 Classical |     5.44 |      9.04 |      9.43 |      19.41 |    4.17 |
| M7a.io2 mCQRS (pred Exp)     |     2.77 |      2.33 |      2.92 |       2.33 |    1.25 |
| M7a.io2 mCQRS (pred HE)      |     2.77 |      2.32 |      2.92 |       2.32 |    1.26 |
| M7a.io2 mCQRS (pred LN)      |     2.95 |      2.33 |      3.07 |       2.33 |    1.13 |
| M7a.io2 Classical (pred Exp) |     1.99 |      1.95 |      2.75 |       1.95 |    1.02 |
| M7a.io2 Classical (pred HE)  |     1.99 |      1.96 |      2.74 |       1.96 |    1.02 |
| M7a.io2 Classical (pred LN)  |     1.92 |      2.10 |      2.65 |       2.10 |    1.02 |

### Load mode — p90

| Candidate         | POST req | POST cons | PATCH req | PATCH cons | GET req |
|:------------------|---------:|----------:|----------:|-----------:|--------:|
| M7i gp3 mCQRS     |    19.12 |     26.74 |     21.72 |      37.86 |    9.58 |
| M7i io2 mCQRS     |    12.42 |     16.22 |     13.81 |      24.14 |    5.17 |
| M7a gp3 mCQRS     |     6.57 |      9.50 |      6.93 |      12.57 |    2.31 |
| M7a io2 mCQRS     |     4.66 |      6.68 |      5.06 |       9.39 |    1.76 |
| M7g gp3 mCQRS     |  4904.67 |   7390.29 |   6193.49 |    9591.67 | 5204.80 |
| M7g io2 mCQRS     |   381.92 |    726.10 |    583.61 |     554.83 |  402.01 |
| M7i gp3 Classical |     8.94 |     14.04 |     12.99 |      25.86 |    5.71 |
| M7i io2 Classical |     7.55 |     11.68 |     11.45 |      23.18 |    5.32 |
| M7a gp3 Classical |     3.99 |      6.65 |      5.75 |      11.16 |    2.01 |
| M7a io2 Classical |     3.48 |      5.71 |      4.89 |       9.62 |    1.90 |
| M7g gp3 Classical |  7192.61 |   9564.53 |   8142.32 |   11995.54 | 4963.73 |
| M7g io2 Classical |   594.59 |   1171.35 |   1468.44 |    1863.36 |  604.91 |
| M7a.io2 mCQRS (pred Exp)     |     6.83 |      5.68 |      6.87 |       5.68 |    3.64 |
| M7a.io2 mCQRS (pred HE)      |     6.83 |      5.68 |      6.87 |       5.68 |    3.63 |
| M7a.io2 mCQRS (pred LN)      |     4.21 |      4.09 |      4.37 |       4.09 |    2.58 |
| M7a.io2 Classical (pred Exp) |     4.60 |      4.67 |      5.64 |       4.67 |    2.52 |
| M7a.io2 Classical (pred HE)  |     4.60 |      4.68 |      5.64 |       4.68 |    2.51 |
| M7a.io2 Classical (pred LN)  |     2.90 |      3.41 |      3.72 |       3.41 |    1.74 |

### Load mode — p95

| Candidate         | POST req | POST cons | PATCH req | PATCH cons | GET req |
|:------------------|---------:|----------:|----------:|-----------:|--------:|
| M7i gp3 mCQRS     |    86.94 |    148.73 |    133.21 |      93.03 |   56.63 |
| M7i io2 mCQRS     |    24.86 |     34.32 |     30.35 |      40.62 |   12.74 |
| M7a gp3 mCQRS     |    14.06 |     19.07 |     14.96 |      21.42 |    5.74 |
| M7a io2 mCQRS     |     6.46 |      9.02 |      6.76 |      12.17 |    2.57 |
| M7g gp3 mCQRS     |  5386.55 |   8043.69 |   6416.88 |   10025.92 | 6175.57 |
| M7g io2 mCQRS     |   524.44 |   1002.88 |    929.36 |    1397.22 |  602.10 |
| M7i gp3 Classical |    14.45 |     22.02 |     20.02 |      36.77 |    9.84 |
| M7i io2 Classical |    13.06 |     19.44 |     21.38 |      37.07 |   10.39 |
| M7a gp3 Classical |     5.06 |      8.18 |      7.24 |      13.97 |    2.93 |
| M7a io2 Classical |     4.74 |      7.39 |      6.40 |      12.45 |    2.79 |
| M7g gp3 Classical |  7867.03 |  10444.02 |   9192.39 |   13130.15 | 5359.77 |
| M7g io2 Classical |   979.58 |   1378.83 |   1823.54 |    2478.83 |  887.62 |
| M7a.io2 mCQRS (pred Exp)     |     8.47 |      7.03 |      8.46 |       7.03 |    4.81 |
| M7a.io2 mCQRS (pred HE)      |     8.49 |      7.05 |      8.44 |       7.05 |    4.79 |
| M7a.io2 mCQRS (pred LN)      |     4.79 |      4.75 |      4.94 |       4.75 |    3.20 |
| M7a.io2 Classical (pred Exp) |     5.64 |      5.73 |      6.76 |       5.73 |    3.17 |
| M7a.io2 Classical (pred HE)  |     5.65 |      5.77 |      6.74 |       5.77 |    3.15 |
| M7a.io2 Classical (pred LN)  |     3.32 |      3.91 |      4.15 |       3.91 |    2.17 |

### Load mode — range (max − min)

| Candidate         | POST req | POST cons | PATCH req | PATCH cons | GET req |
|:------------------|---------:|----------:|----------:|-----------:|--------:|
| M7i gp3 mCQRS     |   448.80 |    673.09 |    450.99 |    4272.24 |  437.59 |
| M7i io2 mCQRS     |   560.44 |    795.35 |    558.00 |    1056.51 |  543.17 |
| M7a gp3 mCQRS     |   329.44 |    469.88 |    329.26 |    3250.10 |  322.91 |
| M7a io2 mCQRS     |   163.88 |    234.62 |    162.89 |     349.65 |  150.17 |
| M7g gp3 mCQRS     |  6668.30 |   9935.55 |   6687.10 |   13025.15 | 6658.41 |
| M7g io2 mCQRS     |  1169.65 |   1725.50 |   1179.24 |    3060.43 | 1167.74 |
| M7i gp3 Classical |   532.01 |    688.36 |    671.44 |    4043.12 |  382.25 |
| M7i io2 Classical |   598.64 |    784.77 |    775.23 |    4209.99 |  417.31 |
| M7a gp3 Classical |   154.01 |    205.92 |    195.99 |    1254.22 |  105.38 |
| M7a io2 Classical |   170.60 |    227.14 |    220.12 |    3326.03 |  121.97 |
| M7g gp3 Classical |  8350.07 |  11236.34 |  11235.96 |   27063.07 | 5685.18 |
| M7g io2 Classical |  1992.40 |   2614.03 |   2610.27 |    8680.18 | 1404.78 |
| M7a.io2 mCQRS (pred Exp)     |    26.78 |     25.27 |     32.04 |      25.27 |   19.97 |
| M7a.io2 mCQRS (pred HE)      |    29.28 |     22.62 |     27.38 |      22.62 |   21.79 |
| M7a.io2 mCQRS (pred LN)      |    12.08 |     14.73 |     13.66 |      14.73 |   12.15 |
| M7a.io2 Classical (pred Exp) |    24.62 |     19.00 |     23.29 |      19.00 |   14.15 |
| M7a.io2 Classical (pred HE)  |    20.80 |     23.33 |     22.33 |      23.33 |   12.02 |
| M7a.io2 Classical (pred LN)  |    11.13 |     11.89 |      9.59 |      11.89 |   10.49 |

### Load mode — variance

| Candidate         |   POST req |  POST cons |  PATCH req | PATCH cons |    GET req |
|:------------------|-----------:|-----------:|-----------:|-----------:|-----------:|
| M7i gp3 mCQRS     |    2988.90 |    8107.65 |    5543.63 |   21793.63 |    3014.46 |
| M7i io2 mCQRS     |    2842.78 |    7732.59 |    5201.62 |   10234.31 |    3029.67 |
| M7a gp3 mCQRS     |     807.58 |    2164.80 |    1423.98 |    7177.89 |     921.36 |
| M7a io2 mCQRS     |      71.84 |     175.63 |     121.94 |     268.84 |      56.93 |
| M7g gp3 mCQRS     | 1905308.45 | 3773382.62 | 2169880.46 | 5622257.03 | 2302183.42 |
| M7g io2 mCQRS     |   40824.63 |  113048.81 |   77872.84 |  174314.44 |   50004.36 |
| M7i gp3 Classical |    1426.98 |    2950.94 |    3255.27 |   20349.77 |     801.68 |
| M7i io2 Classical |    2059.74 |    4386.69 |    5737.82 |   27147.41 |    1421.85 |
| M7a gp3 Classical |      33.77 |      69.75 |      89.56 |     996.15 |      25.65 |
| M7a io2 Classical |      76.21 |     157.47 |     162.45 |    9536.78 |      37.05 |
| M7g gp3 Classical | 4623857.14 | 6608667.28 | 5080525.61 | 9454585.16 | 1953151.83 |
| M7g io2 Classical |  151025.31 |  314172.28 |  371974.13 |  783506.01 |   92892.74 |
| M7a.io2 mCQRS (pred Exp)     |       6.54 |       4.59 |       6.33 |       4.59 |       2.43 |
| M7a.io2 mCQRS (pred HE)      |       6.56 |       4.59 |       6.33 |       4.59 |       2.43 |
| M7a.io2 mCQRS (pred LN)      |       0.70 |       1.32 |       0.79 |       1.32 |       0.75 |
| M7a.io2 Classical (pred Exp) |       2.82 |       3.01 |       3.58 |       3.01 |       0.96 |
| M7a.io2 Classical (pred HE)  |       2.82 |       3.05 |       3.59 |       3.05 |       0.96 |
| M7a.io2 Classical (pred LN)  |       0.39 |       0.77 |       0.47 |       0.77 |       0.27 |

### Load mode — stdev

| Candidate         | POST req | POST cons | PATCH req | PATCH cons | GET req |
|:------------------|---------:|----------:|----------:|-----------:|--------:|
| M7i gp3 mCQRS     |    54.67 |     90.04 |     74.46 |     147.63 |   54.90 |
| M7i io2 mCQRS     |    53.32 |     87.94 |     72.12 |     101.16 |   55.04 |
| M7a gp3 mCQRS     |    28.42 |     46.53 |     37.74 |      84.72 |   30.35 |
| M7a io2 mCQRS     |     8.48 |     13.25 |     11.04 |      16.40 |    7.54 |
| M7g gp3 mCQRS     |  1380.33 |   1942.52 |   1473.05 |    2371.13 | 1517.29 |
| M7g io2 mCQRS     |   202.05 |    336.23 |    279.06 |     417.51 |  223.62 |
| M7i gp3 Classical |    37.78 |     54.32 |     57.05 |     142.65 |   28.31 |
| M7i io2 Classical |    45.38 |     66.23 |     75.75 |     164.76 |   37.71 |
| M7a gp3 Classical |     5.81 |      8.35 |      9.46 |      31.56 |    5.06 |
| M7a io2 Classical |     8.73 |     12.55 |     12.75 |      97.66 |    6.09 |
| M7g gp3 Classical |  2150.32 |   2570.73 |   2254.00 |    3074.83 | 1397.55 |
| M7g io2 Classical |   388.62 |    560.51 |    609.90 |     885.16 |  304.78 |
| M7a.io2 mCQRS (pred Exp)     |     2.56 |      2.14 |      2.52 |       2.14 |    1.56 |
| M7a.io2 mCQRS (pred HE)      |     2.56 |      2.14 |      2.52 |       2.14 |    1.56 |
| M7a.io2 mCQRS (pred LN)      |     0.84 |      1.15 |      0.89 |       1.15 |    0.87 |
| M7a.io2 Classical (pred Exp) |     1.68 |      1.74 |      1.89 |       1.74 |    0.98 |
| M7a.io2 Classical (pred HE)  |     1.68 |      1.75 |      1.89 |       1.75 |    0.98 |
| M7a.io2 Classical (pred LN)  |     0.62 |      0.88 |      0.69 |       0.88 |    0.52 |
