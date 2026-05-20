# Метрики *-seq логов (после 10s skip + retry-strip)

Источник: [apps/JMT-prediction-manual/logs10-noretry/](logs10-noretry/).

Группировка — по `req.id`. Для каждой группы суммируются длительности всех спанов с заданным именем; отсутствующий спан = 0 мс.

В отличие от сырых `logs10/`, здесь `event.handle.durationMs` нормализован: для каждого спана с признаком retry (`originalDurationMs > 950ms`) вычтено `N × 1000ms`, где `N` — количество ретраев VersionMismatch-логики ([_strip_retries.mjs](_strip_retries.mjs)). Это убирает синтетические 1-секундные `setTimeout`-паузы и оставляет «полезное» время хендлера.

Поля метрик:

- **responseTime** — `http.request.durationMs` из telemetry-спана (не pino `responseTime`).
- **req_start → last event.handle end** — `max(event.handle.startedAt + durationMs) − http.request.startedAt`. Считается только по запросам, у которых есть хотя бы один `event.handle`.
- Все остальные строки = алгебра сумм длительностей спанов: `sum(A) + sum(B) − …`. Отсутствующий спан = 0.

Статистики (population): count, mean, median, p90, p95, variance σ², stdev σ, CV² = σ²/mean². Все длительности в **миллисекундах**.

## m7i-gp3-m_cqrs-seq.log

### GET — 1287 requests

| metric                             | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:-----------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                       |  1287 | 1.2983 | 1.2094 | 1.5659 | 1.9082 |   1.2466 | 1.1165 | 0.7395 |
| query.execute − db.projection.read |  1287 | 0.4159 | 0.3925 | 0.5565 | 0.6185 |   0.0485 | 0.2202 | 0.2803 |
| db.projection.read                 |  1287 | 0.7213 | 0.6534 | 0.8154 | 0.9416 |   0.9828 | 0.9914 | 1.8892 |

### POST — 588 requests

| metric                                                                                          | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:------------------------------------------------------------------------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                                                                                    |   588 | 3.3246 | 3.0423 | 3.8156 | 4.7387 |   2.2461 | 1.4987 | 0.2032 |
| req_start → last event.handle end                                                               |   588 | 5.1229 | 4.8047 | 6.2395 | 7.0759 |   2.9408 | 1.7149 | 0.1121 |
| command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write |   588 | 2.3921 | 2.2632 | 2.6015 | 2.9777 |   0.6056 | 0.7782 | 0.1058 |
| db.eventstore.write                                                                             |   588 | 0.3264 | 0.2888 | 0.3623 | 0.4159 |   0.3329 | 0.5770 | 3.1261 |
| db.snapshot.read + db.snapshot.write                                                            |   588 | 0.5795 | 0.3835 | 0.8507 | 0.9561 |   0.6325 | 0.7953 | 1.8831 |
| event.handle − db.projection.write                                                              |   588 | 0.7711 | 0.6115 | 1.3197 | 1.4690 |   0.2266 | 0.4761 | 0.3812 |
| db.projection.write                                                                             |   588 | 1.5519 | 1.2277 | 3.2913 | 3.4836 |   0.6935 | 0.8328 | 0.2880 |

### PATCH — 2159 requests

| metric                                                                                          | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:------------------------------------------------------------------------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                                                                                    |  2159 | 3.5538 | 3.3350 | 4.2630 | 5.3032 |   2.4120 | 1.5531 | 0.1910 |
| req_start → last event.handle end                                                               |  2060 | 6.4397 | 5.7162 | 8.2222 | 9.2576 |   4.1245 | 2.0309 | 0.0995 |
| command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write |  2159 | 2.3324 | 2.2880 | 2.6578 | 2.9304 |   0.9030 | 0.9503 | 0.1660 |
| db.eventstore.write                                                                             |  2159 | 0.2683 | 0.2322 | 0.3118 | 0.3641 |   0.2566 | 0.5066 | 3.5652 |
| db.snapshot.read + db.snapshot.write                                                            |  2159 | 0.9018 | 0.7665 | 1.0540 | 1.2757 |   0.6169 | 0.7854 | 0.7585 |
| event.handle − db.projection.read − db.projection.write                                         |  2159 | 2.3206 | 2.0438 | 3.8114 | 4.9393 |   1.2601 | 1.1225 | 0.2340 |
| db.projection.read                                                                              |  2159 | 0.4795 | 0.2756 | 0.8188 | 2.0958 |   0.6151 | 0.7843 | 2.6756 |
| db.projection.write                                                                             |  2159 | 0.3139 | 0.2280 | 0.4547 | 0.6799 |   0.3910 | 0.6253 | 3.9692 |

## m7i-io2-m_cqrs-seq.log

### GET — 1287 requests

