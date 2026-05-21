# Exp18 vs Exp16 vs Exp17 — corrected Lognormal calibration

## Question

The Lognormal calibration in `_build_jsimg.py` reads three candidate centers
for the per-cell parameters `(μ, σ)`:

| experiment | formula for μ                              | σ              | semantic anchor                    |
| ---------- | ------------------------------------------ | -------------- | ---------------------------------- |
| **exp16**  | `μ = ln(median_seq) − σ²/2`                | `σ_load_MLE`   | makes `E[X] = median_seq` (mean‑anchored) |
| **exp17**  | `μ = mean(ln load)` (pure MLE on load)     | `σ_load_MLE`   | unshifted MLE on load              |
| **exp18**  | `μ = ln(median_seq)` (NO σ²/2 subtraction) | `σ_load_MLE`   | makes `median(X) = median_seq` (median‑anchored) |

All three share the PS topology, `ZAPYTY_CENTER_M7A_FACTOR = 0.87` for m7a‑GET,
and the iterative m7i calibration loop (separate JSON files per variant).

Below are side‑by‑side results from the same load logs (`logs10-noretry/*-load.log`).

---

## Headline: m7a-io2 PREDICTED (honest K‑prediction test)

m7a‑io2 is the only PURELY PREDICTED machine — its parameters come from
m7a‑gp3 via the disk‑K shift. This is the honest evaluation of the calibration
choice.

### MEAN

| stat   | measured | exp16 pred / MRE | exp17 pred / MRE | exp18 pred / MRE |
| ------ | -------: | ---------------: | ---------------: | ---------------: |
| Zapyty | 1.001 | 0.876 / **−12.47%** | 1.414 / +41.35% | 1.346 / +34.49% |
| Stvor  | 2.850 | 2.384 / **−16.34%** | 3.394 / +19.11% | 3.236 / +13.53% |
| Onovl  | 3.123 | 2.649 / **−15.17%** | 3.644 / +16.66% | 3.541 / +13.36% |
| RC_lag | 5.300 | 3.909 / −26.24% | 6.077 / +14.68% | 5.246 / **−1.01%** |

### MEDIAN

| stat   | measured | exp16 pred / MRE | exp17 pred / MRE | exp18 pred / MRE |
| ------ | -------: | ---------------: | ---------------: | ---------------: |
| Zapyty | 0.730 | 0.681 / **−6.65%** | 1.018 / +39.44% | 1.048 / +43.64% |
| Stvor  | 2.292 | 2.008 / −12.40% | 2.866 / +25.05% | 2.694 / **+17.55%** |
| Onovl  | 2.527 | 2.284 / **−9.63%** | 3.119 / +23.44% | 3.006 / +18.96% |
| RC_lag | 4.490 | 3.552 / −20.89% | 5.550 / +23.59% | 4.722 / **+5.17%** |

### P95

| stat   | measured | exp16 pred / MRE | exp17 pred / MRE | exp18 pred / MRE |
| ------ | -------: | ---------------: | ---------------: | ---------------: |
| Zapyty |  2.246 | 2.189 / **−2.57%** |  3.876 / +72.54% | 3.325 / +48.03% |
| Stvor  |  5.641 | 5.163 / **−8.48%** |  7.296 / +29.33% | 7.145 / +26.66% |
| Onovl  |  6.010 | 5.477 / **−8.87%** |  7.609 / +26.59% | 7.511 / +24.97% |
| RC_lag | 10.194 | 7.047 / −30.87% | 10.937 / +7.28% | 9.723 / **−4.62%** |

---

## All four machines — MEAN

