# JMT simulation results

Load: 100 GET/s, 100 POST/s, 150 PATCH/s (ReachConsistency = 250 events/s).

## Overview — bottleneck at the AppService (Сервер)

Server util ≈ 1.0 means the AppService can't keep up with the offered load and queue backs up.
System throughput is the total per-class throughput observed at the sink.

Calibration: AppService demand = Sequential-mode median(`command.execute`/`query.execute`) 
− Sequential-mode median DB-span times. Sequential mode runs one request at a time, so the 
measured numbers are close to pure service time without queue delays — the right input for 
a queueing model. (Load-mode benchmarks already include queue delays and badly distort the 
calibration on weaker instances; M7g.large in particular reads as ~2.5 s `command.execute` 
under Load, which would force the model into permanent saturation.)

| Model | Сервер util | Server throughput (jobs/s) | Σ system throughput (jobs/s) | Status |
|---|---|---|---|---|
| M7a_gp3_Classical_CQRS | 0.5695 | 598.80 | 601.22 | OK |
| M7a_gp3_mCQRS | 0.9488 | 601.45 | 600.81 | OK |
| M7a_io2_Classical_CQRS | 0.5181 | 592.16 | 599.65 | OK |
| M7a_io2_mCQRS | 0.8028 | 603.08 | 597.12 | OK |
| M7g_gp3_Classical_CQRS | 0.7273 | 608.99 | 603.33 | OK |
| M7g_gp3_mCQRS | 1.0000 | 513.61 | 510.98 | saturated |
| M7g_io2_Classical_CQRS | 0.6216 | 606.38 | 600.44 | OK |
| M7g_io2_mCQRS | 0.8865 | 600.92 | 598.65 | OK |
| M7i_gp3_Classical_CQRS | 0.6535 | 607.60 | 604.37 | OK |
| M7i_gp3_mCQRS | 1.0000 | 588.57 | 591.73 | saturated |
| M7i_io2_Classical_CQRS | 0.6195 | 604.20 | 607.25 | OK |
| M7i_io2_mCQRS | 0.8513 | 602.95 | 592.02 | OK |

## M7a_gp3_Classical_CQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1124 | 81920 |
| База даних проєкцій | 0.1917 | 40960 |
| Сервер | 0.5695 | 35840 |
| Сховище подій | 0.3556 | 81920 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 250.1107 | 13440 |
| База даних проєкцій | 350.6898 | 10240 |
| Сервер | 598.8036 | 10240 |
| Сховище подій | 248.5213 | 15360 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 100.9328 | 8960 |
| Команди оновлення | 149.5562 | 10240 |
| Команди створення | 100.5843 | 10240 |
| Процеси досягнення узгодженості | 250.1466 | 15360 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 0.002869 | 40960 |
| Команди оновлення | 0.005438 | 61440 |
| Команди створення | 0.004809 | 51200 |
| Процеси досягнення узгодженості | 0.004062  ⚠️ not converged | 100000 |

## M7a_gp3_mCQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1417 | 61440 |
| База даних проєкцій | 0.1942 | 40960 |
| Сервер | 0.9488 | 21760 |
| Сховище подій | 0.0553 | 81920 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 252.3100 | 10240 |
| База даних проєкцій | 347.8735 | 14080 |
| Сервер | 601.4477 | 8960 |
| Сховище подій | 252.3092 | 10240 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 99.4295 | 15360 |
| Команди оновлення | 149.2691 | 15360 |
| Команди створення | 100.9767 | 14080 |
| Процеси досягнення узгодженості | 251.1357 | 10240 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 0.027954  ⚠️ not converged | 100000 |
| Команди оновлення | 0.031372  ⚠️ not converged | 100000 |
| Команди створення | 0.029429  ⚠️ not converged | 100000 |
| Процеси досягнення узгодженості | 0.028424  ⚠️ not converged | 100000 |

## M7a_io2_Classical_CQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1047  ⚠️ not converged | 100000 |
| База даних проєкцій | 0.1755 | 40960 |
| Сервер | 0.5181 | 46080 |
| Сховище подій | 0.2952 | 35840 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 250.1813 | 10240 |
| База даних проєкцій | 342.4662 | 10240 |
| Сервер | 592.1622 | 17920 |
| Сховище подій | 250.1813 | 10240 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 100.6567 | 24320 |
| Команди оновлення | 151.2447 | 10240 |
| Команди створення | 102.0459 | 12800 |
| Процеси досягнення узгодженості | 245.7036 | 15360 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 0.002256 | 33280 |
| Команди оновлення | 0.004232 | 40960 |
| Команди створення | 0.003583 | 46080 |
| Процеси досягнення узгодженості | 0.003090  ⚠️ not converged | 100000 |

