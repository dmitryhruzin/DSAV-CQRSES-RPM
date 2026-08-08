# Latency summary — p95 / p99 (ms)

Load mode, ~46 req/s (2500 reads + 247 writes per min), 300s per run
(t4g runs are shorter). Source: `*-classical-cqrs.json` / `*-m-cqrs.json`.

## Costs

On-demand price (USD). Monthly = hourly × 730 h (AWS standard month).

| Instance  | USD/hour | USD/month |
| --------- | -------: | --------: |
| t2.micro  |   0.0134 |      9.78 |
| t3.micro  |   0.0120 |      8.76 |
| t3a.micro |   0.0108 |      7.88 |
| t4g.micro |   0.0096 |      7.01 |
| t3.nano   |   0.0060 |      4.38 |

## POST

| Instance  | Architecture   | p95 (ms) | p99 (ms) |     n |
| --------- | -------------- | -------: | -------: | ----: |
| t2.micro  | classical-cqrs |     83.5 |    148.4 |   107 |
| t2.micro  | m-cqrs         |     89.8 |    155.9 |   116 |
| t3.micro  | classical-cqrs |     80.7 |    180.6 |   141 |
| t3.micro  | m-cqrs         |     96.9 |    367.7 |   143 |
| t3a.micro | classical-cqrs |     83.8 |    131.0 |   120 |
| t3a.micro | m-cqrs         |     86.0 |    146.8 |   123 |
| t4g.micro | classical-cqrs |     82.2 |    122.1 |    31 |
| t4g.micro | m-cqrs         |     90.7 |    310.1 |    22 |
| t3a.nano  | classical-cqrs |    106.2 |    358.9 |   110 |
| t3a.nano  | m-cqrs         |    110.6 |    377.6 |   119 |

## PATCH

| Instance  | Architecture   | p95 (ms) | p99 (ms) |     n |
| --------- | -------------- | -------: | -------: | ----: |
| t2.micro  | classical-cqrs |     86.8 |    157.0 |  1169 |
| t2.micro  | m-cqrs         |     91.3 |    157.8 |  1052 |
| t3.micro  | classical-cqrs |     98.9 |    316.2 |  1098 |
| t3.micro  | m-cqrs         |    103.6 |    326.3 |  1072 |
| t3a.micro | classical-cqrs |     87.5 |    136.2 |  1092 |
| t3a.micro | m-cqrs         |     88.1 |    155.9 |  1131 |
| t4g.micro | classical-cqrs |     87.2 |    157.8 |   209 |
| t4g.micro | m-cqrs         |     92.2 |    248.6 |   219 |
| t3a.nano  | classical-cqrs |     99.1 |    358.3 |  1124 |
| t3a.nano  | m-cqrs         |    105.0 |    370.2 |  1121 |

## ALL

| Instance  | Architecture   | p95 (ms) | p99 (ms) |     n |
| --------- | -------------- | -------: | -------: | ----: |
| t2.micro  | classical-cqrs |     82.2 |    151.8 | 13468 |
| t2.micro  | m-cqrs         |     82.8 |    152.2 | 13271 |
| t3.micro  | classical-cqrs |     82.4 |    197.0 | 13397 |
| t3.micro  | m-cqrs         |     93.2 |    216.4 | 13315 |
| t3a.micro | classical-cqrs |     82.3 |    126.9 | 13396 |
| t3a.micro | m-cqrs         |     82.5 |    125.1 | 13485 |
| t4g.micro | classical-cqrs |     82.0 |    140.1 |  2766 |
| t4g.micro | m-cqrs         |     82.6 |    169.1 |  2742 |
| t3a.nano  | classical-cqrs |     87.1 |    308.9 | 13611 |
| t3a.nano  | m-cqrs         |     88.8 |    310.8 | 13342 |
