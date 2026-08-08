# DB sizing latency summary

Metrics collected from `output-db-small/` (RDS/db = small) and
`output-db-micro/` (db = micro) JSON summaries. Latency in ms; `err%` is the
bucket error rate. `Run` is the repeat index of a given instance+arch config.

## Costs

On-demand price (USD), eu-central-1 (Frankfurt). Monthly = hourly × 730 h
(AWS standard month).

Compute (EC2):

| Instance  | USD/hour | USD/month |
| --------- | -------: | --------: |
| t2.micro  |   0.0134 |      9.78 |
| t3.micro  |   0.0120 |      8.76 |
| t3a.micro |   0.0108 |      7.88 |
| t4g.micro |   0.0096 |      7.01 |
| t3.nano   |   0.0060 |      4.38 |

Database (RDS PostgreSQL, Single-AZ):

| DB instance  | USD/hour | USD/month |
| ------------ | -------: | --------: |
| db.t4g.micro |   0.0180 |     13.14 |
| db.t4g.small |   0.0360 |     26.28 |

The instance-hour above is the base rate for the whole instance (vCPU + RAM
included) — RDS is priced per instance-hour, not per vCPU. Billed on top and NOT
included here:

- **Storage** (EBS gp3/gp2) — per GB-month, depends on volume size.
- **Backups** — free up to DB size, then per GB-month.
- **Data transfer out** — per GB (EC2↔RDS in the same AZ is free).
- **CPU credits (Unlimited mode)** — t3/t4g default to Unlimited; CPU sustained
  above the ~10% baseline is charged **$0.075 per vCPU-hour**. Under a saturating
  load test this can exceed the base instance cost (e.g. db.t4g.micro at ~100%
  CPU ≈ +$0.135/h, ~7.5× the $0.018 base). The $0.075/vCPU-h figure on the AWS
  page is this burst surcharge, not the base rate.

## DB instance characteristics

| Параметр                            | db.t4g.micro           | db.t4g.small           |
| ----------------------------------- | ---------------------- | ---------------------- |
| Архітектура                         | aarch64 (ARM)          | aarch64 (ARM)          |
| Виробник ЦП                         | AWS Graviton2          | AWS Graviton2          |
| Модель ЦП                           | Neoverse-N1            | Neoverse-N1            |
| Віртуальних ЦП (vCPU)               | 2                      | 2                      |
| Потоків на ядро ≈                   | 1                      | 1                      |
| Ядер на сокет ≈                     | 2                      | 2                      |
| Сокетів ≈                           | 1                      | 1                      |
| BogoMIPS ≈                          | 243,75                 | 243,75                 |
| Кеш L1d / L1i ≈                     | 128 / 128 КіБ (2×64)   | 128 / 128 КіБ (2×64)   |
| Кеш L2 ≈                            | 2 МіБ (2×1)            | 2 МіБ (2×1)            |
| Кеш L3 ≈                            | 32 МіБ                 | 32 МіБ                 |
| Оперативна пам'ять                  | 1 ГБ                   | 2 ГБ                   |
| Пропускна здатність мережі          | до 5 Гбіт/с            | до 5 Гбіт/с            |
| Рушій БД                            | PostgreSQL (Single-AZ) | PostgreSQL (Single-AZ) |
| Ціна «on-demand», USD/год           | 0,0180                 | 0,0360                 |
| Ціна «on-demand», USD/міс (730 год) | 13,14                  | 26,28                  |

> **Примітка.** RDS — керована служба, тож `lscpu`/`dmidecode` на інстансі недоступні.
> Рядки з «≈» (потоки/ядра/сокети, BogoMIPS, кеші) наведено за виміром EC2 `t4g.micro` —
> `db.t4g` працює на тому ж кремнії AWS Graviton2 (Neoverse-N1). vCPU, RAM, мережа та
> ціна — з офіційної специфікації AWS (eu-central-1). Обидва класи мають 2 vCPU;
> відрізняються лише обсягом RAM (1 vs 2 ГБ) і, відповідно, ціною.

## WRITE requests (POST + PATCH)

| DB    | Instance  | Arch           | Run |     n | err% |   mean | median |    p95 |     p99 |
| ----- | --------- | -------------- | --- | ----: | ---: | -----: | -----: | -----: | ------: |
| micro | t3.nano   | classical-cqrs | -   | 32077 | 0.00 |  55.19 |  45.86 |  73.55 |  319.97 |
| micro | t3.nano   | m-cqrs         | -   | 32053 | 0.01 |  62.84 |  48.36 |  97.03 |  426.47 |
| micro | t3a.micro | classical-cqrs | 4   | 31891 | 0.00 |  52.43 |  46.28 |  65.67 |  208.22 |
| micro | t3a.micro | m-cqrs         | 1   | 31772 | 0.08 | 206.89 |  47.38 | 760.30 | 5027.68 |
| micro | t3.micro  | classical-cqrs | 2   | 31889 | 0.01 |  57.97 |  45.86 |  70.63 |  381.51 |
| micro | t3.micro  | m-cqrs         | 1   | 31864 | 0.01 |  62.66 |  47.66 |  73.33 |  413.85 |

| small | t3.nano   | classical-cqrs | 2   | 32184 | 0.05 |  50.80 |  46.38 |  63.91 |  144.75 |
| small | t3.nano   | m-cqrs         | 2   | 32039 | 0.00 |  51.83 |  46.92 |  77.77 |  133.19 |
| small | t3a.micro | classical-cqrs | 1   | 32136 | 0.01 |  48.68 |  46.79 |  61.13 |   92.80 |
| small | t3a.micro | m-cqrs         | 1   | 31745 | 0.00 |  51.00 |  47.81 |  65.52 |  108.03 |
