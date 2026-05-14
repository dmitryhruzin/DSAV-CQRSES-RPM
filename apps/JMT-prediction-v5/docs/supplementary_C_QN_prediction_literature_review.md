# Supplementary C — Literature review on QN prediction and transfer learning

Background literature supporting the v5 method (queueing-network performance
prediction + K-coefficient transfer learning + data-driven service-time
distribution choice).

## 1. QN modeling — textbook foundations

- **Lazowska, E. D., Zahorjan, J., Graham, G. S., Sevcik, K. C.** (1984).
  *Quantitative System Performance: Computer System Analysis Using Queueing
  Network Models*. Prentice-Hall (free PDF). Foundational; introduces the
  open M/M/m formalism, demand decomposition, and Forced Flow Law that we
  use in `analytical_metrics.py`.
- **Bolch, G., Greiner, S., de Meer, H., Trivedi, K. S.** (2006). *Queueing
  Networks and Markov Chains*. Wiley-Interscience, 2nd ed. Comprehensive
  reference; chapter 6–7 cover open multiclass networks and their
  approximations.
- **Menasce, D. A., Almeida, V. A. F.** (2002). *Capacity Planning for Web
  Services: Metrics, Models, and Methods*. Prentice-Hall. Operationally
  oriented; the X_max-versus-arrival-rate "knee curve" view we use to
  interpret the analytical_metrics output.
- **Harchol-Balter, M.** (2013). *Performance Modeling and Design of
  Computer Systems: Queueing Theory in Action*. Cambridge University Press.
  Includes the often-cited observation that real computer workloads
  routinely exhibit CV² > 100 (driven by GC pauses / OS jitter) — directly
  relevant to our RC-class on AppService (CV² = 62 – 118).

## 2. Service-demand estimation surveys

- **Spinner, S., Casale, G., Brosig, F., Kounev, S.** (2015). "Evaluating
  approaches to resource demand estimation." *Performance Evaluation*
  92:51-71. doi 10.1016/j.peva.2015.07.005. The 8-category taxonomy (A–H)
  used in supplementary B to justify our direct method (B).
- **Spinner, S., Kounev, S., Zhu, X., Lu, L., Uysal, M., Holler, A.,
  Griffith, R.** (2014). "Runtime vertical scaling of virtualized
  applications via online model estimation." *SASO 2014*. Application of
  LibReDE.
- **Pacifici, G., Spreitzer, M., Tantawi, A., Youssef, A.** (2005). "Performance
  management for cluster-based web services." *IEEE JSAC* 23(12):2333-2343.
  Classic LSQ-from-utilisation method (Spinner category C); not used here
  because of the identifiability and transfer-learning concerns documented
  in supplementary B.

## 3. Transfer learning via K-coefficients (our core method)

- **Brunnert, A., Vögele, C., Krcmar, H.** (2013). "Automatic Performance
  Model Generation for Java EE Applications." *EPEW 2013*, LNCS 8168:74-88.
  doi 10.1007/978-3-642-40725-3_7. Introduces the K-scaling approach we
  generalise in `compute_k.py`.
- **Brunnert, A., Krcmar, H.** (2017). "Continuous performance evaluation
  and capacity planning using resource profiles." *JSS* 123:239-262.
  doi 10.1016/j.jss.2015.08.030. Extends the resource-profile concept to
  continuous-integration contexts; informs our v5 separation of
  *calibration* (Sequential logs) and *validation* (Load logs).
- **Brunnert, A., et al.** (2015). "Performance-oriented DevOps: A Research
  Agenda." SPEC RG TR. Sketches an architecture exactly matching our
  pipeline: instrumented run → fit demands → extrapolate via K to new
  hardware → simulate → validate.

## 4. JMT tool methodological reference

- **Bertoli, M., Casale, G., Serazzi, G.** (2009). "JMT: performance
  engineering tools for system modelling." *ACM SIGMETRICS PER* 36(4):10-15.
  doi 10.1145/1530873.1530877. Description of the JMT simulator's
  distribution-emission and result-XML schema we read in
  `analyze_results.py`.
- **Casale, G., Serazzi, G.** (2024). *JMT User Manual v1.3.0.* Sections 3.1
  – 3.10 cover distribution parameter conventions (alpha, lambda, p, k, etc.)
  used by `build_jsimg.py`.

## 5. Distribution selection (Phase 0)

- **Whitt, W.** (1982). "Approximating a point process by a renewal process I:
  Two basic methods." *Operations Research* 30(1):125-147. Hyperexponential
  balanced-means formula we used to calibrate HyperExp at moment-matching
  precision (used as a candidate in Phase 0 when CV² > 1).
- **Asmussen, S., Nerman, O., Olsson, M.** (1996). "Fitting phase-type
  distributions via the EM algorithm." *Scandinavian Journal of Statistics*
  23(4):419-441. EM-based PH-2 fit we attempted before falling back to
  Lognormal due to JMT PhaseTypePar parameterisation friction.
- **Bobbio, A., Horváth, A., Telek, M.** (2005). "Matching three moments with
  minimal acyclic phase type distributions." *Stochastic Models* 21(2-3):
  303-326. Moment-based PH calibration.
- **Schwarz, G.** (1978). "Estimating the dimension of a model." *Annals of
  Statistics* 6(2):461-464. Bayesian Information Criterion; our primary
  selection criterion in `characterize_distributions.py`.

## 6. What we deliberately do NOT do (with rationale)

- **Iterative LSQ (Pacifici 2008, Kraft et al. 2009)**: produces
  utilisation-coupled demands which are not transitive to new hardware
  under K-scaling. Verified counterexamples in Spinner 2015 Table 4.
- **Bayesian MCMC (Sutton & Jordan 2011, Wang-Casale-Sutton 2016)**: overkill
  given direct access to per-operation service times via Sequential
  instrumentation. Computational cost > 1000× method B.
- **GC-tail topological extension**: the rare GC pauses (~1 / 100 PATCH on
  m_cqrs at the M7g.gp3 baseline; rarer on M7a) could be added as an extra
  Markov-Modulated station with a low-rate "ON" phase, but doing so
  requires either a multi-state PH-fit or a separate MMPP source. We treat
  this as future work and document the visible MRE inflation in tail
  statistics (max, range, variance).

## 7. v5-specific contributions over v3/v4

1. **Explicit P × E decomposition** with sanity check `Σ_s D_{c,s} = E[anchor]`
   to 0.0% on every (machine, class) triple in our data. This is the form
   recommended by Spinner 2015 §3.1.2 and Brunnert 2013 §3 but rarely
   reported with the attribution-residual check.

2. **Data-driven distribution choice over 10 candidates** with BIC + KS +
   Anderson-Darling, replacing the v3/v4 post-hoc Exp / HE / Lognormal trio
   chosen by validation MRE.

3. **Utilisation + Throughput predictions** alongside Response Time,
   enabling capacity-planning interpretations (X_max_user, U_s_user) the
   v3/v4 reports could not produce.

4. **Documented Gamma fallback**: encountered in practice via JMT
   integration testing; reported explicitly rather than silently
   substituting Lognormal.

This combination — direct method B + Phase-0 GoF + Brunnert K + capacity
output — is, to our knowledge, a novel integration. The closest published
pipeline is Brunnert 2015 SPEC RG TR which describes the architecture but
without distribution-choice rigour.
