#!/usr/bin/env python3
"""Phase 0 — Distribution characterization (NEW in v5).

For each (machine, variation, class, station) compute:
  - descriptive statistics (n, mean, var, CV², skewness, kurtosis)
  - fit a wide set of candidate distributions (10+)
  - compute KS D-statistic + p-value, Anderson-Darling A², BIC for each
  - apply decision rule (CV²-aware hard rule + BIC soft rule)
  - emit ``distribution_choice.json`` and a markdown summary
    ``final_distribution_choice.md``

The data source is the per-request station-totals list (population of service
times observed at that station for that class), produced by extract_demands.py
(``per_request_totals`` field).

Candidate distributions (CV² awareness in comments):
  - Deterministic            (degenerate, kept for reference)
  - Exponential              CV² ≈ 1 ideal
  - Erlang-k                 CV² < 1 (k = ⌊1/CV²⌋, λ = k/μ)
  - Gamma                    CV² < 1 ideal but accepts any (MLE on continuous)
  - Lognormal                any CV² > 0
  - Weibull                  any CV² > 0 (MLE)
  - Hyperexponential 2-phase CV² > 1 only (balanced means)
  - Pareto                   CV² > 1 typical
  - Coxian-2                 flexible
  - Hypoexponential          CV² < 1 (k=2 phases, only if CV² in (0.5, 1))

Decision rule:
  1. Filter out mathematically impossible candidates by CV².
  2. Among valid candidates, pick the minimum-BIC.
  3. If runner-up has Δ BIC < 2 → add to ``candidates`` list (tie/ensemble).
"""

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy import stats
from scipy.optimize import minimize

HERE = Path(__file__).resolve().parent

LOGICAL = ["Zapyty", "Stvor", "Onovl", "RC"]
STATIONS = ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]

# Visit map (which classes visit which stations; consistent with topology in build_jsimg)
VISITS = {
    "Zapyty": {"AppService", "ProjectionDB"},
    "Stvor": {"AppService", "EventStore", "SnapshotDB"},
    "Onovl": {"AppService", "EventStore", "SnapshotDB"},
    "RC": {"AppService", "ProjectionDB"},
}


# -------------------------------------------------------------------------
# Fit functions: return (params_dict, log_likelihood, n_params)
# CDF functions: return F(x) given params
# -------------------------------------------------------------------------

def deterministic_fit(x):
    mu = float(np.mean(x))
    # Degenerate: log-likelihood is -inf; we use a tiny variance Gaussian
    # surrogate so BIC is comparable but always large.
    sigma_eps = max(1e-6, mu * 0.001)
    ll = float(np.sum(stats.norm.logpdf(x, loc=mu, scale=sigma_eps)))
    return {"t": mu}, ll, 1


def deterministic_cdf(x, p):
    return (np.asarray(x) >= p["t"]).astype(float)


def exp_fit(x):
    # MLE: λ = 1 / mean
    mu = float(np.mean(x))
    lam = 1.0 / mu
    ll = float(np.sum(stats.expon.logpdf(x, scale=mu)))
    return {"lambda": lam, "mean": mu}, ll, 1


def exp_cdf(x, p):
    return stats.expon.cdf(x, scale=1.0 / p["lambda"])


def erlang_fit(x):
    # Method of moments: k = round(1/CV²), lambda = k/mean
    mu = float(np.mean(x))
    var = float(np.var(x))
    if var <= 0 or mu <= 0:
        raise ValueError("zero variance")
    cv2 = var / (mu * mu)
    k = max(1, int(round(1.0 / cv2)))
    lam = k / mu
    ll = float(np.sum(stats.erlang.logpdf(x, a=k, scale=1.0 / lam)))
    return {"k": k, "lambda": lam}, ll, 2


def erlang_cdf(x, p):
    return stats.erlang.cdf(x, a=p["k"], scale=1.0 / p["lambda"])


def gamma_fit(x):
    # MLE via scipy
    a, loc, scale = stats.gamma.fit(x, floc=0)
    lam = 1.0 / scale
    ll = float(np.sum(stats.gamma.logpdf(x, a=a, scale=scale)))
    return {"alpha": a, "lambda": lam}, ll, 2


def gamma_cdf(x, p):
    return stats.gamma.cdf(x, a=p["alpha"], scale=1.0 / p["lambda"])


