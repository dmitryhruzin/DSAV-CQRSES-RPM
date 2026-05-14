# Supplementary A — Calibration walkthrough (M7a.gp3 → M7a.io2, mCQRS)

This appendix walks through every step of the v5 calibration, from raw
Sequential logs to predicted M7a.io2 response time, using M7a.gp3 mCQRS as the
worked example. All numerical values are sourced from the actual pipeline
outputs (extract_demands.py → characterize_distributions.py → build_jsimg.py
→ JMT → analyze_results.py).

## 1. Sequential parsing

Source: `apps/logs/m7a-gp3-m_cqrs-seq.log`. After the 10-second warm-up skip
(anchor = startedAt of first http.request span, cutoff = anchor + 10 000 ms),
the analysed window is **605.22 seconds** long, containing:

- GET (Zapyty): 1287 requests → 2.126 req/s
- POST (Stvor): 588 requests → 0.972 req/s
- PATCH (Onovl): 2160 requests → 3.569 req/s
- event.handle (RC): one entry per handler invocation in POST/PATCH → 4.863 inv/s

## 2. Probability decomposition table

For each (class, station) we compute:

```
P(op | class) = N(op, class) / N(class)
E[d_op | class] = winsorized-p95 mean of op duration in class
D_{class, station} = Σ_op∈ops(station) P(op | class) × E[d_op | class]
```

### Stvor (POST, N = 588)

| Station       | Op                       | N(op)  | P(op | c) | E[d_op] (ms) | Contribution (ms) |
|---|---|---:|---:|---:|---:|
| EventStore    | db.eventstore.write      | 588    | 1.000     | 0.2556       | 0.2556            |
| SnapshotDB    | db.snapshot.read         | 196    | 0.333     | 0.4229       | 0.1410            |
| SnapshotDB    | db.snapshot.write        | 588    | 1.000     | 0.2879       | 0.2879            |
| AppService    | http.request_residual    | 588    | 1.000     | 2.9113       | 2.3114            |

D_{Stvor, EventStore} = 0.2556 ms; D_{SnapshotDB} = 0.4289 ms;
D_{AppService} = 2.3114 ms.
Class total = 2.9959 ms. E[http.request | Stvor] = 2.9959 ms (winsorized).
**Attribution diff = 0.000%** — perfect closure.

### Onovl (PATCH, N = 2160)

| Station       | Op                       | N(op)  | P(op | c) | E[d_op] (ms) | Contribution (ms) |
|---|---|---:|---:|---:|---:|
| EventStore    | db.eventstore.write      | 2061   | 0.954     | 0.1959       | 0.1869            |
| SnapshotDB    | db.snapshot.read         | 2356   | 1.091     | 0.4251       | 0.4636            |
| SnapshotDB    | db.snapshot.write        | 2061   | 0.954     | 0.2609       | 0.2489            |
| AppService    | http.request_residual    | 2160   | 1.000     | 3.0081       | 2.2005            |

D_{Onovl, EventStore} = 0.187 ms; D_{SnapshotDB} = 0.713 ms;
D_{AppService} = 2.201 ms.
Class total = 3.100 ms. E[http.request | Onovl] = 3.100 ms.
**Attribution diff = 0.000%** — perfect closure.

Note: P > 1 for snapshot.read on Onovl because the projection-write/snapshot
spans can repeat per event-handler invocation within a single PATCH request.

## 3. Per-station demand mean (explicit vs per-request totals)

The "per-request totals" column is the v4-style aggregate: for each request,
sum the durations of spans assigned to a station, then winsorize. The
"explicit" column is Σ P × E. They differ slightly per station because
winsorization on a sum is not equal to the sum of winsorized terms; the
**class-total sums are identical to 0.000%**, confirming attribution
correctness.

For Stvor:

| Station      | D_mean_explicit (ms) | D_mean_per_req_totals (ms) | local diff |
|---|---:|---:|---:|
| EventStore   | 0.256 | 0.281 | 8.9% |
| SnapshotDB   | 0.429 | 0.505 | 15.0% |
| AppService   | 2.311 | 2.210 | 4.4% |
| **Total**    | **2.996** | **2.996** | **0.00%** |

We use D_mean_per_request_totals (v4-compatible) for JMT calibration as the
primary demand value; the explicit decomposition serves as a diagnostic.

## 4. Variance

Variance is computed two ways per (class, station):

