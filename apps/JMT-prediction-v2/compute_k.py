#!/usr/bin/env python3
"""Compute K_op^io2 coefficients per (variation, class, DB station)
   from M7i.gp3 and M7i.io2 calibrated demands.

K = S^{M7i,io2} / S^{M7i,gp3}

AppService K is always 1.0 (CPU not scaled).
For DB stations: if M7i.gp3 demand is 0, K is set to 1.0 (class doesn't visit station).
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGICAL = ["Zapyty", "Stvor", "Onovl", "RC"]
STATIONS = ["AppService", "EventStore", "SnapshotDB", "ProjectionDB"]


def main():
    d = json.loads((HERE / "demands.json").read_text())
    K = {}
    for var in ["m_cqrs", "classical_cqrs"]:
        gp3 = d[f"m7i-gp3__{var}"]["stations"]
        io2 = d[f"m7i-io2__{var}"]["stations"]
        K[var] = {}
        for cls in LOGICAL:
            K[var][cls] = {}
            for st in STATIONS:
                base = gp3[cls][st]
                tgt = io2[cls][st]
                if st == "AppService":
                    K[var][cls][st] = 1.0
                elif base <= 1e-6:
                    K[var][cls][st] = 1.0
                else:
                    K[var][cls][st] = tgt / base
    (HERE / "K_io2.json").write_text(json.dumps(K, indent=2))
    print("Wrote K_io2.json")
    # print table
    for var in K:
        print(f"\n=== {var} ===")
        print(f"  {'class':10s} {'AppService':>10s} {'EventStore':>11s} {'SnapshotDB':>11s} {'ProjectionDB':>13s}")
        for cls in LOGICAL:
            row = K[var][cls]
            print(f"  {cls:10s} {row['AppService']:>10.3f} {row['EventStore']:>11.3f} {row['SnapshotDB']:>11.3f} {row['ProjectionDB']:>13.3f}")


if __name__ == "__main__":
    main()