| metric                             | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:-----------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                       |  1287 | 1.2109 | 1.1140 | 1.5056 | 1.7521 |   0.8695 | 0.9325 | 0.5931 |
| query.execute − db.projection.read |  1287 | 0.3725 | 0.3524 | 0.5259 | 0.6046 |   0.0265 | 0.1627 | 0.1908 |
| db.projection.read                 |  1287 | 0.6827 | 0.6019 | 0.7847 | 0.9433 |   0.5917 | 0.7692 | 1.2693 |

### POST — 588 requests

| metric                                                                                          | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:------------------------------------------------------------------------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                                                                                    |   588 | 2.7698 | 2.5473 | 3.2777 | 4.1164 |   0.9230 | 0.9607 | 0.1203 |
| req_start → last event.handle end                                                               |   588 | 4.1083 | 3.6747 | 4.9731 | 5.9734 |   1.8536 | 1.3615 | 0.1098 |
| command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write |   588 | 1.8969 | 1.7930 | 2.2178 | 2.4533 |   0.2730 | 0.5225 | 0.0759 |
| db.eventstore.write                                                                             |   588 | 0.3204 | 0.2678 | 0.3470 | 0.3840 |   0.3259 | 0.5709 | 3.1743 |
| db.snapshot.read + db.snapshot.write                                                            |   588 | 0.5120 | 0.3686 | 0.7717 | 0.8981 |   0.1263 | 0.3554 | 0.4819 |
| event.handle − db.projection.write                                                              |   588 | 0.7720 | 0.5993 | 1.2971 | 1.4471 |   0.3573 | 0.5977 | 0.5995 |
| db.projection.write                                                                             |   588 | 1.0124 | 0.7671 | 1.9607 | 2.0925 |   0.4720 | 0.6871 | 0.4606 |

### PATCH — 2158 requests

| metric                                                                                          | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:------------------------------------------------------------------------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                                                                                    |  2158 | 3.0753 | 2.8477 | 3.6487 | 4.7652 |   2.6592 | 1.6307 | 0.2812 |
| req_start → last event.handle end                                                               |  2059 | 5.4879 | 5.0640 | 7.0061 | 8.0811 |   4.8077 | 2.1926 | 0.1596 |
| command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write |  2158 | 1.8696 | 1.8044 | 2.1972 | 2.4190 |   0.7653 | 0.8748 | 0.2189 |
| db.eventstore.write                                                                             |  2158 | 0.2840 | 0.2315 | 0.2999 | 0.3489 |   0.6044 | 0.7774 | 7.4931 |
| db.snapshot.read + db.snapshot.write                                                            |  2158 | 0.8576 | 0.7361 | 0.9980 | 1.1437 |   0.7862 | 0.8867 | 1.0690 |
| event.handle − db.projection.read − db.projection.write                                         |  2158 | 1.8704 | 1.6056 | 3.1915 | 3.7822 |   0.9533 | 0.9764 | 0.2725 |
| db.projection.read                                                                              |  2158 | 0.4497 | 0.2786 | 0.8224 | 1.6615 |   0.2920 | 0.5404 | 1.4439 |
| db.projection.write                                                                             |  2158 | 0.3081 | 0.2356 | 0.4648 | 0.6480 |   0.3184 | 0.5643 | 3.3548 |

## m7a-gp3-m_cqrs-seq.log

### GET — 1287 requests

| metric                             | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:-----------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                       |  1287 | 1.0896 | 1.0274 | 1.2883 | 1.5701 |   0.2145 | 0.4631 | 0.1807 |
| query.execute − db.projection.read |  1287 | 0.3381 | 0.3289 | 0.4456 | 0.4884 |   0.0116 | 0.1076 | 0.1013 |
| db.projection.read                 |  1287 | 0.6221 | 0.5629 | 0.7407 | 0.9017 |   0.1637 | 0.4046 | 0.4230 |

### POST — 588 requests

| metric                                                                                          | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:------------------------------------------------------------------------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                                                                                    |   588 | 2.9958 | 2.7876 | 3.4281 | 4.3417 |   0.9392 | 0.9691 | 0.1047 |
| req_start → last event.handle end                                                               |   588 | 4.6220 | 4.5747 | 5.7415 | 6.5020 |   1.7144 | 1.3093 | 0.0803 |
| command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write |   588 | 2.1732 | 2.0873 | 2.3694 | 2.6993 |   0.1719 | 0.4146 | 0.0364 |
| db.eventstore.write                                                                             |   588 | 0.2807 | 0.2648 | 0.3072 | 0.3411 |   0.0648 | 0.2546 | 0.8227 |
| db.snapshot.read + db.snapshot.write                                                            |   588 | 0.5048 | 0.2923 | 0.7266 | 0.8650 |   0.4588 | 0.6774 | 1.8008 |
| event.handle − db.projection.write                                                              |   588 | 0.5928 | 0.4675 | 1.0473 | 1.2037 |   0.1279 | 0.3576 | 0.3639 |
| db.projection.write                                                                             |   588 | 1.5261 | 1.1538 | 3.2294 | 3.4031 |   0.7063 | 0.8404 | 0.3033 |

### PATCH — 2160 requests

