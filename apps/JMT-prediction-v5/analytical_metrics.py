#!/usr/bin/env python3
"""V5 Phase 3 — Analytical metrics (without simulation).

For each (machine, variation) we compute:
  - X_max_total (bottleneck throughput in jobs/sec)
  - X_max_user  (= X_max_total × 350 / 625)
  - U_s_total_analytic per station (utilization at target load 625 j/s)
  - U_s_user_analytic per station (utilization considering only user classes)
  - bottleneck_station (argmax of per-station load)

Formulas (from plan §Phase 3):

  total_lambda = sum(λ_c) = 625      π_c = λ_c / total_lambda
  servers      = {Сервер: 2, Сховище подій: 1, SnapshotDB: 1, ProjectionDB: 1}

  ρ_per_job = max_s [ Σ_c π_c × D_{c,s} / m_s ]    # ms × jobs/s normalised
  X_max_total = 1 / ρ_per_job                       # jobs/s

  U_s_total_analytic = (Σ_c λ_c × D_{c,s}) / 1000 / m_s        # D in ms
  U_s_user_analytic  = (Σ_{c ∈ user} λ_c × D_{c,s}) / 1000 / m_s

For the predicted M7a.io2 we use K-scaled demands; for the 6 baselines we use
the calibrated Sequential demands directly.
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

LOGICAL = ["Zapyty", "Stvor", "Onovl", "RC"]
USER_CLASSES = ["Zapyty", "Stvor", "Onovl"]
STATIONS = ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]
SERVERS = {"AppService": 2, "EventStore": 1, "SnapshotDB": 1, "ProjectionDB": 1}

# Target load for capacity analysis (V5: RC = 275)
TARGET_LAMBDA = {
    "Zapyty": 100.0,
    "Stvor": 100.0,
    "Onovl": 150.0,
    "RC": 275.0,
}
TOTAL_LAMBDA = sum(TARGET_LAMBDA.values())  # = 625
USER_LAMBDA = sum(TARGET_LAMBDA[c] for c in USER_CLASSES)  # = 350


def analytical_for_demands(demands, lambdas=TARGET_LAMBDA):
    """Compute X_max and U per station from demands {class: {station: D_ms}}.

    Returns:
      bottleneck_station, X_max_total, X_max_user,
      U_total_per_station, U_user_per_station, rho_per_job
    """
    total_lambda = sum(lambdas.values())
    pi = {c: lambdas[c] / total_lambda for c in lambdas}

    # ρ_per_job = max_s [ Σ_c π_c × D_{c,s} / 1000 / m_s ]   (ms → s)
    rho_per_station = {}
    for st in STATIONS:
        m_s = SERVERS[st]
        rho = sum(pi[c] * demands.get(c, {}).get(st, 0.0) / 1000.0
                  for c in LOGICAL) / m_s
        rho_per_station[st] = rho

    bottleneck = max(rho_per_station, key=lambda s: rho_per_station[s])
    rho_per_job = rho_per_station[bottleneck]
    X_max_total = (1.0 / rho_per_job) if rho_per_job > 0 else float("inf")
    X_max_user = X_max_total * (USER_LAMBDA / total_lambda)

    # U at target lambdas
    U_total = {}
    U_user = {}
    for st in STATIONS:
        m_s = SERVERS[st]
        u_t = sum(lambdas.get(c, 0.0) * demands.get(c, {}).get(st, 0.0) / 1000.0
                  for c in LOGICAL) / m_s
        u_u = sum(lambdas.get(c, 0.0) * demands.get(c, {}).get(st, 0.0) / 1000.0
                  for c in USER_CLASSES) / m_s
        U_total[st] = u_t
        U_user[st] = u_u

    return {
        "bottleneck_station": bottleneck,
        "rho_per_job": rho_per_job,
        "rho_per_station": rho_per_station,
        "X_max_total": X_max_total,
        "X_max_user": X_max_user,
        "U_s_total_analytic": U_total,
        "U_s_user_analytic": U_user,
        "U_s_rc_contribution": {st: U_total[st] - U_user[st] for st in STATIONS},
        "target_lambdas": dict(lambdas),
    }


def main():
    demands_path = HERE / "demands.json"
    data = json.loads(demands_path.read_text())

    K_path = HERE / "K_io2.json"
    K = json.loads(K_path.read_text()) if K_path.exists() else {}

    out = {}

    # 6 calibrated baselines: use their own demands at TARGET load
    for key, payload in data.items():
        demands = payload["stations"]
        res = analytical_for_demands(demands, lambdas=TARGET_LAMBDA)
        out[key] = res

    # 2 predicted M7a.io2: K-scaled from M7a.gp3
    if K:
        for var in ("m_cqrs", "classical_cqrs"):
            gp3 = data[f"m7a-gp3__{var}"]["stations"]
            pred = {}
            for c in LOGICAL:
                pred[c] = {}
                for st in STATIONS:
                    pred[c][st] = gp3[c][st] * K[var][c][st]
            res = analytical_for_demands(pred, lambdas=TARGET_LAMBDA)
            out[f"m7a-io2__{var}"] = res

    (HERE / "analytical_metrics.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False)
    )

    # Print summary
    print("\n========== ANALYTICAL METRICS (target λ = Q100 Cr100 Upd150 RC275) ==========")
    keys_order = [
        "m7i-gp3__m_cqrs", "m7i-gp3__classical_cqrs",
        "m7i-io2__m_cqrs", "m7i-io2__classical_cqrs",
        "m7a-gp3__m_cqrs", "m7a-gp3__classical_cqrs",
        "m7a-io2__m_cqrs", "m7a-io2__classical_cqrs",
    ]
    print(f"{'key':30s}  {'bottleneck':14s}  {'X_max_tot':>10s}  {'X_max_usr':>10s}  "
          f"{'rho':>6s}  {'U_app':>6s} {'U_es':>6s} {'U_sn':>6s} {'U_pr':>6s}")
    for k in keys_order:
        if k not in out:
            continue
        r = out[k]
        print(f"{k:30s}  {r['bottleneck_station']:14s}  "
              f"{r['X_max_total']:>10.1f}  {r['X_max_user']:>10.1f}  "
              f"{r['rho_per_job']*1000:>6.3f}  "
              f"{r['U_s_total_analytic']['AppService']:>6.3f} "
              f"{r['U_s_total_analytic']['EventStore']:>6.3f} "
              f"{r['U_s_total_analytic']['SnapshotDB']:>6.3f} "
              f"{r['U_s_total_analytic']['ProjectionDB']:>6.3f}")

    print(f"\nWrote analytical_metrics.json")


if __name__ == "__main__":
    main()
