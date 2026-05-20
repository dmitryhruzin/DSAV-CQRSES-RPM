**Максимальная относительная ошибка по всем строкам**: 0.2322% (m7i-gp3-m_cqrs-load.log / GET / http.request / median: mine=2.0547605, analyz-10=2.05).

# Сверка *-load с `apps/logs/analyz-10.md`

Якорь: соответствие наших метрик с метриками из [analyz-10.md](../logs/analyz-10.md):

| Наша метрика | Метрика в analyz-10 |
|---|---|
| GET responseTime | GET http.request |
| POST responseTime | POST http.request |
| POST `req_start → last event.handle end` | POST consistency_lag |
| PATCH responseTime | PATCH http.request |
| PATCH `req_start → last event.handle end` | PATCH consistency_lag |

Чтобы числа были сопоставимы apples-to-apples, здесь — в отличие от [log-analisis-load.md](log-analisis-load.md) — мы фильтруем только **успешные** запросы (`success === true` ∧ `200 ≤ status < 400`), как это делает `analyz-10.md`.

`Δabs = mine − analyz10`, `Δ% = (mine − analyz10) / analyz10 × 100`.

## m7i-gp3-m_cqrs-load.log

| method | metric          | stat     |    mine | analyz-10 |    Δabs |      Δ% |
|:-------|:----------------|:---------|--------:|----------:|--------:|--------:|
| POST   | http.request    | count    |   11511 |     11511 |       0 | +0.000% |
| POST   | http.request    | mean     |  7.4773 |    7.4800 | -0.0027 | -0.036% |
| POST   | http.request    | median   |  5.7069 |    5.7100 | -0.0031 | -0.054% |
| POST   | http.request    | p90      | 13.8386 |   13.8400 | -0.0014 | -0.010% |
| POST   | http.request    | p95      | 18.0265 |   18.0300 | -0.0035 | -0.019% |
| POST   | http.request    | variance | 40.9305 |   40.9300 |  0.0005 | +0.001% |
| POST   | http.request    | stdev    |  6.3977 |    6.4000 | -0.0023 | -0.036% |
| POST   | consistency_lag | count    |   11511 |     11511 |       0 | +0.000% |
| POST   | consistency_lag | mean     | 10.8560 |   10.8600 | -0.0040 | -0.037% |
| POST   | consistency_lag | median   |  8.3979 |    8.4000 | -0.0021 | -0.024% |
| POST   | consistency_lag | p90      | 19.2764 |   19.2800 | -0.0036 | -0.019% |
| POST   | consistency_lag | p95      | 25.4802 |   25.4800 |  0.0002 | +0.001% |
| POST   | consistency_lag | variance | 83.5638 |   83.5600 |  0.0038 | +0.005% |
| POST   | consistency_lag | stdev    |  9.1413 |    9.1400 |  0.0013 | +0.015% |
| PATCH  | http.request    | count    |   17448 |     17448 |       0 | +0.000% |
| PATCH  | http.request    | mean     |  8.3278 |    8.3300 | -0.0022 | -0.027% |
| PATCH  | http.request    | median   |  6.2450 |    6.2500 | -0.0050 | -0.079% |
| PATCH  | http.request    | p90      | 15.3547 |   15.3600 | -0.0053 | -0.035% |
| PATCH  | http.request    | p95      | 20.3039 |   20.3000 |  0.0039 | +0.019% |
| PATCH  | http.request    | variance | 54.1343 |   54.1300 |  0.0043 | +0.008% |
| PATCH  | http.request    | stdev    |  7.3576 |    7.3600 | -0.0024 | -0.033% |
| PATCH  | consistency_lag | count    |   17448 |     17448 |       0 | +0.000% |
| PATCH  | consistency_lag | mean     | 17.0785 |   17.0800 | -0.0015 | -0.009% |
| PATCH  | consistency_lag | median   | 12.5216 |   12.5200 |  0.0016 | +0.013% |
| PATCH  | consistency_lag | p90      | 29.2146 |   29.2300 | -0.0154 | -0.053% |
| PATCH  | consistency_lag | p95      | 38.3469 |   38.3500 | -0.0031 | -0.008% |
| PATCH  | consistency_lag | variance | 3281.91 |   3281.91 | -0.0042 | -0.000% |
| PATCH  | consistency_lag | stdev    | 57.2879 |   57.2900 | -0.0021 | -0.004% |
| GET    | http.request    | count    |   11548 |     11548 |       0 | +0.000% |
| GET    | http.request    | mean     |  3.2231 |    3.2200 |  0.0031 | +0.096% |
| GET    | http.request    | median   |  2.0548 |    2.0500 |  0.0048 | +0.232% |
| GET    | http.request    | p90      |  6.1653 |    6.1700 | -0.0047 | -0.076% |
| GET    | http.request    | p95      |  9.0719 |    9.0700 |  0.0019 | +0.021% |
| GET    | http.request    | variance | 20.6772 |   20.6800 | -0.0028 | -0.013% |
| GET    | http.request    | stdev    |  4.5472 |    4.5500 | -0.0028 | -0.061% |