def lognormal_fit(x):
    # MLE via scipy
    shape, loc, scale = stats.lognorm.fit(x, floc=0)
    sigma = shape
    mu = math.log(scale)
    ll = float(np.sum(stats.lognorm.logpdf(x, s=shape, scale=scale)))
    return {"mu": mu, "sigma": sigma}, ll, 2


def lognormal_cdf(x, p):
    return stats.lognorm.cdf(x, s=p["sigma"], scale=math.exp(p["mu"]))


def weibull_fit(x):
    # MLE via scipy.stats.weibull_min
    c, loc, scale = stats.weibull_min.fit(x, floc=0)
    ll = float(np.sum(stats.weibull_min.logpdf(x, c=c, scale=scale)))
    # JMT Weibull: f(x) = (k/lambda) (x/lambda)^(k-1) exp(-(x/lambda)^k)
    # → JMT "alpha" = scale, "r" = c (shape).
    return {"alpha_scale": scale, "r_shape": c}, ll, 2


def weibull_cdf(x, p):
    return stats.weibull_min.cdf(x, c=p["r_shape"], scale=p["alpha_scale"])


def he_fit(x):
    """Two-phase balanced HyperExp. Calibrated to (mean, CV²) via moments.
    Returns the (p, lambda1, lambda2) parametrization JMT expects."""
    mu = float(np.mean(x))
    var = float(np.var(x))
    if mu <= 0:
        raise ValueError("bad mean")
    cv2 = var / (mu * mu)
    if cv2 <= 1.0:
        raise ValueError("HE requires CV² > 1")
    ratio = (cv2 - 1.0) / (cv2 + 1.0)
    p_w = 0.5 * (1.0 - math.sqrt(ratio))
    lam1 = (2.0 * p_w) / mu
    lam2 = (2.0 * (1.0 - p_w)) / mu

    # mixture log-likelihood
    pdf = p_w * stats.expon.pdf(x, scale=1.0 / lam1) + \
          (1 - p_w) * stats.expon.pdf(x, scale=1.0 / lam2)
    pdf = np.clip(pdf, 1e-300, None)
    ll = float(np.sum(np.log(pdf)))
    return {"p": p_w, "lambda1": lam1, "lambda2": lam2}, ll, 3


def he_cdf(x, p):
    cdf = p["p"] * stats.expon.cdf(x, scale=1.0 / p["lambda1"]) + \
          (1 - p["p"]) * stats.expon.cdf(x, scale=1.0 / p["lambda2"])
    return cdf


def pareto_fit(x):
    b, loc, scale = stats.pareto.fit(x, floc=0)
    ll = float(np.sum(stats.pareto.logpdf(x, b=b, scale=scale)))
    return {"alpha_shape": b, "k_scale": scale}, ll, 2


def pareto_cdf(x, p):
    return stats.pareto.cdf(x, b=p["alpha_shape"], scale=p["k_scale"])


def coxian_fit(x):
    """Coxian-2: two exponential stages in tandem with prob of skipping stage 2.
    Parametrization: lambda0 (rate of stage 0), lambda1 (rate of stage 1),
    phi0 (probability of skipping stage 1).

    Calibrate to (mean, CV²) via Marie's formula when CV² >= 0.5:
      assume lambda0 = lambda1 = 2 / (mu*(1 + p))  with p chosen so CV² matches
      (degenerate to Erlang-2 if phi0 = 0, exponential if phi0 = 1).
    For CV² < 0.5 the closed form requires distinct rates; we use a numerical
    moment match.
    """
    mu = float(np.mean(x))
    var = float(np.var(x))
    if mu <= 0:
        raise ValueError("bad mean")
    cv2 = var / (mu * mu)
    # Assume lambda0 = lambda1 = lam → mean = 2/lam * (1 - phi0/2)
    # We use a numerical fit: maximize log-likelihood over (lam0, lam1, phi0)
    def neg_ll(theta):
        lam0, lam1, phi0 = theta
        if lam0 <= 0 or lam1 <= 0 or phi0 < 0 or phi0 > 1:
            return 1e9
        # f(t) = phi0 * lam0 * exp(-lam0*t)
        #        + (1 - phi0) * (lam0*lam1/(lam1 - lam0)) * (exp(-lam0*t) - exp(-lam1*t))   if lam0 != lam1
        x_arr = np.asarray(x)
        if abs(lam1 - lam0) < 1e-9:
            # Convolution case: f(t) = (1-phi0)*lam^2*t*exp(-lam*t) + phi0*lam*exp(-lam*t)
            lam = lam0
            f = phi0 * lam * np.exp(-lam * x_arr) + \
                (1 - phi0) * (lam ** 2) * x_arr * np.exp(-lam * x_arr)
        else:
            f = phi0 * lam0 * np.exp(-lam0 * x_arr) + \
                (1 - phi0) * (lam0 * lam1 / (lam1 - lam0)) * \
                (np.exp(-lam0 * x_arr) - np.exp(-lam1 * x_arr))
        f = np.clip(f, 1e-300, None)
        return float(-np.sum(np.log(f)))

    # Initial: lam0 = lam1 = 2/mu, phi0 = max(0, 1 - (1/cv2)) or similar
    init_lam = 2.0 / mu
    init_phi = max(0.01, min(0.99, 2.0 * cv2 - 1.0))
    res = minimize(neg_ll, x0=[init_lam, init_lam * 1.1, init_phi],
                   method="Nelder-Mead", options={"xatol": 1e-6, "fatol": 1e-6,
                                                  "maxiter": 2000})
    if not res.success and res.fun > 1e8:
        raise ValueError("coxian fit failed")
    lam0, lam1, phi0 = res.x
    if lam0 <= 0 or lam1 <= 0:
        raise ValueError("invalid coxian params")
    phi0 = max(0.0, min(1.0, phi0))
    ll = -float(res.fun)
    return {"lambda0": lam0, "lambda1": lam1, "phi0": phi0}, ll, 3