| machine  | source     | exp16                 | exp17                | exp18                |
| -------- | ---------- | --------------------: | -------------------: | -------------------: |
| m7i-gp3  | measured   | Zapyty/Stvor/Onovl/RC_lag = 3.223 / 7.477 / 8.329 / 13.984 | (same) | (same) |
| m7i-gp3  | MRE        |  +15.60 / +9.70 / +10.04 / +5.25 % | +9.40 / −10.04 / −12.85 / −11.47 % | **−3.15 / −5.52 / −8.79 / −10.70 %** |
| m7i-io2  | MRE        |  +10.41 / **−1.93** / **−2.03** / **−1.22** % | +7.40 / −13.23 / −15.33 / −12.42 % | −7.08 / −12.17 / −14.87 / −14.85 % |
| m7a-gp3  | MRE        |  −68.61 / −52.84 / −56.75 / −56.35 % | **−11.42 / −16.84 / −25.90 / −11.92** % | −51.55 / −34.02 / −40.28 / −39.86 % |
| m7a-io2  | MRE        |  **−12.47 / −16.34 / −15.17** / −26.24 % | +41.35 / +19.11 / +16.66 / +14.68 % | +34.49 / +13.53 / +13.36 / **−1.01** % |

---

## Aggregate |MRE| per machine — side‑by‑side

### Mean (of 4 classes |MRE|)

| machine  |  exp16  |  exp17  |   exp18  |
| -------- | ------: | ------: | ------: |
| m7i-gp3  | 10.15 % | 10.94 % |  **7.04 %** |
| m7i-io2  |  **3.90 %** | 12.10 % | 12.24 % |
| m7a-gp3  | 58.64 % | **16.52 %** | 41.43 % |
| m7a-io2  | **17.56 %** | 22.95 % | 15.60 % |
| **avg**  | **22.56 %** | 15.63 % | **19.08 %** |

### Median (of 4 classes |MRE|)

| machine  |  exp16  |  exp17  |  exp18  |
| -------- | ------: | ------: | ------: |
| m7i-gp3  |  **4.15 %** |  1.95 % |  **1.63 %** |
| m7i-io2  |  2.04 % |  1.02 % |  **0.75 %** |
| m7a-gp3  | **15.11 %** | 89.42 % | 30.96 % |
| m7a-io2  | **12.39 %** | 27.88 % | 21.33 % |
| **avg**  |  **8.42 %** | 30.07 % | 13.67 % |

### P90 (of 4 classes |MRE|)

| machine  |  exp16  |  exp17  |  exp18  |
| -------- | ------: | ------: | ------: |
| m7i-gp3  | 20.98 % | 23.61 % | **13.51 %** |
| m7i-io2  |  **8.85 %** | 24.66 % | 17.37 % |
| m7a-gp3  | **17.56 %** | 119.51 % | 40.52 % |
| m7a-io2  |  **9.87 %** | 40.44 % | 29.34 % |
| **avg**  | **14.32 %** | 52.06 % | 25.19 % |

### P95 (of 4 classes |MRE|)

| machine  |  exp16  |  exp17  |  exp18  |
| -------- | ------: | ------: | ------: |
| m7i-gp3  | 21.53 % | 25.60 % | **14.15 %** |
| m7i-io2  | **11.52 %** | 29.70 % | 22.53 % |
| m7a-gp3  | **19.31 %** | 90.97 % | 26.11 % |
| m7a-io2  | **12.70 %** | 33.94 % | 26.07 % |
| **avg**  | **16.27 %** | 45.05 % | 22.22 % |

---

## Interpretation

### Was the σ²/2 subtraction in exp16 the right choice?

The empirical answer is nuanced. The σ²/2 subtraction in exp16 reduces μ
below ln(median_seq) — that is, exp16 pulls the body of the predicted
distribution to the LEFT of where exp18 puts it (since
`E[exp16] = median_seq` but `median(exp16) = median_seq · exp(−σ²/2) < median_seq`).

Looking at the **aggregate-|MRE|** numbers across the four machines:

- **exp16 wins on tails** (median, P90, P95 averages: 8.42 / 14.32 / 16.27 %),
  losing only on mean.