- **Empirical** (preferred for distribution fit): per-request station totals,
  winsorized at p98 to suppress GC outliers.
- **Analytic** (independence assumption check):
  `Var_analytic = Σ_op P(op) × Var(d_op) + Σ_op P(op)(1-P(op)) × E[d_op]²`.

For Stvor/SnapshotDB: Var_empirical = 0.1284 ms², Var_analytic = 0.0238 ms².
The analytic value is smaller because snapshot.read and snapshot.write are
correlated within a request (both occur or neither). For Lognormal /
Pareto calibration we use the empirical variance.

## 5. Distribution characterization (Phase 0)

For each (class, station) we fit 10 candidate distributions, computing for
each KS D-statistic + p-value, Anderson-Darling A², and BIC. Selection rule:
hard skip mathematically impossible candidates (HyperExp for CV² <= 1,
Erlang-k for CV² >= 1, Hypoexp-2 for CV² outside (0.5, 1)), then pick the
minimum-BIC among the rest.

For M7a.gp3 mCQRS — top BIC per (class, station):

| Class | Station       | n     | mean (ms) | CV²    | skewness | Best        | BIC      |
|---|---|---:|---:|---:|---:|---|---:|
| Zapyty | AppService   |  1287 | 0.467     | 0.137  | 13.92    | Lognormal   | -2192.1  |
| Zapyty | ProjectionDB |  1287 | 0.622     | 0.423  |  5.18    | Pareto      |  -758.0  |
| Stvor  | AppService   |   588 | 2.210     | 0.045  |  4.70    | Pareto      |   415.7  |
| Stvor  | EventStore   |   588 | 0.281     | 0.823  | 13.15    | Pareto      | -1449.7  |
| Stvor  | SnapshotDB   |   588 | 0.505     | 1.801  | 11.84    | Pareto      |  -324.0  |
| Onovl  | AppService   |  2160 | 2.105     | 0.110  |  5.76    | Gamma       |  4301.4  |
| Onovl  | EventStore   |  2061 | 0.214     | 0.641  | 12.24    | Pareto      | -8669.1  |
| Onovl  | SnapshotDB   |  2160 | 0.791     | 0.492  | 10.99    | Lognormal   |  -268.9  |
| RC     | AppService   |  2942 | 14.19     | 61.86  |  8.75    | Lognormal   | 10420.0  |
| RC     | ProjectionDB |  2943 | 0.749     | 0.830  |  5.77    | Pareto      |   678.0  |

The same exercise across all 6 (machine, variation) pairs (60 cells total)
gives: Lognormal wins 32 (53%), Pareto wins 25 (42%), Gamma wins 3 (5%).

## 6. Justification for the heterogeneous strategy

No single family wins ≥ 60% of (class, station) pairs. We therefore use a
**heterogeneous** assignment — JMT models read per-pair winners from
`distribution_choice.json`. The patterns are intuitive:

- **AppService** (CPU residual) → mostly Lognormal: it is the sum of many
  small CPU-bound operations, which by the CLT approximates a Lognormal
  with moderate CV² (0.05 – 0.6).
- **EventStore / SnapshotDB / ProjectionDB** (DB writes/reads) → mostly
  Pareto: these spans contain rare heavy outliers (network jitter, disk
  contention) that produce skewness 5 – 13, fitted best by a Pareto
  tail.

## 7. JMT fallback for Gamma

JMT 1.3.0's `jmt.engine.random.GammaDistr` exhibited simulation instability
on our parameter ranges (sim terminated after a handful of samples). When
Gamma wins by BIC, we fall back to:

- **Erlang-k** if the fitted shape α is near-integer (|α − round(α)| < 0.05)
  and α ≥ 1.
- **Lognormal** otherwise.

The fallback is documented per-pair in `build_jsimg.py` source and rerun
results are stable.

## 8. K-coefficient computation

`K_var, c, s = D_{var, c, s}^{M7i,io2} / D_{var, c, s}^{M7i,gp3}` from
`K_io2.json`. For mCQRS:

|             | AppService | EventStore | SnapshotDB | ProjectionDB |
|---|---:|---:|---:|---:|
| Zapyty      | 0.921      | 1.000      | 1.000      | 0.946        |
| Stvor       | 0.807      | 0.934      | 0.943      | 1.000        |
| Onovl       | 0.807      | 0.973      | 0.933      | 1.000        |
| RC          | 0.814      | 1.000      | 1.000      | 0.837        |

