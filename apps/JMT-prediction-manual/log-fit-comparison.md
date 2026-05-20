**Итог: MLE выигрывает в 67 из 72 строк (93%).**

# Fit-сравнение: Lognormal moments vs MLE

Сравнение двух способов калибровки Lognormal по seq-сэмплам ([logs10-noretry/](logs10-noretry/), per-request):

- **moments**: `σ² = ln(1 + CV²)`, `μ = ln(mean) − σ²/2` — закрытая форма по первому/второму моментам.
- **MLE**: `μ = mean(ln xᵢ)`, `σ² = mean((ln xᵢ − μ)²)` — максимум правдоподобия (фит нормали к ln-сэмплам).

Качество оценивается по **Kolmogorov-Smirnov distance** между эмпирической CDF и Lognormal-CDF (только по положительным сэмплам). Меньше = лучше. KS < 0.05 — отличный фит, 0.05–0.1 — приемлемый, > 0.1 — плохой.

Жирным выделен победитель по KS. `Δ KS = ks_mle − ks_mom` (отрицательное = MLE лучше).

## m7i-gp3-m_cqrs-seq.log

| method | metric | n | mean | CV² | μ_mom | σ_mom | KS_mom | μ_mle | σ_mle | KS_mle | Δ KS | win |
|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| GET | responseTime | 1287 | 1.298 | 0.74 | -0.016 | 0.744 | 0.357 | 0.177 | 0.331 | **0.124** | -0.233 | MLE |
| GET | query.execute − db.projection.read | 1287 | 0.416 | 0.28 | -1.001 | 0.497 | 0.177 | -0.940 | 0.321 | **0.067** | -0.110 | MLE |
| GET | db.projection.read | 1287 | 0.721 | 1.89 | -0.857 | 1.030 | 0.452 | -0.457 | 0.377 | **0.160** | -0.291 | MLE |
| POST | responseTime | 588 | 3.325 | 0.20 | 1.109 | 0.430 | 0.325 | 1.163 | 0.230 | **0.160** | -0.165 | MLE |
| POST | req_start → last event.handle end | 588 | 5.123 | 0.11 | 1.581 | 0.326 | 0.223 | 1.603 | 0.222 | **0.183** | -0.040 | MLE |
| POST | command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write | 588 | 2.392 | 0.11 | 0.822 | 0.317 | 0.281 | 0.847 | 0.193 | **0.197** | -0.084 | MLE |
| POST | db.eventstore.write | 588 | 0.326 | 3.13 | -1.828 | 1.191 | 0.577 | -1.220 | 0.277 | **0.151** | -0.427 | MLE |
| POST | db.snapshot.read + db.snapshot.write | 588 | 0.580 | 1.88 | -1.075 | 1.029 | 0.424 | -0.730 | 0.488 | **0.195** | -0.228 | MLE |
| POST | event.handle − db.projection.write | 588 | 0.771 | 0.38 | -0.421 | 0.568 | 0.269 | -0.351 | 0.375 | **0.230** | -0.039 | MLE |
| POST | db.projection.write | 588 | 1.552 | 0.29 | 0.313 | 0.503 | **0.283** | 0.339 | 0.409 | 0.309 | +0.026 | MOM |
| PATCH | responseTime | 2159 | 3.554 | 0.19 | 1.181 | 0.418 | 0.325 | 1.211 | 0.340 | **0.271** | -0.054 | MLE |
| PATCH | req_start → last event.handle end | 2060 | 6.440 | 0.10 | 1.815 | 0.308 | 0.266 | 1.834 | 0.215 | **0.165** | -0.100 | MLE |
| PATCH | command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write | 2159 | 2.332 | 0.17 | 0.770 | 0.392 | 0.350 | 0.779 | 0.423 | **0.347** | -0.003 | MLE |
| PATCH | db.eventstore.write | 2159 | 0.268 | 3.57 | -2.075 | 1.232 | 0.623 | -1.379 | 0.292 | **0.191** | -0.432 | MLE |
| PATCH | db.snapshot.read + db.snapshot.write | 2159 | 0.902 | 0.76 | -0.386 | 0.751 | 0.387 | -0.196 | 0.340 | **0.170** | -0.217 | MLE |
| PATCH | event.handle − db.projection.read − db.projection.write | 2159 | 2.321 | 0.23 | 0.737 | 0.459 | 0.336 | 0.833 | 0.299 | **0.243** | -0.093 | MLE |
| PATCH | db.projection.read | 2159 | 0.479 | 2.68 | -1.386 | 1.141 | 0.455 | -1.011 | 0.629 | **0.249** | -0.206 | MLE |
| PATCH | db.projection.write | 2159 | 0.314 | 3.97 | -1.960 | 1.266 | 0.591 | -1.307 | 0.449 | **0.216** | -0.375 | MLE |

