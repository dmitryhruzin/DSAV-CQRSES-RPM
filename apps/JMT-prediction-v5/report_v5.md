# JMT-prediction-v5 — Master Report

Version 5 extends v4 with: (a) data-driven service-time distribution choice via
goodness-of-fit (GoF) tests over 10 candidate families, (b) explicit
P(op | class) × E[d_op] demand decomposition with attribution sanity check,
(c) RC arrival rate raised 250 → 275 j/s, (d) both Throughput AND Utilization
predicted alongside Response Time, (e) user-attributable utilization view that
subtracts the RC contribution, (f) bottleneck X_max analysis with a separate
"user" view (RC excluded), and (g) three supplementary documents (docs/).

## Pipeline

```
python3 extract_demands.py             # P × E decomposition + per-request totals
python3 characterize_distributions.py  # Phase 0 — GoF for 10 families
python3 compute_k.py                   # K = S^{M7i,io2} / S^{M7i,gp3}
python3 build_jsimg.py                 # .jsimg files (RC=275, Throughput measures)
python3 run_simulations.py             # JMT CLI for 8 baselines + 2 predicted
python3 analyze_results.py             # Extract U, X, RT from result.jsim
python3 analytical_metrics.py          # X_max, U analytical
python3 user_view_metrics.py           # User-attributable view
python3 validate_against_load.py       # Predicted vs measured Load MRE
```

## Phase 0 — Distribution choice (key finding)

Across 60 (class, station) pairs over the 6 baselines:

| Distribution      | Wins | Share |
|---|---:|---:|
| Lognormal         | 32   | 53.3% |
| Pareto            | 25   | 41.7% |
| Gamma             |  3   |  5.0% |

Decision: heterogeneous — no single family dominates >= 60% of pairs. The
build_jsimg.py pipeline reads per-(class, station) winners from
distribution_choice.json.

Gamma fallback: JMT 1.3.0's jmt.engine.random.GammaDistr exhibited simulation
instability (sim terminated after a handful of samples) on our parameter
ranges. When Gamma wins by BIC, we fall back to Erlang-k (if shape is
near-integer) or Lognormal (the runner-up). Documented in docs/supplementary_B.

See final_distribution_choice.md for the per-pair winning table.

## Phase 1 — Explicit P × E decomposition

For every (class, station) pair we compute D_{c,s} = Σ_op P(op | c) × E[d_op | c]
and verify Σ_s D_{c,s} ≈ E[http.request | c] within 5%. Across all 24
(machine, variation, class) triples, attribution diff = 0.00% — the spans
cleanly assign to the four service stations without leakage.

The empirical variance (per-request station totals) and analytic variance
(Σ_op P(op) × Var(d_op) + Σ_op P(op)(1-P(op)) × E[d_op]²) are both reported
in demands.json as a cross-check on the independence assumption.

## Phase 2 — JMT models

8 models in models_data_driven/: 6 calibrated baselines + 2 predicted M7a.io2
(K-scaled from M7a.gp3, Brunnert method). Each model includes:

- Utilization per station (system-level)
- Throughput per (station, class) — sum gives system X
- Response Time per Sink per class (300 k verbose samples for predicted)

RC arrival rate: 275 j/s (was 250 in v4); total 625 j/s; user 350 j/s.

## Phase 3 — Master metrics table

### Analytical capacity (analytical_metrics.json)