## m7i-io2-m_cqrs-load.log

| method | metric          | stat     |    mine | analyz-10 |    Δabs |      Δ% |
|:-------|:----------------|:---------|--------:|----------:|--------:|--------:|
| POST   | http.request    | count    |   11042 |     11042 |       0 | +0.000% |
| POST   | http.request    | mean     |  5.3969 |    5.4000 | -0.0031 | -0.057% |
| POST   | http.request    | median   |  4.0899 |    4.0900 | -0.0001 | -0.002% |
| POST   | http.request    | p90      |  9.9028 |    9.9000 |  0.0028 | +0.029% |
| POST   | http.request    | p95      | 12.7407 |   12.7400 |  0.0007 | +0.006% |
| POST   | http.request    | variance | 19.8970 |   19.9000 | -0.0030 | -0.015% |
| POST   | http.request    | stdev    |  4.4606 |    4.4600 |  0.0006 | +0.013% |
| POST   | consistency_lag | count    |   11042 |     11042 |       0 | +0.000% |
| POST   | consistency_lag | mean     |  7.5343 |    7.5300 |  0.0043 | +0.057% |
| POST   | consistency_lag | median   |  5.9292 |    5.9300 | -0.0008 | -0.014% |
| POST   | consistency_lag | p90      | 13.0933 |   13.0900 |  0.0033 | +0.025% |
| POST   | consistency_lag | p95      | 16.6050 |   16.6000 |  0.0050 | +0.030% |
| POST   | consistency_lag | variance | 35.3494 |   35.3500 | -0.0006 | -0.002% |
| POST   | consistency_lag | stdev    |  5.9455 |    5.9500 | -0.0045 | -0.075% |
| PATCH  | http.request    | count    |   16144 |     16144 |       0 | +0.000% |
| PATCH  | http.request    | mean     |  6.1094 |    6.1100 | -0.0006 | -0.009% |
| PATCH  | http.request    | median   |  4.5654 |    4.5700 | -0.0046 | -0.100% |
| PATCH  | http.request    | p90      | 11.0046 |   11.0000 |  0.0046 | +0.041% |
| PATCH  | http.request    | p95      | 14.5757 |   14.5800 | -0.0043 | -0.030% |
| PATCH  | http.request    | variance | 27.5564 |   27.5600 | -0.0036 | -0.013% |
| PATCH  | http.request    | stdev    |  5.2494 |    5.2500 | -0.0006 | -0.011% |
| PATCH  | consistency_lag | count    |   16144 |     16144 |       0 | +0.000% |
| PATCH  | consistency_lag | mean     | 11.3794 |   11.3800 | -0.0006 | -0.006% |
| PATCH  | consistency_lag | median   |  8.8290 |    8.8300 | -0.0010 | -0.012% |
| PATCH  | consistency_lag | p90      | 20.2722 |   20.2700 |  0.0022 | +0.011% |
| PATCH  | consistency_lag | p95      | 26.6990 |   26.7000 | -0.0010 | -0.004% |
| PATCH  | consistency_lag | variance | 78.5079 |   78.5100 | -0.0021 | -0.003% |
| PATCH  | consistency_lag | stdev    |  8.8605 |    8.8600 |  0.0005 | +0.005% |
| GET    | http.request    | count    |   10971 |     10971 |       0 | +0.000% |
| GET    | http.request    | mean     |  2.1717 |    2.1700 |  0.0017 | +0.077% |
| GET    | http.request    | median   |  1.4592 |    1.4600 | -0.0008 | -0.055% |
| GET    | http.request    | p90      |  4.0996 |    4.1000 | -0.0004 | -0.009% |
| GET    | http.request    | p95      |  5.5400 |    5.5400 |  0.0000 | +0.000% |
| GET    | http.request    | variance |  7.8142 |    7.8100 |  0.0042 | +0.054% |
| GET    | http.request    | stdev    |  2.7954 |    2.8000 | -0.0046 | -0.164% |