## m7i-io2-m_cqrs-seq.log

| method | metric | n | mean | CV² | μ_mom | σ_mom | KS_mom | μ_mle | σ_mle | KS_mle | Δ KS | win |
|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| GET | responseTime | 1287 | 1.211 | 0.59 | -0.042 | 0.682 | 0.278 | 0.102 | 0.351 | **0.121** | -0.157 | MLE |
| GET | query.execute − db.projection.read | 1287 | 0.372 | 0.19 | -1.075 | 0.418 | 0.071 | -1.051 | 0.344 | **0.046** | -0.025 | MLE |
| GET | db.projection.read | 1287 | 0.683 | 1.27 | -0.791 | 0.905 | 0.350 | -0.518 | 0.406 | **0.157** | -0.193 | MLE |
| POST | responseTime | 588 | 2.770 | 0.12 | 0.962 | 0.337 | 0.209 | 0.985 | 0.233 | **0.135** | -0.074 | MLE |
| POST | req_start → last event.handle end | 588 | 4.108 | 0.11 | 1.361 | 0.323 | 0.236 | 1.380 | 0.236 | **0.181** | -0.055 | MLE |
| POST | command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write | 588 | 1.897 | 0.08 | 0.604 | 0.270 | 0.199 | 0.618 | 0.191 | **0.158** | -0.040 | MLE |
| POST | db.eventstore.write | 588 | 0.320 | 3.17 | -1.853 | 1.195 | 0.564 | -1.281 | 0.333 | **0.188** | -0.375 | MLE |
| POST | db.snapshot.read + db.snapshot.write | 588 | 0.512 | 0.48 | -0.866 | 0.627 | 0.246 | -0.788 | 0.434 | **0.207** | -0.038 | MLE |
| POST | event.handle − db.projection.write | 588 | 0.772 | 0.60 | -0.494 | 0.685 | 0.328 | -0.362 | 0.385 | **0.215** | -0.113 | MLE |
| POST | db.projection.write | 588 | 1.012 | 0.46 | -0.177 | 0.615 | 0.340 | -0.097 | 0.405 | **0.319** | -0.021 | MLE |
| PATCH | responseTime | 2158 | 3.075 | 0.28 | 0.999 | 0.498 | 0.325 | 1.055 | 0.352 | **0.226** | -0.099 | MLE |
| PATCH | req_start → last event.handle end | 2059 | 5.488 | 0.16 | 1.628 | 0.385 | 0.217 | 1.661 | 0.257 | **0.131** | -0.086 | MLE |
| PATCH | command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write | 2158 | 1.870 | 0.22 | 0.527 | 0.445 | 0.342 | 0.556 | 0.412 | **0.308** | -0.035 | MLE |
| PATCH | db.eventstore.write | 2158 | 0.284 | 7.49 | -2.328 | 1.463 | 0.663 | -1.398 | 0.339 | **0.217** | -0.446 | MLE |
| PATCH | db.snapshot.read + db.snapshot.write | 2158 | 0.858 | 1.07 | -0.517 | 0.853 | 0.423 | -0.261 | 0.358 | **0.176** | -0.247 | MLE |
| PATCH | event.handle − db.projection.read − db.projection.write | 2158 | 1.870 | 0.27 | 0.506 | 0.491 | 0.334 | 0.610 | 0.319 | **0.196** | -0.138 | MLE |
| PATCH | db.projection.read | 2158 | 0.450 | 1.44 | -1.246 | 0.945 | 0.394 | -1.008 | 0.584 | **0.240** | -0.154 | MLE |
| PATCH | db.projection.write | 2158 | 0.308 | 3.35 | -1.913 | 1.213 | 0.590 | -1.294 | 0.413 | **0.224** | -0.366 | MLE |