def coxian_cdf(x, p):
    lam0, lam1, phi0 = p["lambda0"], p["lambda1"], p["phi0"]
    x_arr = np.asarray(x)
    # F(t) = 1 - phi0*exp(-lam0*t)
    #         - (1-phi0)/(lam1 - lam0) * (lam1*exp(-lam0*t) - lam0*exp(-lam1*t))
    if abs(lam1 - lam0) < 1e-9:
        lam = lam0
        cdf = 1.0 - phi0 * np.exp(-lam * x_arr) - \
              (1 - phi0) * (1 - (1 + lam * x_arr) * np.exp(-lam * x_arr))
    else:
        cdf = 1.0 - phi0 * np.exp(-lam0 * x_arr) - \
              (1 - phi0) / (lam1 - lam0) * \
              (lam1 * np.exp(-lam0 * x_arr) - lam0 * np.exp(-lam1 * x_arr))
    return cdf


def hypoexp_fit(x):
    """Hypoexponential-2: sum of two independent exponentials with rates lam1,
    lam2 (lam1 ≠ lam2). MLE via Nelder-Mead.

    CV² range: (0.5, 1) for distinct rates; CV² = 0.5 only if lam1 = lam2.
    """
    mu = float(np.mean(x))
    var = float(np.var(x))
    if mu <= 0:
        raise ValueError("bad mean")
    cv2 = var / (mu * mu)
    if cv2 >= 1.0 or cv2 <= 0.5 + 1e-9:
        raise ValueError("Hypoexp-2 needs 0.5 < CV² < 1")
    # init: equal rates (Erlang-2 with lam = 2/mu)
    init = [1.5 / mu, 0.5 / mu]

    def neg_ll(theta):
        lam1, lam2 = theta
        if lam1 <= 0 or lam2 <= 0 or abs(lam1 - lam2) < 1e-6:
            return 1e9
        x_arr = np.asarray(x)
        f = (lam1 * lam2 / (lam1 - lam2)) * (np.exp(-lam2 * x_arr) - np.exp(-lam1 * x_arr))
        f = np.clip(f, 1e-300, None)
        return float(-np.sum(np.log(f)))

    res = minimize(neg_ll, x0=init, method="Nelder-Mead",
                   options={"xatol": 1e-6, "fatol": 1e-6, "maxiter": 2000})
    if res.fun > 1e8:
        raise ValueError("hypoexp fit failed")
    lam1, lam2 = res.x
    if lam1 <= 0 or lam2 <= 0:
        raise ValueError("invalid hypoexp params")
    ll = -float(res.fun)
    return {"lambda1": lam1, "lambda2": lam2}, ll, 2


def hypoexp_cdf(x, p):
    lam1, lam2 = p["lambda1"], p["lambda2"]
    x_arr = np.asarray(x)
    F = 1.0 - (lam2 / (lam2 - lam1)) * np.exp(-lam1 * x_arr) + \
        (lam1 / (lam2 - lam1)) * np.exp(-lam2 * x_arr)
    return F