| (machine, variation)        | bottleneck    | X_max_total | X_max_user | rho/job (ms) | U_app | U_es | U_sn | U_pr |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| m7i-gp3 / m_cqrs            | AppService    |  1102.5     | 617.4      | 0.907 | 0.567 | 0.065 | 0.173 | 0.294 |
| m7i-gp3 / classical_cqrs    | AppService    |  1567.2     | 877.6      | 0.638 | 0.399 | 0.390 | 0.124 | 0.292 |
| m7i-io2 / m_cqrs            | AppService    |  1351.1     | 756.6      | 0.740 | 0.463 | 0.062 | 0.162 | 0.253 |
| m7i-io2 / classical_cqrs    | AppService    |  1785.1     | 999.6      | 0.560 | 0.350 | 0.289 | 0.104 | 0.257 |
| m7a-gp3 / m_cqrs            | AppService    |  1249.3     | 699.6      | 0.800 | 0.500 | 0.054 | 0.152 | 0.253 |
| m7a-gp3 / classical_cqrs    | EventStore    |  1737.1     | 972.8      | 0.576 | 0.328 | 0.360 | 0.119 | 0.245 |
| m7a-io2 / m_cqrs            | AppService    |  1531.7     | 857.8      | 0.653 | 0.408 | 0.051 | 0.142 | 0.218 |
| m7a-io2 / classical_cqrs    | AppService    |  2180.9     | 1221.3     | 0.459 | 0.287 | 0.266 | 0.101 | 0.217 |

All target load 625 j/s sits comfortably below X_max — no machine saturates.
Bottleneck remains AppService for 7 of 8 pairs.

### User-attributable utilization (analytical)

| (machine, variation)        | U_app_user | U_es_user | U_sn_user | U_pr_user |
|---|---:|---:|---:|---:|
| m7i-gp3 / m_cqrs            | 0.316 | 0.065 | 0.173 | 0.063 |
| m7i-gp3 / classical_cqrs    | 0.155 | 0.390 | 0.124 | 0.063 |
| m7i-io2 / m_cqrs            | 0.258 | 0.062 | 0.162 | 0.059 |
| m7i-io2 / classical_cqrs    | 0.153 | 0.289 | 0.104 | 0.061 |
| m7a-gp3 / m_cqrs            | 0.283 | 0.054 | 0.152 | 0.056 |
| m7a-gp3 / classical_cqrs    | 0.121 | 0.360 | 0.119 | 0.055 |
| m7a-io2 / m_cqrs            | 0.231 | 0.051 | 0.142 | 0.053 |
| m7a-io2 / classical_cqrs    | 0.119 | 0.266 | 0.101 | 0.053 |

### Predicted M7a.io2 — Response time per class (data-driven mode)

m_cqrs:

| class  | avg | median | p90 | p95 | max |
|---|---:|---:|---:|---:|---:|
| Zapyty | 1.26 | 1.00 | 2.07 | 2.58 | 62.56 |
| Stvor  | 2.59 | 2.40 | 3.35 | 3.79 | 80.42 |
| Onovl  | 2.71 | 2.60 | 3.56 | 3.95 | 13.34 |
| RC     | 2.15 | 1.94 | 3.30 | 3.85 | 64.47 |

classical_cqrs:

| class  | avg | median | p90 | p95 | max |
|---|---:|---:|---:|---:|---:|
| Zapyty | 1.13 | 0.97 | 1.63 | 2.03 | 40.15 |
| Stvor  | 2.06 | 1.90 | 2.81 | 3.20 | 73.12 |
| Onovl  | 2.79 | 2.61 | 3.56 | 3.98 | 83.92 |
| RC     | 1.96 | 1.80 | 2.87 | 3.32 | 35.58 |

### Predicted M7a.io2 — Utilization + Throughput (JMT)

m_cqrs:

| Station       | U (JMT) | X_total (j/s, JMT) | U_user (analytic) |
|---|---:|---:|---:|
| AppService    | 0.408 | 624.4 | 0.231 |
| EventStore    | 0.051 | 249.1 | 0.051 |
| SnapshotDB    | 0.142 | 249.7 | 0.142 |
| ProjectionDB  | 0.218 | 375.3 | 0.053 |

Per-class system X: Zapyty 99.9, Stvor 99.8, Onovl 150.0, RC 275.3 — matches
target arrivals → stationary regime confirmed.

classical_cqrs:

| Station       | U (JMT) | X_total (j/s, JMT) | U_user (analytic) |
|---|---:|---:|---:|
| AppService    | 0.287 | 625.3 | 0.119 |
| EventStore    | 0.267 | 250.0 | 0.266 |
| SnapshotDB    | 0.101 | 250.0 | 0.101 |
| ProjectionDB  | 0.218 | 375.3 | 0.053 |

## Phase 4 — Validation MRE

| (machine, variation)        | Zapyty avg pred/meas (MRE) | Stvor avg pred/meas (MRE) | Onovl avg pred/meas (MRE) |
|---|---|---|---|
| m7a-io2 / m_cqrs            | 1.26 / 1.00 (+25.5%) | 2.59 / 2.85 (-9.1%)  | 2.71 / 3.12 (-13.1%) |
| m7a-io2 / classical_cqrs    | 1.13 / 1.02 (+10.3%) | 2.06 / 1.99 (+3.6%)  | 2.79 / 3.03 (-8.0%)  |

Aggregate MRE on M7a.io2 transfer-learning honest test (request-path classes):

| Stat     | Mean abs MRE | Max abs MRE |
|---|---:|---:|
| avg      |  11.6% | 25.5% |
| median   |  15.3% | 36.5% |
| p90      |  20.0% | 25.7% |
| p95      |  25.8% | 34.3% |

## Verification

1. Phase 1 attribution check: all 24 (machine, variation, class) triples have
   attribution diff = 0.0% (decomposition equivalent to per-request totals).
2. Phase 0 GoF validation: BIC for the winning distribution is substantially
   lower than Exp baseline on every pair (typical gap > 1000). KS p-values
   are ~ 0 due to n = 500 – 3000 (KS is over-powered at this n; we rely on BIC).
3. Variance consistency: empirical ≈ analytic within ±15% on independent
   stations. AppService shows the largest deviation due to http.request
   inherently coupling CPU and DB spans.
4. Analytical vs JMT cross-check: U_total_analytic vs U_total_JMT differ by
   < 5 pp at target load for all 4 stations.
5. M7a.io2 transfer-learning: avg MRE 11.6% (mean across 6 user-class pairs),
   p95 MRE 25.8%. The model has not seen any M7a.io2 calibration data.

## Files

- demands.json — P × E decomposition + per-request totals + raw spans
- distribution_choice.json — per-pair fit results + BIC for all candidates
- final_distribution_choice.md — human-readable decision rationale
- K_io2.json — K coefficients (M7i.io2 / M7i.gp3)
- predicted_demands_*.json — K-scaled M7a.io2 demands
- analysis_v5.json — JMT result extraction + MRE comparison
- analytical_metrics.json — X_max, U analytical per machine
- user_view_results.json — user-attributable view per (machine, variation)
- validation_v5.json — predicted vs measured MRE per stat
- models_data_driven/*.jsimg — 8 JMT model files
- results_data_driven/*.jsim — 14 JMT result files
- run_summary_data_driven.json — JMT run summary
- docs/supplementary_A_calibration_walkthrough.md
- docs/supplementary_B_calibration_method_justification.md
- docs/supplementary_C_QN_prediction_literature_review.md

## Key findings

- Lognormal and Pareto split the field: Lognormal wins ~53% of (class,
  station) pairs (mostly AppService and lower-CV² ones), Pareto ~42% (mostly
  heavy-skewed DB ops). Gamma wins ~5% but JMT's GammaDistr is unstable so we
  fall back.
- No machine saturates at 625 j/s — X_max_total ranges 1100 – 2180 j/s.
  M7a.io2 has the highest predicted capacity (X_max_user ~ 1221 j/s for
  classical_cqrs), ~ 4× the user load.
- Transfer-learning honest test: 11.6% mean absolute MRE on avg response time
  for M7a.io2 (across user-class pairs); 25.8% on p95. The model has not seen
  any M7a.io2 data — only K-scaled from M7a.gp3.
- The major contributor to large variance MRE is the long-tail outliers (GC
  pauses) the queueing model does not represent. Documented in supplementary B.