## m7a-gp3-m_cqrs-seq.log

| method | metric | n | mean | CV² | μ_mom | σ_mom | KS_mom | μ_mle | σ_mle | KS_mle | Δ KS | win |
|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| GET | responseTime | 1287 | 1.090 | 0.18 | 0.003 | 0.408 | 0.187 | 0.036 | 0.281 | **0.139** | -0.048 | MLE |
| GET | query.execute − db.projection.read | 1287 | 0.338 | 0.10 | -1.133 | 0.311 | 0.075 | -1.119 | 0.254 | **0.030** | -0.045 | MLE |
| GET | db.projection.read | 1287 | 0.622 | 0.42 | -0.651 | 0.594 | 0.306 | -0.563 | 0.350 | **0.154** | -0.152 | MLE |
| POST | responseTime | 588 | 2.996 | 0.10 | 1.047 | 0.315 | 0.272 | 1.071 | 0.201 | **0.179** | -0.092 | MLE |
| POST | req_start → last event.handle end | 588 | 4.622 | 0.08 | 1.492 | 0.278 | 0.166 | 1.504 | 0.218 | **0.144** | -0.021 | MLE |
| POST | command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write | 588 | 2.173 | 0.04 | 0.758 | 0.189 | 0.203 | 0.764 | 0.145 | **0.183** | -0.019 | MLE |
| POST | db.eventstore.write | 588 | 0.281 | 0.82 | -1.571 | 0.775 | 0.405 | -1.351 | 0.298 | **0.192** | -0.214 | MLE |
| POST | db.snapshot.read + db.snapshot.write | 588 | 0.505 | 1.80 | -1.199 | 1.015 | 0.384 | -0.914 | 0.567 | **0.241** | -0.143 | MLE |
| POST | event.handle − db.projection.write | 588 | 0.593 | 0.36 | -0.678 | 0.557 | 0.250 | -0.618 | 0.387 | **0.243** | -0.007 | MLE |
| POST | db.projection.write | 588 | 1.526 | 0.30 | 0.290 | 0.515 | **0.323** | 0.320 | 0.407 | 0.364 | +0.042 | MOM |
| PATCH | responseTime | 2160 | 3.100 | 0.12 | 1.074 | 0.340 | 0.338 | 1.085 | 0.315 | **0.316** | -0.022 | MLE |
| PATCH | req_start → last event.handle end | 2061 | 5.582 | 0.07 | 1.683 | 0.268 | 0.218 | 1.695 | 0.207 | **0.170** | -0.048 | MLE |
| PATCH | command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write | 2160 | 2.063 | 0.11 | 0.673 | 0.319 | **0.342** | 0.662 | 0.415 | 0.373 | +0.030 | MOM |
| PATCH | db.eventstore.write | 2160 | 0.204 | 0.72 | -1.861 | 0.736 | 0.522 | -1.610 | 0.261 | **0.247** | -0.275 | MLE |
| PATCH | db.snapshot.read + db.snapshot.write | 2160 | 0.791 | 0.49 | -0.435 | 0.633 | 0.408 | -0.309 | 0.309 | **0.230** | -0.178 | MLE |
| PATCH | event.handle − db.projection.read − db.projection.write | 2160 | 2.037 | 0.25 | 0.598 | 0.476 | 0.355 | 0.697 | 0.313 | **0.247** | -0.108 | MLE |
| PATCH | db.projection.read | 2160 | 0.383 | 2.37 | -1.567 | 1.102 | 0.398 | -1.290 | 0.687 | **0.278** | -0.120 | MLE |
| PATCH | db.projection.write | 2160 | 0.222 | 3.16 | -2.218 | 1.194 | 0.574 | -1.639 | 0.424 | **0.235** | -0.339 | MLE |

