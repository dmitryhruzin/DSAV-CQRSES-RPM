# Exp 17 (Pure MLE no-shift) vs Exp 16 (Hybrid) — comparison

## What changed

| aspect            | exp16 (hybrid, current best)                    | exp17 (pure MLE on load, no shift)           |
| ----------------- | ----------------------------------------------- | -------------------------------------------- |
| μ                 | `ln(median_seq) − σ²/2` (E[X] = median_seq)     | `mean(ln load)` — pure MLE on load           |
| σ                 | `σ_load_MLE`                                    | `σ_load_MLE` (same as exp16)                 |
| AppService        | Processor Sharing (PS)                          | Processor Sharing (PS) — same                |
| K-prediction      | `K_median = median_load(io2) / median_load(gp3)` on converged m7i pair (additively shifts μ by `ln K`) | same form, but on the ps_mle converged pair |
| m7i calibration   | iterative PS calibration (`m7i_calibration_ps.json`), init from `median_seq + σ_MLE` | iterative PS calibration (`m7i_calibration_ps_mle.json`), init from FITS_LOAD.exp1 (`μ`, `σ` directly) |

Conceptually, exp16 places the Lognormal **center** at `median(seq)` (a sequential-execution proxy of the disk's intrinsic service time without queueing) and lets JMT add queueing through PS. exp17 places the center at `mean(ln load)` (the unbiased MLE on the *under-load* sample) — i.e. it embeds queueing into the service-time distribution itself.

The user's prior load-fit comparison without JMT showed pure MLE on load fits the load distribution ~3× better than hybrid (11.88 % vs 36.70 % MRE on raw load samples). But that comparison did not run the load samples through a queueing-network simulator — it was a *closed-form* check of how well the fitted LN matches the empirical CDF. The hybrid (exp16) was designed under the hypothesis that **JMT itself adds queueing**, so feeding it a distribution that already includes queueing inflation would double-count waiting time and over-predict response time.

## Pipeline artifacts produced

- `m7i_calibration_ps_mle.json` — converged m7i centers under PS, init from pure MLE on load.
- `models/m7{i,a}-{gp3,io2}-m_cqrs_exp17.jsimg` (4 files) + `.jsimg-result.jsim` + `_logs/` CSVs.
- `_export_exp17_per_machine.py` — analog of `_export_exp16_per_machine.py`.

Calibration converged at iteration 8 (worst `|ratio−1| = 0.038`, below `TOL = 0.04`).

## Headline result: exp16 wins on the predicted machine

The honest test of any predictive methodology is the **predicted machine** — m7a-io2, which was not used for calibration (m7a-gp3 was the base, m7i pair was the calibration source). On every statistic except the per-class mean, exp16 beats exp17 substantially on m7a-io2:

| stat   | exp16 \|MRE\| | exp17 \|MRE\| | winner |
| ------ | ------------: | ------------: | :----: |
| mean   |  17.56 %      |  22.95 %      | exp16  |
| median |  12.39 %      |  27.88 %      | exp16  |
| p90    |   9.87 %      |  40.44 %      | exp16  |
| p95    |  12.70 %      |  33.94 %      | exp16  |

The largest gaps are at the tails: at p90 exp17 has **4× worse** MRE on m7a-io2, at p95 ~2.7× worse. This is exactly the **double-counting** signature predicted by the hypothesis: pure MLE on load already carries the under-load tail thickness, then JMT adds further queueing on top → predictions blow up at high quantiles.

## Grand mean across all 4 machines × 4 classes

| stat   | exp16 \|MRE\| | exp17 \|MRE\| |     Δ      |
| ------ | ------------: | ------------: | ---------: |
| mean   |  22.56 %      |  15.63 %      | −6.93 %    |
| median |   8.42 %      |  30.07 %      | +21.64 %   |
| p90    |  14.32 %      |  52.05 %      | +37.74 %   |
| p95    |  16.27 %      |  45.05 %      | +28.78 %   |

The only stat where exp17 looks better is the per-class **mean**, and this is because exp16 substantially **under-predicts** m7a-gp3 (mean MRE around −56 % across classes). Exp17, by inflating service time, accidentally compensates for whatever calibration gap is hurting m7a-gp3 means in exp16. But on every other stat (median / p90 / p95), exp16 wins by large margins.

## Why m7a-gp3 is the odd one out

Look at the median table on m7a-gp3 carefully: exp17 over-predicts by **+202 %** on Zapyty (predicted median 2.42 ms vs measured 0.80 ms), and +45 % / +44 % / +66 % on the other classes. The m7a-gp3 load distribution has very heavy queueing inflation relative to its sequential service time, so its pure-MLE μ is much larger than the seq-based median. When that μ is used as the JMT service-time center *and* JMT adds queueing on top, the result is a median that's 3× too high.

In contrast, m7i is calibrated iteratively so the m7i medians match by construction (worst ratio 1.04 at convergence). m7a-io2 inherits its center from m7a-gp3 via K-prediction. Because m7a-gp3 itself is over-inflated in exp17, m7a-io2 also drifts up.

## Per-(machine, class) detail — median (ms)

| machine | class  | meas | exp16 pred | exp16 MRE | exp17 pred | exp17 MRE |
| ------- | ------ | ---: | ---------: | --------: | ---------: | --------: |
| m7i-gp3 | Zapyty |  2.05 |  2.14 |  +4.40 %  |  2.12 |  +3.01 %   |
| m7i-gp3 | Stvor  |  5.71 |  5.73 |  +0.48 %  |  5.71 |  +0.08 %   |
| m7i-gp3 | Onovl  |  6.25 |  6.30 |  +0.86 %  |  6.25 |  +0.13 %   |
| m7i-gp3 | RC_lag | 10.69 | 11.86 | +10.88 %  | 11.18 |  +4.57 %   |
| m7i-io2 | Zapyty |  1.46 |  1.46 |  +0.05 %  |  1.46 |  +0.30 %   |
| m7i-io2 | Stvor  |  4.09 |  4.10 |  +0.13 %  |  4.09 |  +0.07 %   |
| m7i-io2 | Onovl  |  4.57 |  4.59 |  +0.56 %  |  4.58 |  +0.37 %   |
| m7i-io2 | RC_lag |  7.58 |  8.15 |  +7.43 %  |  7.84 |  +3.35 %   |
| m7a-gp3 | Zapyty |  0.80 |  0.90 | +12.92 %  |  2.42 | **+202.87 %** |
| m7a-gp3 | Stvor  |  2.97 |  2.47 | −16.66 %  |  4.31 | **+45.35 %**  |
| m7a-gp3 | Onovl  |  3.20 |  2.75 | −14.13 %  |  4.60 | **+43.76 %**  |
| m7a-gp3 | RC_lag |  5.72 |  4.76 | −16.74 %  |  9.47 | **+65.68 %**  |
| m7a-io2 | Zapyty |  0.73 |  0.68 |  −6.65 %  |  1.02 |  +39.44 %  |
| m7a-io2 | Stvor  |  2.29 |  2.01 | −12.40 %  |  2.87 |  +25.05 %  |
| m7a-io2 | Onovl  |  2.53 |  2.28 |  −9.63 %  |  3.12 |  +23.44 %  |
| m7a-io2 | RC_lag |  4.49 |  3.55 | −20.89 %  |  5.55 |  +23.59 %  |

Notable: m7i medians match equally well or slightly better under exp17 (the iterative loop converges on both). The damage is in m7a — and especially m7a-gp3 — where pure MLE μ on a 2-vCPU box with PS scheduling and ~280 events/s aggregate arrival rate already encodes queueing inflation, and JMT then adds more on top.

## Per-(machine, class) detail — p95 (ms)

| machine | class  | meas  | exp16 pred | exp16 MRE | exp17 pred | exp17 MRE |
| ------- | ------ | ----: | ---------: | --------: | ---------: | --------: |
| m7i-gp3 | Zapyty |  9.06 | 12.08 | +33.38 %  | 11.42 | +26.05 %  |
| m7i-gp3 | Stvor  | 18.03 | 22.60 | +25.34 %  | 14.53 | −19.39 %  |
| m7i-gp3 | Onovl  | 20.30 | 25.52 | +25.70 %  | 15.16 | −25.31 %  |
| m7i-gp3 | RC_lag | 34.35 | 33.77 |  −1.69 %  | 23.48 | −31.65 %  |
| m7i-io2 | Zapyty |  5.54 |  7.27 | +31.33 %  |  7.21 | +30.21 %  |
| m7i-io2 | Stvor  | 12.74 | 13.06 |  +2.52 %  |  9.47 | −25.64 %  |
| m7i-io2 | Onovl  | 14.55 | 14.79 |  +1.63 %  | 10.12 | −30.44 %  |
| m7i-io2 | RC_lag | 23.19 | 20.73 | −10.62 %  | 15.65 | −32.49 %  |
| m7a-gp3 | Zapyty |  3.13 |  3.40 |  +8.85 %  | 10.28 | **+229.10 %** |
| m7a-gp3 | Stvor  |  8.29 |  6.70 | −19.14 %  | 12.00 | +44.75 %  |
| m7a-gp3 | Onovl  |  8.29 |  6.98 | −15.85 %  | 12.39 | +49.40 %  |
| m7a-gp3 | RC_lag | 14.42 |  9.60 | −33.42 %  | 20.28 | +40.61 %  |
| m7a-io2 | Zapyty |  2.25 |  2.19 |  −2.57 %  |  3.88 | +72.54 %  |
| m7a-io2 | Stvor  |  5.64 |  5.16 |  −8.48 %  |  7.30 | +29.33 %  |
| m7a-io2 | Onovl  |  6.01 |  5.48 |  −8.87 %  |  7.61 | +26.59 %  |
| m7a-io2 | RC_lag | 10.19 |  7.05 | −30.87 %  | 10.94 |  +7.28 %  |

Interesting wrinkle: exp17 cleans up the systematic m7i-io2 over-prediction of p95 commands that exp16 had (~+30 % → +30 % on Zapyty stays, but Stvor / Onovl / RC_lag swing into −25 to −32 % under-prediction territory). Pure MLE on load gives a *thinner* convolved tail than hybrid does in this case because the calibration loop scaled the per-cell mean down — but it now misses the upper tail in the other direction.

## Verdict

**exp16 (hybrid) wins on the predicted machine and at the tails.** The double-counting hypothesis is confirmed: putting a pure-MLE-on-load Lognormal into JMT's service-time slot, then asking JMT to add queueing, blows up the response time — especially at p90/p95 — because the input already encodes queueing inflation. The hybrid's "center from seq, spread from load" formulation correctly separates the disk-property piece (mean, K-shifted) from the under-load piece (σ), so JMT can re-derive queueing without redundancy.

Per-stat headline on m7a-io2 (the prediction target):

- exp16 grand |MRE| (mean of mean/median/p90/p95) on m7a-io2: **13.13 %**
- exp17 grand |MRE| (mean of mean/median/p90/p95) on m7a-io2: **31.30 %**

exp17 is **~2.4× worse** at predicting the unseen m7a-io2 machine.

The only place exp17 looks better is the per-class arithmetic *mean* across all 4 machines (15.6 % vs 22.6 %), and that's driven entirely by exp17 not under-predicting m7a-gp3's *mean* the way exp16 does. But the mean is the least informative summary statistic for service-time predictions (it's dominated by tail samples that PS handles imperfectly anyway). Looking at median / p90 / p95 — the percentiles practitioners use for SLO definitions — exp16 wins decisively.

## Decisions taken without consultation

1. Stored the m7i ps_mle calibration as `(mean_ms, sigma)` rather than `(mu, sigma)` so the iterative loop can keep working in mean-space (it scales `mean_ms` by `ratio^DAMPING`). At read time `_build_jsimg.py` recomputes `μ = ln(mean_ms) − σ²/2`. Mathematically equivalent to additively scaling μ by `ln(ratio)^DAMPING` if σ is held fixed (which it is during iteration). For m7a (the base + predicted), exp17 reads `exp1.mu` and `exp1.sigma` from `experiment-fits-load.json` directly — no shift.
2. K-prediction uses `k_fits = FITS_LOAD` with `k_center = "median"` for exp17 (i.e. K on load medians, same as exp16). This keeps exp17 in the "load-driven" universe end-to-end.
3. Reused the existing `_calibrate_m7i.py` damping + tolerance + max-iter settings (DAMPING=0.7, TOL=0.04, MAX_ITER=8) — converged in 8 iterations.
4. Did not modify any classical_cqrs artifacts; exp17 is m_cqrs-only as requested.