# -------------------------------------------------------------------------
# Registry
# -------------------------------------------------------------------------

DISTRIBUTIONS = [
    ("Deterministic", deterministic_fit, deterministic_cdf, None),
    ("Exponential", exp_fit, exp_cdf, None),
    ("Erlang-k", erlang_fit, erlang_cdf, "cv2_lt_1"),
    ("Gamma", gamma_fit, gamma_cdf, None),
    ("Lognormal", lognormal_fit, lognormal_cdf, None),
    ("Weibull", weibull_fit, weibull_cdf, None),
    ("Hyperexponential", he_fit, he_cdf, "cv2_gt_1"),
    ("Pareto", pareto_fit, pareto_cdf, None),
    ("Coxian-2", coxian_fit, coxian_cdf, None),
    ("Hypoexponential-2", hypoexp_fit, hypoexp_cdf, "cv2_05_to_1"),
]


def hard_rule_skip(name, constraint, cv2):
    """Return True if the candidate is mathematically inappropriate for cv2."""
    if constraint == "cv2_lt_1" and cv2 >= 1.0:
        return True
    if constraint == "cv2_gt_1" and cv2 <= 1.01:
        return True
    if constraint == "cv2_05_to_1" and (cv2 <= 0.5 or cv2 >= 1.0):
        return True
    # Erlang-k with k=1 reduces to Exp; skip if cv2 is very close to 1.
    if constraint == "cv2_lt_1" and cv2 > 0.95:
        return True
    return False


def anderson_darling(samples, cdf_fn, params):
    """Compute Anderson-Darling A² statistic for the given CDF."""
    n = len(samples)
    s = sorted(samples)
    F = np.clip(cdf_fn(np.asarray(s), params), 1e-10, 1 - 1e-10)
    i = np.arange(1, n + 1)
    a2 = -n - (1.0 / n) * np.sum((2 * i - 1) * (np.log(F) + np.log(1 - F[::-1])))
    return float(a2)


def fit_all(samples):
    """Fit every candidate distribution and return list of {name, params, ks, ad, bic, ll, n_params, status}."""
    samples = [float(x) for x in samples if x is not None and x > 0]
    if len(samples) < 30:
        return None
    arr = np.asarray(samples)
    n = len(arr)
    mu = float(np.mean(arr))
    var = float(np.var(arr))
    cv2 = var / (mu * mu) if mu > 0 else 0.0

    desc = {
        "n": n,
        "mean": mu,
        "var": var,
        "cv2": cv2,
        "skewness": float(stats.skew(arr)),
        "kurtosis": float(stats.kurtosis(arr)),
        "p50": float(np.percentile(arr, 50)),
        "p95": float(np.percentile(arr, 95)),
        "p99": float(np.percentile(arr, 99)),
    }

    fits = []
    for name, fit_fn, cdf_fn, constraint in DISTRIBUTIONS:
        if hard_rule_skip(name, constraint, cv2):
            fits.append({"distribution": name, "status": "skipped_by_cv2",
                         "constraint": constraint})
            continue
        try:
            params, ll, k = fit_fn(arr)
            # KS test
            ks_d, ks_p = stats.kstest(arr, lambda x: cdf_fn(x, params))
            try:
                ad = anderson_darling(arr, cdf_fn, params)
            except Exception:
                ad = float("nan")
            bic = k * math.log(n) - 2 * ll
            aic = 2 * k - 2 * ll
            fits.append({
                "distribution": name,
                "status": "ok",
                "params": params,
                "log_likelihood": ll,
                "n_params": k,
                "ks_d": float(ks_d),
                "ks_p": float(ks_p),
                "ad": ad,
                "bic": bic,
                "aic": aic,
            })
        except Exception as e:
            fits.append({"distribution": name, "status": "error",
                         "error": str(e)})

    # Pick best by BIC among OK ones
    ok = [f for f in fits if f.get("status") == "ok"]
    if not ok:
        return {"descriptive": desc, "fits": fits, "best": None,
                "candidates": []}
    best = min(ok, key=lambda f: f["bic"])
    close = [f["distribution"] for f in ok if (f["bic"] - best["bic"]) < 2.0]
    return {
        "descriptive": desc,
        "fits": fits,
        "best": best["distribution"],
        "best_bic": best["bic"],
        "candidates": close,
    }


# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------

