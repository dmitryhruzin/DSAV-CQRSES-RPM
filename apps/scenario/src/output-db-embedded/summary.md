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

## WRITE

| Instance  | Price | Architecture   | p95 (ms) | p99 (ms) |
| --------- | ----- | -------------- | -------: | -------: |
| t2.micro  |  9.78 | classical-cqrs |    52.82 |    89.01 |
| t2.micro  |  9.78 | m-cqrs         |    57.34 |    89.79 |
| t3.micro  |  8.76 | classical-cqrs |    64.93 |   248.24 |
| t3.micro  |  8.76 | m-cqrs         |    69.56 |   258.30 |
| t3a.micro |  7.88 | classical-cqrs |    53.52 |    68.24 |
| t3a.micro |  7.88 | m-cqrs         |    54.14 |    87.85 |
| t4g.micro |  7.01 | classical-cqrs |    53.20 |    89.85 |
| t4g.micro |  7.01 | m-cqrs         |    58.22 |   180.64 |
| t3.nano   |  4.38 | classical-cqrs |    72.17 |   290.93 |
| t3.nano   |  4.38 | m-cqrs         |    76.60 |   309.56 |

## ALL

| Instance  | Architecture   | p95 (ms) | p99 (ms) |
| --------- | -------------- | -------: | -------: |
| t2.micro  | classical-cqrs |     48.2 |     83.8 |
| t2.micro  | m-cqrs         |     48.8 |     84.2 |
| t3.micro  | classical-cqrs |     48.4 |    129.0 |
| t3.micro  | m-cqrs         |     59.2 |    148.4 |
| t3a.micro | classical-cqrs |     48.3 |     58.9 |
| t3a.micro | m-cqrs         |     48.5 |     57.1 |
| t4g.micro | classical-cqrs |     48.0 |     72.1 |
| t4g.micro | m-cqrs         |     48.6 |    101.1 |
| t3.nano   | classical-cqrs |     53.1 |    240.9 |
| t3.nano   | m-cqrs         |     54.8 |    242.8 |
