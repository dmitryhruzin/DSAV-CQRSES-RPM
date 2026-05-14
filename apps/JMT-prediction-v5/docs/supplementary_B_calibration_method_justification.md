# Supplementary B — Calibration method and distribution choice rationale

This document justifies (a) the choice of the *direct demand-extraction*
calibration method (Spinner et al. category B), and (b) the data-driven
distribution selection executed in Phase 0 of the v5 pipeline. The
justifications are grounded in our actual GoF results, not historical v3/v4
defaults.

## 1. Spinner et al. (2015) classification

Spinner et al. (Performance Evaluation 92:51-71, doi 10.1016/j.peva.2015.07.005)
classify service-demand estimation methods into eight categories:

A. operational, B. direct measurement from instrumentation, C. least-squares
regression, D. Kalman filter, E. maximum-likelihood, F. Bayesian, G. recursive
optimisation (e.g. simplex), H. meta / ensemble.

Tradeoffs:

| Method | Data needed         | Computational cost | Physical interpretability | Robust to noise |
|---|---|---|---|---|
| A direct operational    | utilisation, X     | very low | high  | medium |
| B direct (instrumented)  | per-op telemetry  | low      | very high | high |
| C LSQ                    | aggregate U, X    | medium   | low      | low |
| D Kalman                 | time series       | high     | medium   | high |
| E MLE                    | response samples  | high     | medium   | medium |
| F Bayesian               | priors + samples  | very high| high (if priors) | high |
| G recursive optim        | various           | high     | low      | medium |
| H meta                   | multiple sources  | high     | depends  | high |

## 2. Why direct method (B) for our task

Our system emits structured OpenTelemetry spans for every operation
(http.request, db.eventstore.*, db.snapshot.*, db.projection.*, event.handle).
Sequential logs at one-job-at-a-time arrival isolate the service time from
queueing wait. We therefore have direct access to *pure* service times per
station, exactly what method B needs.

Properties:

- **High interpretability**: each demand D_{c, s} maps to a named operation
  hierarchy (P × E decomposition is human-readable).
- **Transitivity for transfer learning**: K-scaling (Brunnert et al. 2013)
  requires that demands have a physical meaning independent of arrival rate —
  method B gives this; methods C–H produce regression artifacts that bake
  the source workload's arrival rate into the fit.
- **Low computational cost**: a single pass over the Sequential log; no
  iterative optimisation.
- **No identifiability issues**: methods C/E/F often produce nonidentifiable
  parameters in multi-class open networks (Wang & Casale 2014).

## 3. Distribution choice rationale (data-driven, from Phase 0)

### 3.1 Empirical CV² regime

Across our 60 (class, station) cells, empirical CV² ranges from 0.04 to 1.80
for the "normal" (non-RC AppService) cells, and up to 117 for the RC class on
AppService (driven by occasional ~1-second Node.js GC pauses). The dataset is
**sub-exponential** in the majority of cells and only mildly heavy-tailed in
the rest.

### 3.2 GoF results

For each cell we fit 10 candidate distributions (Deterministic, Exponential,
Erlang-k, Gamma, Lognormal, Weibull, Hyperexponential-2, Pareto, Coxian-2,
Hypoexponential-2) with appropriate hard rules (HE only for CV² > 1, Erlang
only for CV² < 1, Hypoexp-2 only for 0.5 < CV² < 1). KS D-statistic + p,
Anderson-Darling A², and BIC are recorded.

Selection: minimum BIC among viable candidates; runner-up within Δ BIC = 2 is
included in the candidates list for tie-break.

### 3.3 Wins across all 60 (class, station) pairs

| Distribution      | Wins  | Share  | Typical cells |
|---|---:|---:|---|
| Lognormal         | 32    | 53.3%  | AppService for all classes; CV² 0.1 – 0.6 cells |
| Pareto            | 25    | 41.7%  | DB ops (EventStore/Snapshot/Projection) with high skew |
| Gamma             |  3    |  5.0%  | mid-CV² AppService cells with shape ≈ 19 |

### 3.4 Strategy decision

No single family wins ≥ 60% → **heterogeneous** strategy: build_jsimg.py
emits a per-(class, station) winner from `distribution_choice.json`.

### 3.5 Comparison with v3/v4 conclusions

v3/v4 manually picked from 3 candidates (Exp, HyperExp, Lognormal) using
validation MRE on M7a.io2 alone (post-hoc choice on the test set). v5
expands to 10 candidates, uses GoF on the *calibration* set (Sequential
logs only), and the resulting choice is statistically principled rather
than tuned to the validation target. The Lognormal that v3/v4 selected
still wins 53% of cells under Phase 0; the major v5 addition is Pareto for
the heavy-skew DB cells.

### 3.6 JMT implementation note

JMT 1.3.0's `jmt.engine.random.GammaDistr` exhibited simulation instability
for our parameter ranges (large α): sim terminates after ~10 samples. We
fall back to Erlang-k when shape is near-integer, otherwise to Lognormal.
Phase-Type and Hypoexponential families were excluded from JMT XML emission
because their MLE/EM parameter fits do not map cleanly to JMT's
`PhaseTypePar` / no-Hypoexp parameterisation. Pareto and Weibull have been
verified to run stably in JMT under our parameter ranges.

## 4. Why we do NOT use Iterative LSQ, Kalman, or Bayesian

- **Iterative LSQ (Pacifici 2008, Kraft 2009)**: overfits utilisation noise;
  loses physical meaning of demands → K-scaling becomes incoherent. We rely
  on Brunnert K-scaling for transfer learning, so any method that produces
  arrival-rate-coupled demand estimates would defeat our purpose.
- **Kalman (Wang, Casale, Sutton 2016)**: time-series tracking of demand
  changes is irrelevant — our workloads are stationary within a window.
- **Bayesian MCMC**: overkill given that Sequential logs directly observe
  service times.
- **GC-tail topological extension**: the rare GC pauses (~1 in 100 PATCH
  requests on m_cqrs) could be modelled as an extra "outlier" station, but
  this requires either a Markov-Modulated arrival or PH-fitting. We treat
  them as a known limitation (visible in max / variance MRE) and defer to
  future work.

## 5. References

- Spinner, S., Casale, G., Brosig, F., Kounev, S. (2015). "Evaluating
  approaches to resource demand estimation." Performance Evaluation 92:51-71.
  doi 10.1016/j.peva.2015.07.005
- Brunnert, A., Vögele, C., Krcmar, H. (2013). "Automatic performance model
  generation for Java EE applications." EPEW 2013, LNCS 8168:74-88.
  doi 10.1007/978-3-642-40725-3_7
- Whitt, W. (1982). "Approximating a point process by a renewal process I:
  Two basic methods." Operations Research 30(1):125-147.
- Bobbio, A., Horváth, A., Telek, M. (2005). "Matching three moments with
  minimal acyclic phase type distributions." Stochastic Models 21(2-3):303-326.
- Asmussen, S., Nerman, O., Olsson, M. (1996). "Fitting phase-type
  distributions via the EM algorithm." Scandinavian Journal of Statistics
  23(4):419-441.
- Casale, G., Serazzi, G. (2024). JMT User Manual v1.3.0.
- Wang, W., Casale, G. (2014). "Maximum likelihood estimation of closed
  queueing network demands from queue length data." ICPE 2014 / 2016.