## M7a_io2_mCQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1434 | 81920 |
| База даних проєкцій | 0.1730 | 81920 |
| Сервер | 0.8028 | 40960 |
| Сховище подій | 0.0549 | 40960 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 248.2629 | 15360 |
| База даних проєкцій | 351.4752 | 8320 |
| Сервер | 603.0776 | 10240 |
| Сховище подій | 245.8067 | 10240 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 98.5055 | 10240 |
| Команди оновлення | 149.9668 | 20480 |
| Команди створення | 99.7249 | 10240 |
| Процеси досягнення узгодженості | 248.9236 | 10240 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 0.007550  ⚠️ not converged | 100000 |
| Команди оновлення | 0.009146  ⚠️ not converged | 100000 |
| Команди створення | 0.008826  ⚠️ not converged | 100000 |
| Процеси досягнення узгодженості | 0.008357  ⚠️ not converged | 100000 |

## M7g_gp3_Classical_CQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1294  ⚠️ not converged | 100000 |
| База даних проєкцій | 0.2742 | 61440 |
| Сервер | 0.7273 | 51200 |
| Сховище подій | 0.4187 | 61440 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 252.8814 | 23040 |
| База даних проєкцій | 353.8923 | 20480 |
| Сервер | 608.9901 | 12800 |
| Сховище подій | 253.1994 | 11520 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 99.8050 | 15360 |
| Команди оновлення | 153.2771 | 10240 |
| Команди створення | 99.5677 | 17920 |
| Процеси досягнення узгодженості | 250.6785 | 26880 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 0.005773  ⚠️ not converged | 100000 |
| Команди оновлення | 0.009050  ⚠️ not converged | 100000 |
| Команди створення | 0.007955  ⚠️ not converged | 100000 |
| Процеси досягнення узгодженості | 0.007322  ⚠️ not converged | 100000 |

## M7g_gp3_mCQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1619 | 40960 |
| База даних проєкцій | 0.2331 | 61440 |
| Сервер | 1.0000 | 12800 |
| Сховище подій | 0.0664 | 61440 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 213.9795 | 15360 |
| База даних проєкцій | 297.4296 | 8960 |
| Сервер | 513.6073 | 23040 |
| Сховище подій | 214.1523 | 15360 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 85.1537 | 15360 |
| Команди оновлення | 128.8562 | 15360 |
| Команди створення | 84.8594 | 10240 |
| Процеси досягнення узгодженості | 212.1146 | 10240 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 149.774395  ⚠️ not converged | 100000 |
| Команди оновлення | 98.385434  ⚠️ not converged | 100000 |
| Команди створення | 150.444974  ⚠️ not converged | 100000 |
| Процеси досягнення узгодженості | 59.796912  ⚠️ not converged | 100000 |

## M7g_io2_Classical_CQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1087 | 81920 |
| База даних проєкцій | 0.2223 | 51200 |
| Сервер | 0.6216 | 46080 |
| Сховище подій | 0.2663 | 40960 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 249.0645 | 10240 |
| База даних проєкцій | 351.7176 | 15360 |
| Сервер | 606.3792 | 8960 |
| Сховище подій | 249.1568 | 10240 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 102.0901 | 8960 |
| Команди оновлення | 150.5441 | 8320 |
| Команди створення | 99.0286 | 10240 |
| Процеси досягнення узгодженості | 248.7743 | 20480 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 0.003541 | 61440 |
| Команди оновлення | 0.005346 | 61440 |
| Команди створення | 0.004278 | 51200 |
| Процеси досягнення узгодженості | 0.004441  ⚠️ not converged | 100000 |

## M7g_io2_mCQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1758 | 56320 |
| База даних проєкцій | 0.2288 | 40960 |
| Сервер | 0.8865 | 20480 |
| Сховище подій | 0.0752 | 71680 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 252.2260 | 10240 |
| База даних проєкцій | 350.0238 | 15360 |
| Сервер | 600.9183 | 15360 |
| Сховище подій | 252.2701 | 10240 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 99.8047 | 10240 |
| Команди оновлення | 148.2981 | 10240 |
| Команди створення | 99.5385 | 15360 |
| Процеси досягнення узгодженості | 251.0094 | 14080 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 0.012346  ⚠️ not converged | 100000 |
| Команди оновлення | 0.014455  ⚠️ not converged | 100000 |
| Команди створення | 0.013748  ⚠️ not converged | 100000 |
| Процеси досягнення узгодженості | 0.013369  ⚠️ not converged | 100000 |