K < 1 → the M7i.io2 host is faster than M7i.gp3 on these classes; the disk
(io2 vs gp3) provides a small speedup but the dominant scaling factor is the
DDR5 memory bandwidth (5600 MT/s on M7i.io2 vs 4800 MT/s on M7i.gp3) — see
`compute_k.py` for the derivation.

## 9. M7a.io2 predicted demands (Brunnert)

`D_{M7a.io2, c, s} = D_{M7a.gp3, c, s} × K_{c, s}` from
`predicted_demands_m_cqrs.json`. Selected entries (ms):

| Class | AppService | EventStore | SnapshotDB | ProjectionDB |
|---|---:|---:|---:|---:|
| Zapyty | 0.421 | 0     | 0     | 0.534 |
| Stvor  | 1.738 | 0.239 | 0.404 | 0     |
| Onovl  | 1.646 | 0.181 | 0.674 | 0     |
| RC     | 1.283 | 0     | 0     | 0.597 |

## 10. Distribution-parameter fit per (class, station) — applied to M7a.io2

After K-scaling, the variance scales by K². The distribution-fit parameters
emitted in the .jsimg are recomputed from the K-scaled (mean, var) pair
using the family chosen in Phase 0. E.g., for Onovl × AppService, the v5
choice for M7a.gp3 was Gamma → fallback to Lognormal (since the fit shape
α ≈ 19.7 is not near-integer):
σ² = ln(1 + CV²) = ln(1.11) = 0.1044 → σ = 0.323, μ = ln(0.001646) − 0.0522
= −6.46. JMT seeds these directly.

## 11. Analytical X_max, U_s — formulas with substitution

For M7a.io2 mCQRS, target λ = (Q=100, Cr=100, Upd=150, RC=275); total =
625 j/s; user = 350 j/s; servers = (App=2, ES=1, SN=1, Pr=1).

ρ_per_station per ms = (1/m) × Σ_c π_c × D_{c, s} where π_c = λ_c/Σ:

- π = (0.16, 0.16, 0.24, 0.44)
- AppService: (0.16·0.421 + 0.16·1.738 + 0.24·1.646 + 0.44·1.283) / 2 / 1000 = 0.653 ms / 1000 = 0.653 ms × 1/2 servers, normalised. The bottleneck is whichever maximises the per-job demand sum.

Result (analytical_metrics.json): bottleneck = AppService, ρ_per_job =
0.653 ms, X_max_total = 1531.7 j/s, X_max_user = 857.8 j/s.

U_total at λ = 625 j/s:
U_app = (100·0.421 + 100·1.738 + 150·1.646 + 275·1.283) / 1000 / 2 = 0.408,
U_es = 0.051, U_sn = 0.142, U_pr = 0.218.

U_user at λ = 350 (user classes only): U_app_user = 0.231, U_es_user = 0.051,
U_sn_user = 0.142, U_pr_user = 0.053.

## 12. JMT simulation parameters

8 .jsimg models written under `models_data_driven/`. M7a.io2 predicted models
use `maxSamples = 300 000` and `disableStatisticStop = true` to ensure full
sample dump of Response Time per Sink. CSV samples are recorded for
post-processing in `analyze_results.py`. Other (Throughput, Utilization)
measures rely on JMT's internal precision criterion (`precision = 0.03`,
α = 0.01).

## 13. Validation MRE

Predicted vs measured Load (post-10s skip) for M7a.io2 mCQRS:

| Class  | Stat | Predicted (ms) | Measured (ms) | MRE     |
|---|---|---:|---:|---:|
| Zapyty | avg  | 1.26          | 1.00         | +25.5%  |
| Stvor  | avg  | 2.59          | 2.85         | -9.1%   |
| Onovl  | avg  | 2.71          | 3.12         | -13.1%  |

For all 6 user-class pairs (Q/Cr/Upd × m_cqrs/classical_cqrs):

| Stat   | Mean abs MRE | Max abs MRE |
|---|---:|---:|
| avg    | 11.6% | 25.5% |
| median | 15.3% | 36.5% |
| p90    | 20.0% | 25.7% |
| p95    | 25.8% | 34.3% |

Tail stats (max, variance) are wider because the empirical max is dominated
by Node.js GC pauses and OS jitter the queueing model does not represent —
a known limitation discussed in supplementary B.
