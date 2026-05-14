#!/usr/bin/env python3
"""V5 Phase 3 — User-attributable view metrics.

Combines:
  - JMT simulation results (analysis_v5.json)
  - Analytical bottleneck/utilization (analytical_metrics.json)

Produces a per-(machine, variation) summary with both system-total and
user-attributable views:

  X_max_total       — bottleneck throughput (jobs/s, includes RC)
  X_max_user        — user share of bottleneck = X_max_total × 350/625
  X_total_JMT       — sum of per-class system throughput from JMT
  X_user_JMT        — sum of throughput for {Q, Cr, Upd}
  U_total_per_station_JMT
  U_user_per_station — = U_total − U_rc_contribution_analytic (best proxy)
  bottleneck_station
  response_time_per_class — from JMT predicted (M7a.io2 only)

The user-attributable utilization subtracts the RC contribution computed
analytically (since JMT only reports system-level U, not per-class U at a
multi-class station).
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

LOGICAL = ["Zapyty", "Stvor", "Onovl", "RC"]
USER_CLASSES = ["Zapyty", "Stvor", "Onovl"]
STATIONS = ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]


def main():
    analytical = json.loads((HERE / "analytical_metrics.json").read_text())
    analysis = json.loads((HERE / "analysis_v5.json").read_text())

    dd = analysis.get("predicted", {}).get("data_driven", {})

    out = {}
    keys_order = [
        "m7i-gp3__m_cqrs", "m7i-gp3__classical_cqrs",
        "m7i-io2__m_cqrs", "m7i-io2__classical_cqrs",
        "m7a-gp3__m_cqrs", "m7a-gp3__classical_cqrs",
        "m7a-io2__m_cqrs", "m7a-io2__classical_cqrs",
    ]
    for key in keys_order:
        ana = analytical.get(key, {})
        jmt = dd.get(key, {})

        util_jmt = jmt.get("utilization_per_station", {})
        rc_contrib = ana.get("U_s_rc_contribution", {})
        u_user = {}
        for st in STATIONS:
            u_t = util_jmt.get(st, ana.get("U_s_total_analytic", {}).get(st, 0.0))
            u_rc = rc_contrib.get(st, 0.0)
            u_user[st] = max(0.0, u_t - u_rc)

        tp_class_sys = jmt.get("throughput_per_class_system", {})
        x_total = jmt.get("throughput_total_system", 0.0)
        x_user = sum(tp_class_sys.get(c, 0.0) for c in USER_CLASSES)

        out[key] = {
            "bottleneck_station": ana.get("bottleneck_station"),
            "rho_per_job_ms": ana.get("rho_per_job"),
            "X_max_total_analytic": ana.get("X_max_total"),
            "X_max_user_analytic": ana.get("X_max_user"),
            "X_total_JMT": x_total,
            "X_user_JMT": x_user,
            "X_per_class_JMT": tp_class_sys,
            "U_total_per_station_JMT": util_jmt,
            "U_total_per_station_analytic": ana.get("U_s_total_analytic", {}),
            "U_user_per_station": u_user,
            "U_user_per_station_analytic": ana.get("U_s_user_analytic", {}),
            "U_rc_contribution_analytic": rc_contrib,
            "response_time_per_class": jmt.get("response_time_per_class", {}),
        }

    (HERE / "user_view_results.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False)
    )

    print("\n========== USER-VIEW METRICS (Phase 3 — V5) ==========")
    print(f"{'key':30s}  {'bottle':12s}  {'Xmax_tot':>10s} {'Xmax_usr':>10s}  "
          f"{'U_app_u':>8s} {'U_es_u':>8s} {'U_sn_u':>8s} {'U_pr_u':>8s}")
    for key in keys_order:
        r = out[key]
        bn = (r["bottleneck_station"] or "")[:12]
        print(f"{key:30s}  {bn:12s}  "
              f"{r['X_max_total_analytic']:>10.1f} {r['X_max_user_analytic']:>10.1f}  "
              f"{r['U_user_per_station_analytic']['AppService']:>8.3f} "
              f"{r['U_user_per_station_analytic']['EventStore']:>8.3f} "
              f"{r['U_user_per_station_analytic']['SnapshotDB']:>8.3f} "
              f"{r['U_user_per_station_analytic']['ProjectionDB']:>8.3f}")

    print(f"\nWrote user_view_results.json")


if __name__ == "__main__":
    main()