## m7a-gp3-m_cqrs-load.log

| method | metric          | stat     |     mine | analyz-10 |    Δabs |      Δ% |
|:-------|:----------------|:---------|---------:|----------:|--------:|--------:|
| POST   | http.request    | count    |    11425 |     11425 |       0 | +0.000% |
| POST   | http.request    | mean     |   6.3465 |    6.3500 | -0.0035 | -0.054% |
| POST   | http.request    | median   |   2.9654 |    2.9700 | -0.0046 | -0.155% |
| POST   | http.request    | p90      |   5.8522 |    5.8500 |  0.0022 | +0.037% |
| POST   | http.request    | p95      |   8.2994 |    8.3000 | -0.0006 | -0.008% |
| POST   | http.request    | variance | 504.6109 |  504.6100 |  0.0009 | +0.000% |
| POST   | http.request    | stdev    |  22.4635 |   22.4600 |  0.0035 | +0.016% |
| POST   | consistency_lag | count    |    11425 |     11425 |       0 | +0.000% |
| POST   | consistency_lag | mean     |  10.3932 |   10.3900 |  0.0032 | +0.031% |
| POST   | consistency_lag | median   |   4.9355 |    4.9400 | -0.0045 | -0.090% |
| POST   | consistency_lag | p90      |   8.3972 |    8.4000 | -0.0028 | -0.033% |
| POST   | consistency_lag | p95      |  11.4646 |   11.4600 |  0.0046 | +0.040% |
| POST   | consistency_lag | variance |  1397.06 |   1397.06 |  0.0035 | +0.000% |
| POST   | consistency_lag | stdev    |  37.3773 |   37.3800 | -0.0027 | -0.007% |
| PATCH  | http.request    | count    |    16900 |     16900 |       0 | +0.000% |
| PATCH  | http.request    | mean     |   7.4475 |    7.4500 | -0.0025 | -0.033% |
| PATCH  | http.request    | median   |   3.1988 |    3.2000 | -0.0012 | -0.036% |
| PATCH  | http.request    | p90      |   6.1408 |    6.1400 |  0.0008 | +0.013% |
| PATCH  | http.request    | p95      |   8.2579 |    8.2700 | -0.0121 | -0.147% |
| PATCH  | http.request    | variance | 866.7502 |  866.7500 |  0.0002 | +0.000% |
| PATCH  | http.request    | stdev    |  29.4406 |   29.4400 |  0.0006 | +0.002% |
| PATCH  | consistency_lag | count    |    16900 |     16900 |       0 | +0.000% |
| PATCH  | consistency_lag | mean     |  13.6544 |   13.6500 |  0.0044 | +0.032% |
| PATCH  | consistency_lag | median   |   6.3641 |    6.3600 |  0.0041 | +0.065% |
| PATCH  | consistency_lag | p90      |  11.5193 |   11.5200 | -0.0007 | -0.006% |
| PATCH  | consistency_lag | p95      |  15.5789 |   15.5900 | -0.0111 | -0.071% |
| PATCH  | consistency_lag | variance |  3794.72 |   3794.72 |  0.0017 | +0.000% |
| PATCH  | consistency_lag | stdev    |  61.6013 |   61.6000 |  0.0013 | +0.002% |
| GET    | http.request    | count    |    11450 |     11450 |       0 | +0.000% |
| GET    | http.request    | mean     |   3.9744 |    3.9700 |  0.0044 | +0.110% |
| GET    | http.request    | median   |   0.7996 |    0.8000 | -0.0004 | -0.049% |
| GET    | http.request    | p90      |   2.0137 |    2.0100 |  0.0037 | +0.184% |
| GET    | http.request    | p95      |   3.1288 |    3.1300 | -0.0012 | -0.038% |
| GET    | http.request    | variance | 587.5509 |  587.5500 |  0.0009 | +0.000% |
| GET    | http.request    | stdev    |  24.2394 |   24.2400 | -0.0006 | -0.002% |