def main():
    demands_path = HERE / "demands.json"
    data = json.loads(demands_path.read_text())

    out = {}
    win_counter = defaultdict(int)
    candidate_counter = defaultdict(int)
    for key, machine_data in data.items():
        per_req = machine_data.get("per_request_totals", {})
        out[key] = {}
        for cls in LOGICAL:
            out[key][cls] = {}
            for st in STATIONS:
                if st not in VISITS[cls]:
                    continue
                samples = per_req.get(cls, {}).get(st, [])
                res = fit_all(samples)
                if res is None:
                    out[key][cls][st] = {"status": "too_few_samples",
                                         "n": len(samples)}
                    continue
                out[key][cls][st] = res
                if res["best"]:
                    win_counter[res["best"]] += 1
                for c in res["candidates"]:
                    candidate_counter[c] += 1

    # Write JSON
    (HERE / "distribution_choice.json").write_text(
        json.dumps(out, indent=2, default=str), encoding="utf-8"
    )

    # Summary table
    print(f"\n========== PHASE 0 — Distribution Goodness of Fit ==========")
    print(f"\nWin counts (minimum-BIC) across {sum(win_counter.values())} "
          f"(class, station) pairs over 6 machine-variations:\n")
    for d, c in sorted(win_counter.items(), key=lambda kv: -kv[1]):
        print(f"  {d:22s}: {c}")
    print(f"\nIn-tolerance (Δ BIC < 2) candidate counts:\n")
    for d, c in sorted(candidate_counter.items(), key=lambda kv: -kv[1]):
        print(f"  {d:22s}: {c}")

    # Decide homogeneous vs heterogeneous
    total = sum(win_counter.values())
    top, top_count = (max(win_counter.items(), key=lambda kv: kv[1])
                      if win_counter else ("Exponential", 0))
    homogeneous = (top_count / total >= 0.6) if total else False

    # Write markdown summary
    md = ["# Phase 0 — Distribution choice rationale\n",
          "Generated by `characterize_distributions.py` from `distribution_choice.json`.\n",
          ""]
    md.append(f"## Winner counts (minimum-BIC per (class, station) pair)\n")
    md.append("")
    md.append("| Distribution | Count | Share |")
    md.append("|---|---:|---:|")
    for d, c in sorted(win_counter.items(), key=lambda kv: -kv[1]):
        md.append(f"| {d} | {c} | {c/total*100:.1f}% |")
    md.append("")

    md.append(f"## Strategy decision\n")
    if homogeneous:
        md.append(f"**Homogeneous**: `{top}` wins {top_count}/{total} ({top_count/total*100:.1f}%) of pairs. "
                  f"Use `{top}` everywhere in build_jsimg.py.\n")
    else:
        md.append(f"**Heterogeneous**: no single distribution dominates "
                  f"(top: `{top}` at {top_count}/{total} = {top_count/total*100:.1f}%). "
                  f"Use the per-pair winner from `distribution_choice.json`.\n")
    md.append("")
    md.append(f"## Per-pair detail (M7a.gp3 — used as basis for M7a.io2 prediction)\n")
    for var in ("m_cqrs", "classical_cqrs"):
        key = f"m7a-gp3__{var}"
        if key not in out:
            continue
        md.append(f"\n### {key}\n")
        md.append("| Class | Station | n | mean (ms) | CV² | Best | BIC | KS p |")
        md.append("|---|---|---:|---:|---:|---|---:|---:|")
        for cls in LOGICAL:
            for st in STATIONS:
                cell = out[key].get(cls, {}).get(st)
                if not cell or "fits" not in cell:
                    continue
                d = cell["descriptive"]
                best = cell["best"]
                bic = cell.get("best_bic", float("nan"))
                # find KS p for best
                ks_p = float("nan")
                for f in cell["fits"]:
                    if f.get("distribution") == best and f.get("status") == "ok":
                        ks_p = f["ks_p"]
                        break
                md.append(f"| {cls} | {st} | {d['n']} | {d['mean']:.3f} | "
                          f"{d['cv2']:.3f} | {best} | {bic:.1f} | {ks_p:.3g} |")

    (HERE / "final_distribution_choice.md").write_text("\n".join(md))
    print(f"\nWrote {HERE/'distribution_choice.json'} and {HERE/'final_distribution_choice.md'}")
    print(f"\nDecision: {'HOMOGENEOUS' if homogeneous else 'HETEROGENEOUS'} "
          f"(top: {top}, {top_count}/{total})")


if __name__ == "__main__":
    main()