## m7a-io2-m_cqrs-seq.log

| method | metric | n | mean | CV² | μ_mom | σ_mom | KS_mom | μ_mle | σ_mle | KS_mle | Δ KS | win |
|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| GET | responseTime | 1287 | 1.118 | 0.42 | -0.065 | 0.595 | 0.314 | 0.047 | 0.295 | **0.166** | -0.148 | MLE |
| GET | query.execute − db.projection.read | 1287 | 0.346 | 0.19 | -1.148 | 0.417 | 0.171 | -1.103 | 0.264 | **0.037** | -0.134 | MLE |
| GET | db.projection.read | 1287 | 0.645 | 1.02 | -0.790 | 0.839 | 0.422 | -0.552 | 0.368 | **0.185** | -0.237 | MLE |
| POST | responseTime | 588 | 2.721 | 0.14 | 0.937 | 0.356 | 0.278 | 0.968 | 0.221 | **0.166** | -0.112 | MLE |
| POST | req_start → last event.handle end | 588 | 3.973 | 0.09 | 1.334 | 0.301 | 0.217 | 1.347 | 0.237 | **0.175** | -0.041 | MLE |
| POST | command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write | 588 | 1.895 | 0.08 | 0.602 | 0.273 | 0.251 | 0.619 | 0.175 | **0.170** | -0.081 | MLE |
| POST | db.eventstore.write | 588 | 0.278 | 0.52 | -1.487 | 0.645 | 0.351 | -1.345 | 0.282 | **0.170** | -0.181 | MLE |
| POST | db.snapshot.read + db.snapshot.write | 588 | 0.517 | 2.02 | -1.212 | 1.051 | 0.394 | -0.918 | 0.592 | **0.241** | -0.153 | MLE |
| POST | event.handle − db.projection.write | 588 | 0.583 | 0.30 | -0.672 | 0.514 | **0.219** | -0.626 | 0.372 | 0.232 | +0.013 | MOM |
| POST | db.projection.write | 588 | 1.060 | 0.40 | -0.108 | 0.577 | 0.244 | -0.065 | 0.446 | **0.233** | -0.011 | MLE |
| PATCH | responseTime | 2158 | 2.841 | 0.10 | 0.998 | 0.306 | 0.282 | 1.002 | 0.302 | **0.276** | -0.006 | MLE |
| PATCH | req_start → last event.handle end | 2059 | 4.907 | 0.07 | 1.556 | 0.265 | 0.122 | 1.563 | 0.224 | **0.109** | -0.013 | MLE |
| PATCH | command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write | 2158 | 1.778 | 0.08 | 0.536 | 0.282 | **0.283** | 0.521 | 0.387 | 0.335 | +0.052 | MOM |
| PATCH | db.eventstore.write | 2158 | 0.225 | 2.12 | -2.060 | 1.067 | 0.590 | -1.589 | 0.345 | **0.290** | -0.300 | MLE |
| PATCH | db.snapshot.read + db.snapshot.write | 2158 | 0.796 | 0.36 | -0.382 | 0.554 | 0.373 | -0.301 | 0.316 | **0.239** | -0.134 | MLE |
| PATCH | event.handle − db.projection.read − db.projection.write | 2158 | 1.636 | 0.27 | 0.373 | 0.489 | 0.314 | 0.473 | 0.328 | **0.189** | -0.124 | MLE |
| PATCH | db.projection.read | 2158 | 0.353 | 1.74 | -1.546 | 1.005 | 0.381 | -1.305 | 0.640 | **0.267** | -0.114 | MLE |
| PATCH | db.projection.write | 2158 | 0.229 | 2.92 | -2.157 | 1.168 | 0.552 | -1.621 | 0.439 | **0.256** | -0.296 | MLE |