## m7a-io2-m_cqrs-load.log

| method | metric          | stat     |    mine | analyz-10 |    Δabs |      Δ% |
|:-------|:----------------|:---------|--------:|----------:|--------:|--------:|
| POST   | http.request    | count    |   11102 |     11102 |       0 | +0.000% |
| POST   | http.request    | mean     |  2.8499 |    2.8500 | -0.0001 | -0.004% |
| POST   | http.request    | median   |  2.2920 |    2.2900 |  0.0020 | +0.087% |
| POST   | http.request    | p90      |  4.3374 |    4.3400 | -0.0026 | -0.061% |
| POST   | http.request    | p95      |  5.6485 |    5.6500 | -0.0015 | -0.026% |
| POST   | http.request    | variance |  5.1265 |    5.1300 | -0.0035 | -0.068% |
| POST   | http.request    | stdev    |  2.2642 |    2.2600 |  0.0042 | +0.185% |
| POST   | consistency_lag | count    |   11102 |     11102 |       0 | +0.000% |
| POST   | consistency_lag | mean     |  4.2810 |    4.2800 |  0.0010 | +0.024% |
| POST   | consistency_lag | median   |  3.5876 |    3.5900 | -0.0024 | -0.066% |
| POST   | consistency_lag | p90      |  6.3240 |    6.3200 |  0.0040 | +0.063% |
| POST   | consistency_lag | p95      |  7.8650 |    7.8600 |  0.0050 | +0.063% |
| POST   | consistency_lag | variance |  8.6068 |    8.6100 | -0.0032 | -0.037% |
| POST   | consistency_lag | stdev    |  2.9337 |    2.9300 |  0.0037 | +0.127% |
| PATCH  | http.request    | count    |   16620 |     16620 |       0 | +0.000% |
| PATCH  | http.request    | mean     |  3.1233 |    3.1200 |  0.0033 | +0.106% |
| PATCH  | http.request    | median   |  2.5269 |    2.5300 | -0.0031 | -0.124% |
| PATCH  | http.request    | p90      |  4.7583 |    4.7600 | -0.0017 | -0.037% |
| PATCH  | http.request    | p95      |  6.0177 |    6.0200 | -0.0023 | -0.038% |
| PATCH  | http.request    | variance |  5.4955 |    5.5000 | -0.0045 | -0.081% |
| PATCH  | http.request    | stdev    |  2.3443 |    2.3400 |  0.0043 | +0.182% |
| PATCH  | consistency_lag | count    |   16620 |     16620 |       0 | +0.000% |
| PATCH  | consistency_lag | mean     |  5.9799 |    5.9800 | -0.0001 | -0.001% |
| PATCH  | consistency_lag | median   |  5.0768 |    5.0800 | -0.0032 | -0.063% |
| PATCH  | consistency_lag | p90      |  8.9705 |    8.9700 |  0.0005 | +0.005% |
| PATCH  | consistency_lag | p95      | 11.1365 |   11.1400 | -0.0035 | -0.032% |
| PATCH  | consistency_lag | variance | 15.4461 |   15.4500 | -0.0039 | -0.025% |
| PATCH  | consistency_lag | stdev    |  3.9302 |    3.9300 |  0.0002 | +0.004% |
| GET    | http.request    | count    |   10890 |     10890 |       0 | +0.000% |
| GET    | http.request    | mean     |  1.0006 |    1.0000 |  0.0006 | +0.056% |
| GET    | http.request    | median   |  0.7299 |    0.7300 | -0.0001 | -0.020% |
| GET    | http.request    | p90      |  1.6485 |    1.6500 | -0.0015 | -0.094% |
| GET    | http.request    | p95      |  2.2495 |    2.2500 | -0.0005 | -0.023% |
| GET    | http.request    | variance |  1.5825 |    1.5800 |  0.0025 | +0.158% |
| GET    | http.request    | stdev    |  1.2580 |    1.2600 | -0.0020 | -0.161% |