| metric                                                                                          | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:------------------------------------------------------------------------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                                                                                    |  2160 | 3.0999 | 2.9555 | 3.6027 | 4.4019 |   1.1787 | 1.0857 | 0.1227 |
| req_start → last event.handle end                                                               |  2061 | 5.5816 | 5.1433 | 7.0010 | 7.8013 |   2.3286 | 1.5260 | 0.0747 |
| command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write |  2160 | 2.0632 | 2.0310 | 2.3318 | 2.5286 |   0.4557 | 0.6750 | 0.1070 |
| db.eventstore.write                                                                             |  2160 | 0.2039 | 0.1887 | 0.2270 | 0.2602 |   0.0299 | 0.1730 | 0.7198 |
| db.snapshot.read + db.snapshot.write                                                            |  2160 | 0.7906 | 0.6859 | 0.8888 | 1.1035 |   0.3078 | 0.5548 | 0.4924 |
| event.handle − db.projection.read − db.projection.write                                         |  2160 | 2.0371 | 1.7650 | 3.5363 | 4.4230 |   1.0566 | 1.0279 | 0.2546 |
| db.projection.read                                                                              |  2160 | 0.3828 | 0.2027 | 0.7190 | 1.8126 |   0.3468 | 0.5889 | 2.3665 |
| db.projection.write                                                                             |  2160 | 0.2221 | 0.1688 | 0.3212 | 0.4723 |   0.1559 | 0.3948 | 3.1606 |

## m7a-io2-m_cqrs-seq.log

### GET — 1287 requests

| metric                             | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:-----------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                       |  1287 | 1.1181 | 1.0301 | 1.2985 | 1.6589 |   0.5310 | 0.7287 | 0.4248 |
| query.execute − db.projection.read |  1287 | 0.3459 | 0.3341 | 0.4444 | 0.4981 |   0.0227 | 0.1507 | 0.1898 |
| db.projection.read                 |  1287 | 0.6454 | 0.5578 | 0.7301 | 1.0109 |   0.4255 | 0.6523 | 1.0214 |

### POST — 588 requests

| metric                                                                                          | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:------------------------------------------------------------------------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                                                                                    |   588 | 2.7205 | 2.5017 | 3.1233 | 3.9356 |   0.9996 | 0.9998 | 0.1351 |
| req_start → last event.handle end                                                               |   588 | 3.9726 | 3.4991 | 5.1174 | 5.7126 |   1.4936 | 1.2221 | 0.0946 |
| command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write |   588 | 1.8949 | 1.7942 | 2.1476 | 2.3989 |   0.2787 | 0.5279 | 0.0776 |
| db.eventstore.write                                                                             |   588 | 0.2783 | 0.2652 | 0.3119 | 0.3572 |   0.0399 | 0.1998 | 0.5152 |
| db.snapshot.read + db.snapshot.write                                                            |   588 | 0.5174 | 0.2837 | 0.7362 | 0.8572 |   0.5411 | 0.7356 | 2.0212 |
| event.handle − db.projection.write                                                              |   588 | 0.5825 | 0.4696 | 1.0321 | 1.1475 |   0.1025 | 0.3202 | 0.3021 |
| db.projection.write                                                                             |   588 | 1.0604 | 0.7889 | 2.1584 | 2.3942 |   0.4446 | 0.6668 | 0.3954 |

### PATCH — 2158 requests

| metric                                                                                          | count |   mean | median |    p90 |    p95 | variance |  stdev |    CV² |
|:------------------------------------------------------------------------------------------------|------:|-------:|-------:|-------:|-------:|---------:|-------:|-------:|
| responseTime                                                                                    |  2158 | 2.8414 | 2.7025 | 3.3004 | 4.2269 |   0.7904 | 0.8890 | 0.0979 |
| req_start → last event.handle end                                                               |  2059 | 4.9070 | 4.7200 | 6.2227 | 7.3181 |   1.7518 | 1.3236 | 0.0728 |
| command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write |  2158 | 1.7783 | 1.7573 | 2.0757 | 2.2091 |   0.2622 | 0.5121 | 0.0829 |
| db.eventstore.write                                                                             |  2158 | 0.2252 | 0.1890 | 0.2275 | 0.2636 |   0.1076 | 0.3280 | 2.1209 |
| db.snapshot.read + db.snapshot.write                                                            |  2158 | 0.7956 | 0.6879 | 0.9149 | 1.2095 |   0.2278 | 0.4773 | 0.3599 |
| event.handle − db.projection.read − db.projection.write                                         |  2158 | 1.6364 | 1.4143 | 2.7848 | 3.5206 |   0.7232 | 0.8504 | 0.2701 |
| db.projection.read                                                                              |  2158 | 0.3531 | 0.2038 | 0.6607 | 1.3994 |   0.2173 | 0.4662 | 1.7435 |
| db.projection.write                                                                             |  2158 | 0.2290 | 0.1722 | 0.3310 | 0.4817 |   0.1529 | 0.3910 | 2.9164 |