## M7i_gp3_Classical_CQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1175 | 81920 |
| База даних проєкцій | 0.2340  ⚠️ not converged | 100000 |
| Сервер | 0.6535 | 92160 |
| Сховище подій | 0.3896 | 61440 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 247.6540 | 10240 |
| База даних проєкцій | 354.0599 | 25600 |
| Сервер | 607.6014 | 10240 |
| Сховище подій | 247.7472 | 10240 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 99.2021 | 25600 |
| Команди оновлення | 152.0959 | 10240 |
| Команди створення | 99.8858 | 17920 |
| Процеси досягнення узгодженості | 253.1854 | 15360 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 0.003987  ⚠️ not converged | 100000 |
| Команди оновлення | 0.006929 | 81920 |
| Команди створення | 0.006005 | 51200 |
| Процеси досягнення узгодженості | 0.005210 | 97280 |

## M7i_gp3_mCQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1591 | 12800 |
| База даних проєкцій | 0.2294  ⚠️ not converged | 100000 |
| Сервер | 1.0000 | 12800 |
| Сховище подій | 0.0625 | 81920 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 244.1538 | 15360 |
| База даних проєкцій | 352.1883 | 8960 |
| Сервер | 588.5716 | 10240 |
| Сховище подій | 244.1506 | 15360 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 99.1410 | 10240 |
| Команди оновлення | 147.2792 | 15360 |
| Команди створення | 97.5220 | 12800 |
| Процеси досягнення узгодженості | 247.7913 | 12800 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 14.803211  ⚠️ not converged | 100000 |
| Команди оновлення | 10.156964  ⚠️ not converged | 100000 |
| Команди створення | 14.792914  ⚠️ not converged | 100000 |
| Процеси досягнення узгодженості | 6.084482  ⚠️ not converged | 100000 |

## M7i_io2_Classical_CQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1005 | 81920 |
| База даних проєкцій | 0.2107 | 61440 |
| Сервер | 0.6195 | 71680 |
| Сховище подій | 0.2828 | 40960 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 251.8037 | 17920 |
| База даних проєкцій | 357.9065 | 10240 |
| Сервер | 604.1993 | 15360 |
| Сховище подій | 251.8088 | 17920 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 99.7007 | 15360 |
| Команди оновлення | 151.8312 | 10240 |
| Команди створення | 101.3276 | 8960 |
| Процеси досягнення узгодженості | 254.3874 | 10240 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 0.003371 | 92160 |
| Команди оновлення | 0.005352 | 35840 |
| Команди створення | 0.004401 | 46080 |
| Процеси досягнення узгодженості | 0.004401 | 81920 |

## M7i_io2_mCQRS

### Utilization

| Station | Utilization | samples |
|---|---|---|
| База даних знімків | 0.1543 | 81920 |
| База даних проєкцій | 0.2052 | 81920 |
| Сервер | 0.8513 | 56320 |
| Сховище подій | 0.0619 | 81920 |

### Throughput per station (jobs/s)

| Station | Throughput | samples |
|---|---|---|
| База даних знімків | 248.6493 | 15360 |
| База даних проєкцій | 349.0016 | 11520 |
| Сервер | 602.9469 | 15360 |
| Сховище подій | 248.6106 | 15360 |

### System throughput per class (jobs/s, measured at sink)

| Class | Throughput | samples |
|---|---|---|
| Запити | 98.5929 | 20480 |
| Команди оновлення | 143.0524 | 1920 |
| Команди створення | 100.5017 | 14080 |
| Процеси досягнення узгодженості | 249.8725 | 15360 |

### Response time per class (s, source→sink)

| Class | Response time | samples |
|---|---|---|
| Запити | 0.009865  ⚠️ not converged | 100000 |
| Команди оновлення | 0.011329  ⚠️ not converged | 100000 |
| Команди створення | 0.010976  ⚠️ not converged | 100000 |
| Процеси досягнення узгодженості | 0.010753  ⚠️ not converged | 100000 |