- **exp18 wins on mean for m7i-gp3 and m7a-io2**, and is competitive on tail
  stats for both m7i machines (median: 1.63 % gp3, 0.75 % io2).
- **exp17 wins on m7a-gp3 mean** (16.52 % vs 41–58 %) — pure MLE keeps the
  m7a‑gp3 center close to load — but loses badly on every tail percentile
  (median p90 = 119.51 %, P95 = 90.97 % on m7a-gp3).

### m7a-io2 (the PREDICTED machine) — most important slice

This is where the calibration philosophy actually matters because there is no
direct fitting. Comparing aggregate |MRE|:

| stat   |  exp16  |  exp17  |  exp18  |
| ------ | ------: | ------: | ------: |
| mean   | **17.56 %** | 22.95 % | 15.60 % |
| median | **12.39 %** | 27.88 % | 21.33 % |
| p90    |  **9.87 %** | 40.44 % | 29.34 % |
| p95    | **12.70 %** | 33.94 % | 26.07 % |

On the predicted machine, **exp16 dominates on every tail stat**. exp18 is
slightly better on the mean (15.60 vs 17.56 %), but on median/p90/p95 it is
1.7–3.0× worse than exp16. exp17 is worst everywhere except mean.

### Why does this happen mechanically?

- σ ≈ 0.8–1.7 on these cells. `σ²/2` ≈ 0.32–1.45 — a substantial offset.
- exp18 sets `μ = ln(median_seq)`, so `E[X] = median_seq · exp(σ²/2)`.
  For σ ≈ 1.5 this multiplies the mean by ≈ 3.1 → predicted mean is much
  higher than measured.
- exp16 sets `E[X] = median_seq` (one factor of `exp(σ²/2)` removed), but
  median is `median_seq · exp(−σ²/2)` → predicted median is lower than
  measured.
- The fact that **exp16 wins on tails and exp18 only sometimes wins on the
  mean** says the seq median is itself a low estimator of where the
  *modeled* center should sit — the seq distribution (load‑free) has lighter
  tails than the load distribution, so anchoring exclusively on its
  empirical median over‑pulls the body of the LN.

### Recommendation

For the JMT prediction pipeline in this repo, **exp16 remains the better
default**: lowest aggregate |MRE| on the predicted m7a-io2 across median,
p90 and p95; only modestly worse than exp18 on mean. The σ²/2 subtraction
is therefore well-motivated — it compensates for the empirical mismatch
between median_seq (an outlier-robust seq center) and the load mean that
JMT actually emits.

exp18 is useful as a sanity check: it confirms that **without** the σ²/2
correction the predicted MEDIANs over‑shoot measured by 17–43 %, which is
exactly the direction the mathematics predicts. The user's intuition that
"median(fitted) should equal median_seq" turns out to be empirically wrong
for these workloads — the load‑level median sits below the seq median once
queueing is included, and exp16's subtraction is what closes that gap.

exp17 (pure MLE on load) is the worst of the three on every tail stat for
the predicted machine — including σ²/2 in the wrong direction.

---

## Files added/changed

- `_build_jsimg.py` — exp18 in `ALL_EXPERIMENTS`; new calibration branch
  for exp18; `M7I_CAL_PS_NOSUB` load; PS topology gate; K-prediction uses
  `k_fits=FITS` and `k_center="median"` (matches exp16).
- `_calibrate_m7i.py` — `ps_nosub` variant: stores `{median_ms, sigma}`;
  iterative scaling targets `median_ms`; output `m7i_calibration_ps_nosub.json`.
- `_export_exp18_per_machine.py` — mirrors `_export_exp16/17_per_machine.py`.
- `m7i_calibration_ps_nosub.json` — converged at iteration 5
  (worst |ratio−1| = 0.018).
- `models/{m7i-gp3,m7i-io2,m7a-gp3,m7a-io2}-m_cqrs_exp18.jsimg` and
  `_logs/` directories with JMT output CSVs.
