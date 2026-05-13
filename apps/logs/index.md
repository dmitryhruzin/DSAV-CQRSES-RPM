<!-- markdownlint-disable MD024 MD040 -->

# Experiment Summary

## M7i.large gp3

### Characteristics

#### Price

0,1008 USD

#### CPU

```
admin@ip-172-31-18-67:~$ lscpu
Architecture:                x86_64
  CPU op-mode(s):            32-bit, 64-bit
  Address sizes:             46 bits physical, 48 bits virtual
  Byte Order:                Little Endian
CPU(s):                      2
  On-line CPU(s) list:       0,1
Vendor ID:                   GenuineIntel
  Model name:                Intel(R) Xeon(R) Platinum 8488C
    CPU family:              6
    Model:                   143
    Thread(s) per core:      2
    Core(s) per socket:      1
    Socket(s):               1
    Stepping:                8
    BogoMIPS:                4800.00
Virtualization features:
  Hypervisor vendor:         KVM
  Virtualization type:       full
Caches (sum of all):
  L1d:                       48 KiB (1 instance)
  L1i:                       32 KiB (1 instance)
  L2:                        2 MiB (1 instance)
  L3:                        105 MiB (1 instance)
NUMA:
  NUMA node(s):              1
  NUMA node0 CPU(s):         0,1
```

#### Memory

```
admin@ip-172-31-18-67:~$ sudo dmidecode -t memory
# dmidecode 3.4
Getting SMBIOS data from sysfs.
SMBIOS 2.7 present.

Handle 0x0008, DMI type 16, 23 bytes
Physical Memory Array
        Location: System Board Or Motherboard
        Use: System Memory
        Error Correction Type: Unknown
        Maximum Capacity: 8 GB
        Error Information Handle: Not Provided
        Number Of Devices: 1

Handle 0x0009, DMI type 17, 34 bytes
Memory Device
        Array Handle: 0x0008
        Error Information Handle: Not Provided
        Total Width: 80 bits
        Data Width: 64 bits
        Size: 8 GB
        Form Factor: DIMM
        Set: None
        Locator: Not Specified
        Bank Locator: Not Specified
        Type: DDR5
        Type Detail: Unknown Fast-paged RAMBus Window DRAM
        Speed: 4800 MT/s
        Manufacturer: Not Specified
        Serial Number: Not Specified
        Asset Tag: Not Specified
        Part Number: Not Specified
        Rank: Unknown
        Configured Memory Speed: Unknown
```

#### Disk

gp3

### Metrics

#### mCQRS Sequential

```
Source: ../logs/m7i-gp3-m_cqrs-seq.log
Parsed: 36820 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     3.96     4.00     6.00     3.00    25.00
  command.execute                       600     3.21     2.92     4.64     2.27    24.66
  db.eventstore.write                   600     0.33     0.29     0.43     0.19    14.03
  db.snapshot.read                      200     0.47     0.43     0.63     0.27     4.98
  db.snapshot.write                     600     0.43     0.34     0.53     0.26    15.95
  event.publishAll                      600     0.12     0.11     0.16     0.08     1.18
  event.handle                          600     2.34     1.82     4.88     1.30     9.65
  db.projection.write                   600     1.55     1.23     3.49     0.68     6.06
★ eventual_consistency_lag              600     1.81     1.81     2.93     0.55     5.11

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2100     4.26     4.00     6.00     3.00    30.00
  command.execute                      2100     3.56     3.22     5.36     2.40    29.43
  db.eventstore.write                  2100     0.28     0.23     0.38     0.18    17.84
  db.snapshot.read                     2100     0.56     0.44     0.84     0.28    19.38
  db.snapshot.write                    2100     0.37     0.32     0.46     0.25    14.62
  event.publishAll                     2100     0.10     0.10     0.14     0.07     0.65
  event.handle                         2100    12.82     2.57     7.19     2.06  1016.99
  db.projection.read                   2100     0.51     0.28     2.11     0.22    22.97
  db.projection.write                  2100     0.33     0.23     0.73     0.19    18.88
★ eventual_consistency_lag             2100    12.31     2.41     4.69     1.16  1009.11

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     1.83     2.00     3.00     1.00    28.00
  query.execute                        1300     1.14     1.07     1.71     0.47    26.90
  db.projection.read                   1300     0.72     0.66     1.00     0.29    22.83
```

#### mCQRS Load

```
Source: ../logs/m7i-gp3-m_cqrs-load.log
Parsed: 402125 log lines, 43421 unique req-ids, 43421 requests with http.request span

═══ POST  (create commands) ─ 12319 total / 12319 ok / 0 failed ═══
  error rate: 0 / 12319  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12319    19.80     6.00    89.00     2.00   451.00
  command.execute                     12319    19.30     5.94    87.69     1.58   450.29
  db.eventstore.write                 12319     1.30     0.81     3.95     0.16    23.67
  db.snapshot.read                     4131     1.63     1.17     4.39     0.25    20.76
  db.snapshot.write                   12319     1.31     0.84     3.84     0.21    30.59
  event.publishAll                    12319     0.06     0.06     0.10     0.03     3.56
  event.handle                        12319    14.03     2.98    67.99     0.98   466.25
  db.projection.write                 12319     3.26     2.45     8.07     0.64    70.40
★ eventual_consistency_lag            12319    11.82     2.64    63.03     0.18   245.08

═══ PATCH (update commands) ─ 18740 total / 18566 ok / 174 failed ═══
  error rate: 174 / 18740  (0.93%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 18566    23.20     7.00    56.00     2.00   453.00
  command.execute                     18566    22.75     6.46    55.68     1.92   452.35
  db.eventstore.write                 18566     1.18     0.74     3.53     0.15    28.99
  db.snapshot.read                    18566     1.59     1.15     4.21     0.25    30.14
  db.snapshot.write                   18566     1.24     0.83     3.57     0.21    27.63
  event.publishAll                    18566     0.05     0.05     0.07     0.02     2.57
  event.handle                        18566    20.33     6.43    45.19     1.60  3995.29
  db.projection.read                  18566     1.95     1.23     6.18     0.21    69.23
  db.projection.write                 18566     1.76     1.07     5.69     0.19    30.86
★ eventual_consistency_lag            18566    18.76     6.05    40.77     0.78  3995.29

═══ GET   (queries) ─ 12362 total / 12362 ok / 0 failed ═══
  error rate: 0 / 12362  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12362    15.09     3.00    57.00     0.00   439.00
  query.execute                       12362    14.63     2.10    56.30     0.35   437.79
  db.projection.read                  12362     2.60     1.84     7.33     0.25    33.44
```

#### Classical CQRS Sequential

```
Source: ../logs/m7i-gp3-classical_cqrs-seq.log
Parsed: 43311 log lines, 4101 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     3.19     3.00     5.00     2.00    29.00
  command.execute                       600     2.42     1.97     3.69     1.34    28.11
  db.eventstore.read                    200     0.45     0.37     0.62     0.30     3.00
  db.eventstore.write                   600     1.35     1.33     1.61     0.82     5.07
  db.snapshot.read                      200     0.62     0.44     0.64     0.30    25.23
  event.publishAll                      600     0.12     0.12     0.17     0.08     0.41
  event.handle                          600     2.36     1.80     4.93     1.35    23.92
  db.projection.write                   600     1.66     1.26     3.68     0.76    22.38
★ eventual_consistency_lag              600     1.88     1.79     3.12     0.41    13.67

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2200     4.25     4.00     6.00     3.00    28.00
  command.execute                      2200     3.59     3.15     5.13     2.28    27.60
  db.eventstore.read                   2200     0.45     0.37     0.69     0.26    21.49
  db.eventstore.write                  2200     1.24     1.24     1.44     0.73     6.23
  db.snapshot.read                     2200     0.58     0.46     0.85     0.28    19.63
  db.snapshot.write                     400     1.16     1.17     1.36     0.67     2.51
  event.publishAll                     2200     0.12     0.11     0.15     0.07     2.60
  event.handle                         2200     7.74     2.53     7.00     1.87  1009.89
  db.projection.read                   2200     0.49     0.28     2.00     0.21    19.23
  db.projection.write                  2200     0.31     0.23     0.64     0.18    12.45
★ eventual_consistency_lag             2200     7.31     2.48     4.58     1.17  1004.43

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     1.76     2.00     3.00     1.00    14.00
  query.execute                        1300     1.07     1.03     1.59     0.50    12.82
  db.projection.read                   1300     0.67     0.65     0.93     0.30     7.11
```

#### Classical CQRS Load

```
Source: ../logs/m7i-gp3-classical_cqrs-load.log
Parsed: 443210 log lines, 42995 unique req-ids, 42995 requests with http.request span

═══ POST  (create commands) ─ 12276 total / 12276 ok / 0 failed ═══
  error rate: 0 / 12276  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12276     9.47     3.00    15.00     1.00   534.00
  command.execute                     12276     8.98     2.99    14.34     0.91   532.74
  db.eventstore.read                   4169     1.37     0.80     4.25     0.24    38.15
  db.eventstore.write                 12276     2.61     1.94     6.25     0.66    39.66
  db.snapshot.read                     4169     1.70     1.14     4.86     0.26    25.94
  event.publishAll                    12276     0.07     0.06     0.10     0.04     3.97
  event.handle                        12276     6.82     2.65    11.57     0.93   393.73
  db.projection.write                 12276     3.03     2.21     7.68     0.62    38.38
★ eventual_consistency_lag            12276     5.69     2.40     8.87     0.06   223.58

═══ PATCH (update commands) ─ 18576 total / 18493 ok / 83 failed ═══
  error rate: 83 / 18576  (0.45%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 18493    13.79     5.00    19.00     2.00   674.00
  command.execute                     18493    13.36     5.07    18.59     1.83   673.14
  db.eventstore.read                  18493     1.30     0.80     3.90     0.24    30.14
  db.eventstore.write                 18493     2.44     1.89     5.70     0.64    38.84
  db.snapshot.read                    18493     1.64     1.11     4.55     0.27    35.11
  db.snapshot.write                    2901     2.49     1.97     5.65     0.64    29.81
  event.publishAll                    18493     0.06     0.05     0.08     0.03     1.15
  event.handle                        18493    14.30     5.52    22.60     1.57  3471.06
  db.projection.read                  18493     1.58     0.98     4.82     0.21    41.72
  db.projection.write                 18493     1.42     0.90     4.27     0.19    45.37
★ eventual_consistency_lag            18493    13.41     5.11    19.91     0.83  3470.65

═══ GET   (queries) ─ 12143 total / 12143 ok / 0 failed ═══
  error rate: 0 / 12143  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12143     6.71     2.00    10.00     0.00   383.00
  query.execute                       12143     6.27     1.54     9.65     0.36   382.46
  db.projection.read                  12143     2.14     1.32     6.57     0.24    44.73
```

## M7a.large gp3

### Characteristics

#### Price

0,11592 USD

#### CPU

```
admin@ip-172-31-19-247:~$ lscpu
Architecture:                x86_64
  CPU op-mode(s):            32-bit, 64-bit
  Address sizes:             48 bits physical, 48 bits virtual
  Byte Order:                Little Endian
CPU(s):                      2
  On-line CPU(s) list:       0,1
Vendor ID:                   AuthenticAMD
  Model name:                AMD EPYC 9R14
    CPU family:              25
    Model:                   17
    Thread(s) per core:      1
    Core(s) per socket:      2
    Socket(s):               1
    Stepping:                1
    BogoMIPS:                5199.99
Virtualization features:
  Hypervisor vendor:         KVM
  Virtualization type:       full
Caches (sum of all):
  L1d:                       64 KiB (2 instances)
  L1i:                       64 KiB (2 instances)
  L2:                        2 MiB (2 instances)
  L3:                        8 MiB (1 instance)
NUMA:
  NUMA node(s):              1
  NUMA node0 CPU(s):         0,1
```

#### Memory

```
admin@ip-172-31-19-247:~$ sudo dmidecode -t memory
# dmidecode 3.4
Getting SMBIOS data from sysfs.
SMBIOS 2.7 present.

Handle 0x0008, DMI type 16, 23 bytes
Physical Memory Array
        Location: System Board Or Motherboard
        Use: System Memory
        Error Correction Type: Unknown
        Maximum Capacity: 8 GB
        Error Information Handle: Not Provided
        Number Of Devices: 1

Handle 0x0009, DMI type 17, 34 bytes
Memory Device
        Array Handle: 0x0008
        Error Information Handle: Not Provided
        Total Width: 80 bits
        Data Width: 64 bits
        Size: 8 GB
        Form Factor: DIMM
        Set: None
        Locator: Not Specified
        Bank Locator: Not Specified
        Type: DDR5
        Type Detail: Unknown Fast-paged RAMBus Window DRAM
        Speed: 4800 MT/s
        Manufacturer: Not Specified
        Serial Number: Not Specified
        Asset Tag: Not Specified
        Part Number: Not Specified
        Rank: Unknown
        Configured Memory Speed: Unknown
```

#### Disk

gp3

### Metrics

#### mCQRS Sequential

```
Source: ../logs/m7a-gp3-m_cqrs-seq.log
Parsed: 36840 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     3.58     3.00     5.00     2.00    17.00
  command.execute                       600     2.90     2.67     4.25     2.11    15.42
  db.eventstore.write                   600     0.29     0.27     0.35     0.17     4.93
  db.snapshot.read                      200     0.49     0.41     0.56     0.37     4.61
  db.snapshot.write                     600     0.35     0.27     0.49     0.20    12.49
  event.publishAll                      600     0.10     0.09     0.13     0.07     0.66
  event.handle                          600     2.14     1.62     4.53     1.37     8.60
  db.projection.write                   600     1.54     1.15     3.42     0.95     6.07
★ eventual_consistency_lag              600     1.64     1.67     2.72     0.55     5.85

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2100     3.68     3.00     5.00     2.00    24.00
  command.execute                      2100     3.09     2.87     4.40     2.31    19.06
  db.eventstore.write                  2100     0.21     0.19     0.27     0.16     4.01
  db.snapshot.read                     2100     0.52     0.42     0.79     0.36    11.23
  db.snapshot.write                    2100     0.29     0.26     0.31     0.19    11.93
  event.publishAll                     2100     0.09     0.08     0.11     0.04     2.01
  event.handle                         2100    21.84     2.15     6.42     1.73  1011.79
  db.projection.read                   2100     0.41     0.21     1.84     0.15     9.58
  db.projection.write                  2100     0.24     0.17     0.49     0.13    10.16
★ eventual_consistency_lag             2100    21.44     2.19     4.29     0.90  1007.75

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     1.58     2.00     2.00     1.00     6.00
  query.execute                        1300     0.96     0.91     1.42     0.56     4.45
  db.projection.read                   1300     0.62     0.56     0.93     0.35     3.94
```

#### mCQRS Load

```
Source: ../logs/m7a-gp3-m_cqrs-load.log
Parsed: 396187 log lines, 42839 unique req-ids, 42839 requests with http.request span

═══ POST  (create commands) ─ 12314 total / 12314 ok / 0 failed ═══
  error rate: 0 / 12314  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12314     8.85     3.00    14.00     1.00   331.00
  command.execute                     12314     8.49     2.96    14.04     1.31   330.75
  db.eventstore.write                 12314     0.54     0.27     1.85     0.13    27.57
  db.snapshot.read                     4157     0.73     0.39     2.40     0.16    19.74
  db.snapshot.write                   12314     0.59     0.32     1.85     0.16    26.81
  event.publishAll                    12314     0.04     0.04     0.06     0.02     3.30
  event.handle                        12314     6.50     1.97     7.88     0.84   363.66
  db.projection.write                 12314     2.16     1.65     4.60     0.60    47.44
★ eventual_consistency_lag            12314     5.45     1.85     5.98    -0.03   186.82

═══ PATCH (update commands) ─ 18222 total / 18124 ok / 98 failed ═══
  error rate: 98 / 18222  (0.54%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 18124     9.94     4.00    12.00     1.00   331.00
  command.execute                     18124     9.62     3.19    11.73     1.54   330.78
  db.eventstore.write                 18124     0.48     0.25     1.59     0.12    27.45
  db.snapshot.read                    18124     0.68     0.39     2.08     0.16    26.03
  db.snapshot.write                   18124     0.55     0.30     1.66     0.15    20.87
  event.publishAll                    18124     0.03     0.03     0.05     0.02     2.55
  event.handle                        18124     9.05     3.12    12.96     1.32  3099.48
  db.projection.read                  18124     0.73     0.44     2.24     0.15    53.42
  db.projection.write                 18124     0.69     0.40     2.14     0.14    30.56
★ eventual_consistency_lag            18124     8.32     3.01    11.17     0.56  3099.05

═══ GET   (queries) ─ 12303 total / 12303 ok / 0 failed ═══
  error rate: 0 / 12303  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12303     6.49     1.00     6.00     0.00   324.00
  query.execute                       12303     6.18     0.75     5.59     0.24   323.02
  db.projection.read                  12303     1.01     0.61     3.18     0.16    21.76
```

#### Classical CQRS Sequential

```
Source: ../logs/m7a-gp3-classical_cqrs-seq.log
Parsed: 43315 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     2.84     3.00     4.00     1.00    17.00
  command.execute                       600     2.25     1.90     3.23     1.36    15.93
  db.eventstore.read                    200     0.32     0.29     0.36     0.22     3.76
  db.eventstore.write                   600     1.37     1.33     1.60     0.79    10.26
  db.snapshot.read                      200     0.54     0.43     0.84     0.37     6.99
  event.publishAll                      600     0.09     0.09     0.13     0.05     0.38
  event.handle                          600     2.06     1.59     4.38     1.06     6.84
  db.projection.write                   600     1.55     1.17     3.40     0.75     6.14
★ eventual_consistency_lag              600     1.68     1.64     2.87     0.39     6.53

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2200     3.63     3.00     5.00     2.00    22.00
  command.execute                      2200     3.07     2.66     4.34     2.06    21.49
  db.eventstore.read                   2200     0.34     0.28     0.50     0.21    11.21
  db.eventstore.write                  2200     1.17     1.15     1.29     0.74     7.41
  db.snapshot.read                     2200     0.55     0.45     0.77     0.37    14.76
  db.snapshot.write                     400     1.17     1.11     1.25     0.75     7.30
  event.publishAll                     2200     0.09     0.08     0.11     0.06     0.83
  event.handle                         2200     9.45     2.09     5.93     1.50  1008.46
  db.projection.read                   2200     0.37     0.20     1.76     0.15     5.18
  db.projection.write                  2200     0.23     0.17     0.45     0.14     9.97
★ eventual_consistency_lag             2200     9.11     2.25     3.86     0.82  1004.91

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     1.52     1.00     2.00     1.00    17.00
  query.execute                        1300     0.94     0.88     1.35     0.53    16.79
  db.projection.read                   1300     0.60     0.55     0.87     0.35     6.15
```

#### Classical CQRS Load

```
Source: ../logs/m7a-gp3-classical_cqrs-load.log
Parsed: 439591 log lines, 42806 unique req-ids, 42806 requests with http.request span

═══ POST  (create commands) ─ 12276 total / 12276 ok / 0 failed ═══
  error rate: 0 / 12276  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12276     3.05     2.00     5.00     1.00   155.00
  command.execute                     12276     2.70     1.98     4.99     0.81   154.67
  db.eventstore.read                   4107     0.55     0.32     1.51     0.17    11.01
  db.eventstore.write                 12276     1.67     1.37     3.26     0.62    33.68
  db.snapshot.read                     4107     0.72     0.44     1.85     0.19    20.38
  event.publishAll                    12276     0.04     0.03     0.07     0.02     4.97
  event.handle                        12276     2.58     1.89     5.04     0.83   123.46
  db.projection.write                 12276     2.03     1.59     4.35     0.61    39.02
★ eventual_consistency_lag            12276     2.16     1.83     3.70    -0.09    65.64

═══ PATCH (update commands) ─ 18314 total / 18285 ok / 29 failed ═══
  error rate: 29 / 18314  (0.16%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 18285     4.43     3.00     7.00     1.00   198.00
  command.execute                     18285     4.13     3.02     7.07     1.40   197.27
  db.eventstore.read                  18285     0.55     0.32     1.47     0.17    31.65
  db.eventstore.write                 18285     1.67     1.39     3.18     0.62    33.38
  db.snapshot.read                    18285     0.70     0.44     1.88     0.19    23.60
  db.snapshot.write                    2819     1.70     1.64     3.05     0.61    13.54
  event.publishAll                    18285     0.03     0.03     0.05     0.02     6.97
  event.handle                        18285     5.06     3.12     9.54     1.34  1083.55
  db.projection.read                  18285     0.68     0.43     1.97     0.15    30.55
  db.projection.write                 18285     0.64     0.40     1.89     0.14    24.73
★ eventual_consistency_lag            18285     4.64     3.03     8.00     0.47  1079.73

═══ GET   (queries) ─ 12216 total / 12216 ok / 0 failed ═══
  error rate: 0 / 12216  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12216     1.70     1.00     3.00     0.00   106.00
  query.execute                       12216     1.40     0.72     2.84     0.23   105.23
  db.projection.read                  12216     0.93     0.58     2.64     0.17    25.88
```

## M7g.large gp3

### Characteristics

#### Price

0,0816 USD

#### CPU

```
admin@ip-172-31-22-194:~$ lscpu
Architecture:                aarch64
  CPU op-mode(s):            32-bit, 64-bit
  Byte Order:                Little Endian
CPU(s):                      2
  On-line CPU(s) list:       0,1
Vendor ID:                   ARM
  Model name:                Neoverse-V1
    Model:                   1
    Thread(s) per core:      1
    Core(s) per socket:      2
    Socket(s):               1
    Stepping:                r1p1
    BogoMIPS:                2100.00
Caches (sum of all):
  L1d:                       128 KiB (2 instances)
  L1i:                       128 KiB (2 instances)
  L2:                        2 MiB (2 instances)
  L3:                        32 MiB (1 instance)
NUMA:
  NUMA node(s):              1
  NUMA node0 CPU(s):         0,1
```

#### Memory

```
DDR5-4800
8 Gb
```

#### Disk

gp3

### Metrics

#### mCQRS Sequential

```
Source: ../logs/m7g-gp3-m_cqrs-seq.log
Parsed: 36830 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     4.52     4.00     7.00     3.00    22.00
  command.execute                       600     3.59     3.29     5.18     2.69    21.04
  db.eventstore.write                   600     0.36     0.34     0.48     0.26     4.14
  db.snapshot.read                      200     0.63     0.49     0.71     0.44     5.56
  db.snapshot.write                     600     0.44     0.40     0.59     0.33     3.35
  event.publishAll                      600     0.13     0.11     0.18     0.09     0.53
  event.handle                          600     2.72     2.09     5.58     1.42    21.35
  db.projection.write                   600     1.77     1.34     3.79     0.72    20.51
★ eventual_consistency_lag              600     2.05     1.81     3.37     0.33    21.12

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2100     4.88     5.00     7.00     3.00    32.00
  command.execute                      2100     4.03     3.68     5.77     3.02    31.62
  db.eventstore.write                  2100     0.35     0.29     0.42     0.25    25.65
  db.snapshot.read                     2100     0.63     0.51     0.96     0.43    16.94
  db.snapshot.write                    2100     0.47     0.38     0.50     0.31    23.24
  event.publishAll                     2100     0.11     0.10     0.15     0.08     0.93
  event.handle                         2100    18.08     2.98     8.40     2.44  1014.82
  db.projection.read                   2100     0.63     0.37     2.38     0.29    26.17
  db.projection.write                  2100     0.38     0.28     0.79     0.23    15.33
★ eventual_consistency_lag             2100    17.48     3.03     5.54     1.61  1006.11

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     1.99     2.00     3.00     1.00    16.00
  query.execute                        1300     1.22     1.20     1.86     0.70    14.24
  db.projection.read                   1300     0.78     0.75     1.14     0.44    13.72
```

#### mCQRS Load

```
Source: ../logs/m7g-gp3-m_cqrs-load.log
Parsed: 385537 log lines, 42444 unique req-ids, 42444 requests with http.request span

═══ POST  (create commands) ─ 12212 total / 12212 ok / 0 failed ═══
  error rate: 0 / 12212  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12212  2577.76  2409.00  5388.00     6.00  6673.00
  command.execute                     12212  2577.10  2407.95  5387.34     4.23  6672.85
  db.eventstore.write                 12212     4.42     3.88     9.12     0.28    48.38
  db.snapshot.read                     4022     4.63     4.06     9.41     0.29    65.20
  db.snapshot.write                   12212     4.37     3.84     9.07     0.36    43.18
  event.publishAll                    12212     0.08     0.08     0.12     0.04     3.64
  event.handle                        12212  2263.46  2127.26  4901.19     1.87  7223.06
  db.projection.write                 12212     6.77     5.57    14.10     1.06    58.97
★ eventual_consistency_lag            12212  1944.98  1802.85  3189.89     1.72  3626.33

═══ PATCH (update commands) ─ 18169 total / 16783 ok / 1386 failed ═══
  error rate: 1386 / 18169  (7.63%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 16783  3951.92  3600.00  6424.00     6.00  6690.00
  command.execute                     16783  3951.25  3599.30  6423.82     4.02  6689.03
  db.eventstore.write                 16783     4.35     3.84     9.10     0.24    64.31
  db.snapshot.read                    16783     4.62     4.07     9.35     0.42    49.76
  db.snapshot.write                   16783     4.30     3.80     8.82     0.28    52.62
  event.publishAll                    16783     0.07     0.07     0.09     0.04     8.23
  event.handle                        16783  2515.60  2338.67  5323.46     2.91  8138.11
  db.projection.read                  16783     5.46     4.42    11.65     0.31    90.04
  db.projection.write                 16783     5.01     4.13    10.92     0.29    60.85
★ eventual_consistency_lag            16783  2329.66  2155.04  5043.48     2.11  8138.20

═══ GET   (queries) ─ 12063 total / 12063 ok / 0 failed ═══
  error rate: 0 / 12063  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12063  2831.01  2532.00  6176.00     2.00  6661.00
  query.execute                       12063  2830.29  2531.30  6175.32     1.20  6659.67
  db.projection.read                  12063     6.77     6.02    13.75     0.30    49.32
```

#### Classical CQRS Sequential

```
Source: ../logs/m7g-gp3-classical_cqrs-seq.log
Parsed: 43315 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     3.65     3.00     5.00     2.00    21.00
  command.execute                       600     2.70     2.16     4.10     1.66    19.86
  db.eventstore.read                    200     0.60     0.45     0.65     0.39    14.49
  db.eventstore.write                   600     1.46     1.41     1.63     0.95     9.58
  db.snapshot.read                      200     0.64     0.50     1.11     0.45    12.72
  event.publishAll                      600     0.13     0.12     0.19     0.10     0.50
  event.handle                          600     2.68     2.08     5.46     1.71    19.70
  db.projection.write                   600     1.83     1.39     3.81     1.06    18.07
★ eventual_consistency_lag              600     2.10     1.89     3.46     0.75     9.34

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2200     4.78     4.00     7.00     3.00    52.00
  command.execute                      2200     3.98     3.47     5.63     2.74    50.22
  db.eventstore.read                   2200     0.52     0.45     0.81     0.35    10.02
  db.eventstore.write                  2200     1.32     1.28     1.45     0.81    12.83
  db.snapshot.read                     2200     0.65     0.52     0.98     0.45    25.82
  db.snapshot.write                     400     1.27     1.25     1.42     1.06     3.83
  event.publishAll                     2200     0.12     0.12     0.16     0.09     0.77
  event.handle                         2200    10.42     2.87     7.91     2.38  1015.35
  db.projection.read                   2200     0.58     0.36     2.32     0.27     9.10
  db.projection.write                  2200     0.36     0.28     0.73     0.23    17.37
★ eventual_consistency_lag             2200     9.93     2.81     4.97     1.57  1007.33

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     2.01     2.00     3.00     1.00    21.00
  query.execute                        1300     1.23     1.17     2.04     0.68    20.17
  db.projection.read                   1300     0.79     0.73     1.28     0.43    19.73
```

#### Classical CQRS Load

```
Source: ../logs/m7g-gp3-classical_cqrs-load.log
Parsed: 439687 log lines, 43336 unique req-ids, 43336 requests with http.request span

═══ POST  (create commands) ─ 12266 total / 12266 ok / 0 failed ═══
  error rate: 0 / 12266  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12266  2967.32  2414.00  7867.00     5.00  8354.00
  command.execute                     12266  2966.61  2413.79  7866.77     2.95  8353.19
  db.eventstore.read                   4050     5.85     5.24    11.67     0.46    60.21
  db.eventstore.write                 12266     7.18     6.17    14.46     0.99    72.90
  db.snapshot.read                     4050     6.15     5.40    12.19     0.52    56.90
  event.publishAll                    12266     0.08     0.07     0.13     0.04     6.46
  event.handle                        12266  2090.31  1994.45  4705.97     2.98  6067.41
  db.projection.write                 12266     8.15     6.70    16.96     1.32    98.80
★ eventual_consistency_lag            12266  1791.61  1826.07  2760.36     2.56  3034.48

═══ PATCH (update commands) ─ 18752 total / 17477 ok / 1275 failed ═══
  error rate: 1275 / 18752  (6.80%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 17477  5759.75  5968.00  9520.00     5.00  11241.00
  command.execute                     17477  5759.04  5967.97  9519.88     4.02  11240.06
  db.eventstore.read                  17477     5.86     5.24    11.66     0.35    84.69
  db.eventstore.write                 17477     7.07     6.12    13.98     0.94    81.31
  db.snapshot.read                    17477     6.06     5.39    11.88     0.38    76.13
  db.snapshot.write                    2724     6.82     5.97    12.94     1.29    73.74
  event.publishAll                    17477     0.07     0.06     0.10     0.04     3.94
  event.handle                        17477  2370.25  2246.99  5225.24     3.29  16634.35
  db.projection.read                  17477     7.04     5.72    15.18     0.29   111.87
  db.projection.write                 17477     6.35     5.30    13.89     0.29    90.96
★ eventual_consistency_lag            17477  2191.80  2054.29  4893.43     2.82  16633.88

═══ GET   (queries) ─ 12318 total / 12318 ok / 0 failed ═══
  error rate: 0 / 12318  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12318  2608.19  2329.00  5361.00     2.00  5687.00
  query.execute                       12318  2607.42  2328.11  5360.02     1.27  5686.56
  db.projection.read                  12318     8.67     7.74    17.81     0.58    65.06
```

## M7i.large io2

### Characteristics

#### Price

0,1008 USD (compute, same as gp3 variant)

#### CPU

```
admin@ip-172-31-18-175:~$ lscpu
Architecture:                x86_64
  CPU op-mode(s):            32-bit, 64-bit
  Address sizes:             46 bits physical, 48 bits virtual
  Byte Order:                Little Endian
CPU(s):                      2
  On-line CPU(s) list:       0,1
Vendor ID:                   GenuineIntel
  Model name:                Intel(R) Xeon(R) Platinum 8488C
    CPU family:              6
    Model:                   143
    Thread(s) per core:      2
    Core(s) per socket:      1
    Socket(s):               1
    Stepping:                8
    BogoMIPS:                4800.00
Virtualization features:
  Hypervisor vendor:         KVM
  Virtualization type:       full
Caches (sum of all):
  L1d:                       48 KiB (1 instance)
  L1i:                       32 KiB (1 instance)
  L2:                        2 MiB (1 instance)
  L3:                        105 MiB (1 instance)
NUMA:
  NUMA node(s):              1
  NUMA node0 CPU(s):         0,1
```

#### Memory

```
admin@ip-172-31-18-175:~$ sudo dmidecode -t memory
# dmidecode 3.4
Getting SMBIOS data from sysfs.
SMBIOS 2.7 present.

Handle 0x0008, DMI type 16, 23 bytes
Physical Memory Array
        Location: System Board Or Motherboard
        Use: System Memory
        Error Correction Type: Unknown
        Maximum Capacity: 8 GB
        Error Information Handle: Not Provided
        Number Of Devices: 1

Handle 0x0009, DMI type 17, 34 bytes
Memory Device
        Array Handle: 0x0008
        Error Information Handle: Not Provided
        Total Width: 80 bits
        Data Width: 64 bits
        Size: 8 GB
        Form Factor: DIMM
        Set: None
        Locator: Not Specified
        Bank Locator: Not Specified
        Type: DDR5
        Type Detail: Unknown Fast-paged RAMBus Window DRAM
        Speed: 5600 MT/s
        Manufacturer: Not Specified
        Serial Number: Not Specified
        Asset Tag: Not Specified
        Part Number: Not Specified
        Rank: Unknown
        Configured Memory Speed: Unknown
```

#### Disk

io2, 3000 IOPS

### Metrics

#### mCQRS Sequential

```
Source: ../logs/m7i-io2-m_cqrs-seq.log
Parsed: 36835 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     3.43     3.00     5.00     2.00    16.00
  command.execute                       600     2.67     2.42     4.12     1.79    15.08
  db.eventstore.write                   600     0.32     0.27     0.39     0.19    12.34
  db.snapshot.read                      200     0.47     0.39     0.61     0.27     9.62
  db.snapshot.write                     600     0.38     0.33     0.52     0.26     3.98
  event.publishAll                      600     0.11     0.10     0.15     0.06     0.41
  event.handle                          600     1.81     1.37     3.53     1.09    17.83
  db.projection.write                   600     1.02     0.77     2.11     0.64     8.95
★ eventual_consistency_lag              600     1.36     1.18     2.13     0.14     8.82

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2100     3.75     3.00     6.00     2.00    29.00
  command.execute                      2100     3.05     2.73     4.75     2.06    27.83
  db.eventstore.write                  2100     0.30     0.23     0.36     0.18    24.43
  db.snapshot.read                     2100     0.50     0.41     0.76     0.26    13.02
  db.snapshot.write                    2100     0.38     0.32     0.44     0.25    23.87
  event.publishAll                     2100     0.09     0.09     0.13     0.04     3.75
  event.handle                         2100    19.45     2.15     6.16     1.64  1014.15
  db.projection.read                   2100     0.48     0.28     1.67     0.22     8.55
  db.projection.write                  2100     0.33     0.24     0.69     0.19    17.10
★ eventual_consistency_lag             2100    19.00     2.21     4.17     0.97  1008.01

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     1.72     2.00     3.00     1.00    19.00
  query.execute                        1300     1.06     0.98     1.60     0.46    15.82
  db.projection.read                   1300     0.69     0.60     0.97     0.28    15.50
```

#### mCQRS Load

```
Source: ../logs/m7i-io2-m_cqrs-load.log
Parsed: 378694 log lines, 41000 unique req-ids, 41000 requests with http.request span

═══ POST  (create commands) ─ 11889 total / 11889 ok / 0 failed ═══
  error rate: 0 / 11889  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11889    15.55     5.00    25.00     2.00   563.00
  command.execute                     11889    15.04     4.20    24.78     1.47   561.85
  db.eventstore.write                 11889     1.08     0.63     3.36     0.16    29.67
  db.snapshot.read                     4023     1.42     0.93     4.17     0.26    24.51
  db.snapshot.write                   11889     1.13     0.71     3.38     0.22    38.70
  event.publishAll                    11889     0.06     0.06     0.10     0.03     4.62
  event.handle                        11889    10.84     2.00    13.44     0.96   559.22
  db.projection.write                 11889     2.17     1.54     5.77     0.60    65.98
★ eventual_consistency_lag            11889     9.01     1.78    10.57    -0.03   280.73

═══ PATCH (update commands) ─ 17355 total / 17210 ok / 145 failed ═══
  error rate: 145 / 17355  (0.84%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 17210    17.29     5.00    24.00     2.00   559.00
  command.execute                     17210    16.84     4.66    23.75     1.87   559.28
  db.eventstore.write                 17210     0.98     0.59     3.03     0.16    27.79
  db.snapshot.read                    17210     1.35     0.89     3.82     0.24    28.76
  db.snapshot.write                   17210     1.07     0.69     3.16     0.22    29.47
  event.publishAll                    17210     0.05     0.05     0.06     0.03     4.85
  event.handle                        17210    12.56     4.41    22.37     1.63   570.25
  db.projection.read                  17210     1.41     0.90     4.23     0.22    36.85
  db.projection.write                 17210     1.27     0.80     3.87     0.21    37.76
★ eventual_consistency_lag            17210    11.51     4.07    19.66     0.71   557.51

═══ GET   (queries) ─ 11756 total / 11756 ok / 0 failed ═══
  error rate: 0 / 11756  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11756    12.22     2.00    13.00     0.00   544.00
  query.execute                       11756    11.76     1.44    12.59     0.39   543.32
  db.projection.read                  11756     1.93     1.23     5.78     0.25    30.37
```

#### Classical CQRS Sequential

```
Source: ../logs/m7i-io2-classical_cqrs-seq.log
Parsed: 43305 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     2.68     2.00     4.00     1.00    12.00
  command.execute                       600     1.94     1.53     3.28     1.10     6.65
  db.eventstore.read                    200     0.40     0.37     0.50     0.29     2.30
  db.eventstore.write                   600     0.94     0.91     1.10     0.73     4.46
  db.snapshot.read                      200     0.49     0.42     0.60     0.28     3.85
  event.publishAll                      600     0.12     0.12     0.18     0.07     0.90
  event.handle                          600     1.81     1.36     3.74     1.03    20.69
  db.projection.write                   600     1.11     0.80     2.21     0.65    19.93
★ eventual_consistency_lag              600     1.39     1.34     2.24     0.39    20.52

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2200     3.70     3.00     5.00     2.00    22.00
  command.execute                      2200     3.02     2.72     4.39     1.93    21.47
  db.eventstore.read                   2200     0.43     0.37     0.67     0.27     4.31
  db.eventstore.write                  2200     0.85     0.82     0.98     0.68     5.96
  db.snapshot.read                     2200     0.53     0.44     0.80     0.28    16.21
  db.snapshot.write                     400     0.78     0.72     0.87     0.61    18.45
  event.publishAll                     2200     0.11     0.11     0.15     0.05     0.63
  event.handle                         2200     5.02     2.10     5.82     1.70  1006.22
  db.projection.read                   2200     0.47     0.28     1.67     0.22     9.77
  db.projection.write                  2200     0.35     0.24     0.69     0.19    22.18
★ eventual_consistency_lag             2200     4.64     2.26     4.21     0.97  1003.15

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     1.70     2.00     3.00     1.00     9.00
  query.execute                        1300     1.04     0.99     1.62     0.44     8.34
  db.projection.read                   1300     0.67     0.62     0.96     0.29     7.95
```

#### Classical CQRS Load

```
Source: ../logs/m7i-io2-classical_cqrs-load.log
Parsed: 421955 log lines, 41173 unique req-ids, 41173 requests with http.request span

═══ POST  (create commands) ─ 11903 total / 11903 ok / 0 failed ═══
  error rate: 0 / 11903  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11903    10.22     3.00    14.00     1.00   600.00
  command.execute                     11903     9.71     2.39    12.94     0.91   599.37
  db.eventstore.read                   3984     1.27     0.77     3.91     0.24    16.18
  db.eventstore.write                 11903     2.02     1.39     5.32     0.62    37.52
  db.snapshot.read                     3984     1.61     1.09     4.60     0.28    26.03
  event.publishAll                    11903     0.07     0.06     0.10     0.03     4.40
  event.handle                        11903     7.19     2.12    10.58     0.92   410.29
  db.projection.write                 11903     2.38     1.67     6.53     0.59    77.04
★ eventual_consistency_lag            11903     6.10     1.90     7.94    -0.05   213.05

═══ PATCH (update commands) ─ 17508 total / 17409 ok / 99 failed ═══
  error rate: 99 / 17508  (0.57%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 17409    16.40     5.00    19.00     2.00   777.00
  command.execute                     17409    15.94     4.18    18.71     1.76   776.83
  db.eventstore.read                  17409     1.26     0.73     4.01     0.25    30.79
  db.eventstore.write                 17409     1.83     1.28     4.65     0.62    24.46
  db.snapshot.read                    17409     1.61     1.06     4.64     0.28    37.98
  db.snapshot.write                    2663     1.84     1.30     4.87     0.60    19.42
  event.publishAll                    17409     0.06     0.05     0.08     0.03     6.36
  event.handle                        17409    15.44     4.68    23.50     1.57  3592.33
  db.projection.read                  17409     1.61     0.96     4.94     0.21    70.02
  db.projection.write                 17409     1.39     0.83     4.39     0.21    41.95
★ eventual_consistency_lag            17409    14.38     4.32    20.14     0.68  3592.14

═══ GET   (queries) ─ 11762 total / 11762 ok / 0 failed ═══
  error rate: 0 / 11762  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11762     8.52     2.00    11.00     0.00   419.00
  query.execute                       11762     8.06     1.47    10.21     0.38   417.56
  db.projection.read                  11762     2.07     1.24     6.54     0.24    37.53
```

## M7a.large io2

### Characteristics

#### Price

0,11592 USD (compute, same as gp3 variant)

#### CPU

```
admin@ip-172-31-18-39:~$ lscpu
Architecture:                x86_64
  CPU op-mode(s):            32-bit, 64-bit
  Address sizes:             48 bits physical, 48 bits virtual
  Byte Order:                Little Endian
CPU(s):                      2
  On-line CPU(s) list:       0,1
Vendor ID:                   AuthenticAMD
  Model name:                AMD EPYC 9R14
    CPU family:              25
    Model:                   17
    Thread(s) per core:      1
    Core(s) per socket:      2
    Socket(s):               1
    Stepping:                1
    BogoMIPS:                5199.99
Virtualization features:
  Hypervisor vendor:         KVM
  Virtualization type:       full
Caches (sum of all):
  L1d:                       64 KiB (2 instances)
  L1i:                       64 KiB (2 instances)
  L2:                        2 MiB (2 instances)
  L3:                        8 MiB (1 instance)
NUMA:
  NUMA node(s):              1
  NUMA node0 CPU(s):         0,1
```

#### Memory

```
admin@ip-172-31-18-39:~$ sudo dmidecode -t memory
# dmidecode 3.4
Getting SMBIOS data from sysfs.
SMBIOS 2.7 present.

Handle 0x0008, DMI type 16, 23 bytes
Physical Memory Array
        Location: System Board Or Motherboard
        Use: System Memory
        Error Correction Type: Unknown
        Maximum Capacity: 8 GB
        Error Information Handle: Not Provided
        Number Of Devices: 1

Handle 0x0009, DMI type 17, 34 bytes
Memory Device
        Array Handle: 0x0008
        Error Information Handle: Not Provided
        Total Width: 80 bits
        Data Width: 64 bits
        Size: 8 GB
        Form Factor: DIMM
        Set: None
        Locator: Not Specified
        Bank Locator: Not Specified
        Type: DDR5
        Type Detail: Unknown Fast-paged RAMBus Window DRAM
        Speed: 5600 MT/s
        Manufacturer: Not Specified
        Serial Number: Not Specified
        Asset Tag: Not Specified
        Part Number: Not Specified
        Rank: Unknown
        Configured Memory Speed: Unknown
```

#### Disk

io2, 3000 IOPS

### Metrics

#### mCQRS Sequential

```
Source: ../logs/m7a-io2-m_cqrs-seq.log
Parsed: 36845 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     3.28     3.00     5.00     2.00    16.00
  command.execute                       600     2.63     2.39     4.10     1.91    14.85
  db.eventstore.write                   600     0.28     0.27     0.36     0.17     3.05
  db.snapshot.read                      200     0.58     0.42     1.52     0.35     6.97
  db.snapshot.write                     600     0.33     0.26     0.49     0.21    12.11
  event.publishAll                      600     0.09     0.08     0.12     0.07     0.39
  event.handle                          600     1.66     1.27     3.53     0.98     7.60
  db.projection.write                   600     1.06     0.79     2.40     0.58     6.51
★ eventual_consistency_lag              600     1.26     1.06     2.30    -0.00     5.25

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2100     3.39     3.00     5.00     2.00    16.00
  command.execute                      2100     2.83     2.61     4.19     2.16    13.81
  db.eventstore.write                  2100     0.24     0.19     0.28     0.16     6.66
  db.snapshot.read                     2100     0.52     0.43     0.77     0.35     6.98
  db.snapshot.write                    2100     0.29     0.26     0.32     0.19     4.28
  event.publishAll                     2100     0.08     0.08     0.10     0.06     1.00
  event.handle                         2100    23.78     1.84     5.45     1.45  1014.08
  db.projection.read                   2100     0.37     0.21     1.43     0.16     7.03
  db.projection.write                  2100     0.24     0.17     0.50     0.13     9.56
★ eventual_consistency_lag             2100    23.42     1.95     3.63     0.54  1006.17

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     1.58     1.00     2.00     1.00    17.00
  query.execute                        1300     1.00     0.91     1.55     0.52    16.35
  db.projection.read                   1300     0.65     0.56     1.08     0.35    15.90
```

#### mCQRS Load

```
Source: ../logs/m7a-io2-m_cqrs-load.log
Parsed: 384369 log lines, 41378 unique req-ids, 41377 requests with http.request span

═══ POST  (create commands) ─ 11886 total / 11886 ok / 0 failed ═══
  error rate: 0 / 11886  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11886     3.95     3.00     7.00     1.00   165.00
  command.execute                     11886     3.60     2.26     6.40     1.20   165.04
  db.eventstore.write                 11886     0.43     0.22     1.20     0.12    16.55
  db.snapshot.read                     3963     0.59     0.34     1.67     0.17    13.23
  db.snapshot.write                   11886     0.49     0.27     1.29     0.15    24.27
  event.publishAll                    11886     0.04     0.03     0.06     0.02     2.38
  event.handle                        11886     2.35     1.33     4.08     0.80   173.71
  db.projection.write                 11886     1.45     1.02     3.31     0.56    26.29
★ eventual_consistency_lag            11886     1.91     1.35     2.99    -0.13    89.82

═══ PATCH (update commands) ─ 17818 total / 17778 ok / 40 failed ═══
  error rate: 40 / 17818  (0.22%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 17778     4.27     3.00     7.00     1.00   165.00
  command.execute                     17778     3.95     2.50     6.57     1.50   164.32
  db.eventstore.write                 17778     0.39     0.21     1.09     0.12    11.56
  db.snapshot.read                    17778     0.57     0.34     1.57     0.16    27.63
  db.snapshot.write                   17778     0.47     0.27     1.21     0.15    25.67
  event.publishAll                    17778     0.03     0.03     0.04     0.02     2.65
  event.handle                        17778     3.84     2.47     7.90     1.25   195.34
  db.projection.read                  17778     0.66     0.43     1.84     0.15    28.56
  db.projection.write                 17778     0.59     0.37     1.69     0.14    21.77
★ eventual_consistency_lag            17778     3.42     2.39     6.57     0.36   191.24

═══ GET   (queries) ─ 11673 total / 11673 ok / 0 failed ═══
  error rate: 0 / 11673  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11673     1.86     1.00     3.00     0.00   151.00
  query.execute                       11673     1.56     0.67     2.49     0.24   150.15
  db.projection.read                  11673     0.83     0.52     2.28     0.16    21.32
```

#### Classical CQRS Sequential

```
Source: ../logs/m7a-io2-classical_cqrs-seq.log
Parsed: 43330 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     2.62     2.00     4.00     1.00    11.00
  command.execute                       600     2.01     1.73     3.03     1.25    10.82
  db.eventstore.read                    200     0.31     0.29     0.37     0.25     1.47
  db.eventstore.write                   600     1.17     1.06     1.64     0.73    10.29
  db.snapshot.read                      200     0.48     0.44     0.57     0.38     2.98
  event.publishAll                      600     0.08     0.07     0.12     0.05     1.34
  event.handle                          600     1.66     1.27     3.55     0.90    11.18
  db.projection.write                   600     1.16     0.86     2.63     0.61    10.41
★ eventual_consistency_lag              600     1.30     1.38     2.44     0.17     6.55

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2200     3.32     3.00     5.00     2.00    13.00
  command.execute                      2200     2.75     2.51     4.06     1.91    12.13
  db.eventstore.read                   2200     0.33     0.28     0.50     0.21     6.19
  db.eventstore.write                  2200     0.95     0.89     1.26     0.69     6.90
  db.snapshot.read                     2200     0.54     0.45     0.72     0.39     9.64
  db.snapshot.write                     400     0.80     0.75     1.11     0.59     2.67
  event.publishAll                     2200     0.08     0.07     0.10     0.05     2.77
  event.handle                         2200    15.94     1.85     5.34     1.42  1010.72
  db.projection.read                   2200     0.36     0.21     1.48     0.16     4.92
  db.projection.write                  2200     0.24     0.17     0.46     0.14    12.14
★ eventual_consistency_lag             2200    15.62     1.83     3.63     0.53  1007.04

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     1.53     1.00     2.00     1.00    16.00
  query.execute                        1300     0.96     0.89     1.39     0.57    14.93
  db.projection.read                   1300     0.63     0.55     0.91     0.34    14.61
```

#### Classical CQRS Load

```
Source: ../logs/m7a-io2-classical_cqrs-load.log
Parsed: 415302 log lines, 40626 unique req-ids, 40625 requests with http.request span

═══ POST  (create commands) ─ 11819 total / 11819 ok / 0 failed ═══
  error rate: 0 / 11819  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11819     3.05     2.00     5.00     1.00   172.00
  command.execute                     11819     2.69     1.54     4.68     0.78   171.20
  db.eventstore.read                   3991     0.57     0.30     1.52     0.17    19.68
  db.eventstore.write                 11819     1.30     0.97     2.82     0.58    26.51
  db.snapshot.read                     3991     0.78     0.48     1.99     0.25    17.89
  event.publishAll                    11819     0.04     0.03     0.06     0.02     1.54
  event.handle                        11819     2.34     1.35     4.51     0.76   144.81
  db.projection.write                 11819     1.55     1.06     3.83     0.56    65.46
★ eventual_consistency_lag            11819     1.92     1.27     3.27    -0.14    74.50

═══ PATCH (update commands) ─ 17135 total / 17111 ok / 24 failed ═══
  error rate: 24 / 17135  (0.14%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 17111     4.36     3.00     7.00     1.00   222.00
  command.execute                     17111     4.04     2.51     6.27     1.44   221.37
  db.eventstore.read                  17111     0.53     0.29     1.38     0.16    19.36
  db.eventstore.write                 17111     1.22     0.95     2.55     0.58    30.62
  db.snapshot.read                    17111     0.75     0.48     1.87     0.24    23.35
  db.snapshot.write                    2658     1.22     0.96     2.55     0.57    14.00
  event.publishAll                    17111     0.03     0.03     0.05     0.02     4.26
  event.handle                        17111     6.78     2.57     8.55     1.29  3155.63
  db.projection.read                  17111     0.72     0.45     2.08     0.15    46.29
  db.projection.write                 17111     0.63     0.36     1.86     0.15    30.41
★ eventual_consistency_lag            17111     6.38     2.50     7.27     0.40  3154.45

═══ GET   (queries) ─ 11671 total / 11671 ok / 0 failed ═══
  error rate: 0 / 11671  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11671     1.88     1.00     3.00     0.00   123.00
  query.execute                       11671     1.57     0.72     2.72     0.24   121.79
  db.projection.read                  11671     0.92     0.58     2.52     0.18    34.72
```

## M7g.large io2

### Characteristics

#### Price

0,0816 USD (compute, same as gp3 variant)

#### CPU

```
admin@ip-172-31-19-104:~$ lscpu
Architecture:                aarch64
  CPU op-mode(s):            32-bit, 64-bit
  Byte Order:                Little Endian
CPU(s):                      2
  On-line CPU(s) list:       0,1
Vendor ID:                   ARM
  Model name:                Neoverse-V1
    Model:                   1
    Thread(s) per core:      1
    Core(s) per socket:      2
    Socket(s):               1
    Stepping:                r1p1
    BogoMIPS:                2100.00
Caches (sum of all):
  L1d:                       128 KiB (2 instances)
  L1i:                       128 KiB (2 instances)
  L2:                        2 MiB (2 instances)
  L3:                        32 MiB (1 instance)
NUMA:
  NUMA node(s):              1
  NUMA node0 CPU(s):         0,1
```

#### Memory

DDR5-4800, 8 GB

#### Disk

io2, 3000 IOPS

### Metrics

#### mCQRS Sequential

```
Source: ../logs/m7g-io2-m_cqrs-seq.log
Parsed: 36825 log lines, 4100 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     3.91     4.00     6.00     3.00    30.00
  command.execute                       600     3.02     2.69     4.82     2.17    29.04
  db.eventstore.write                   600     0.36     0.33     0.45     0.25     3.74
  db.snapshot.read                      200     0.59     0.48     0.67     0.43     3.66
  db.snapshot.write                     600     0.48     0.36     0.61     0.30    26.56
  event.publishAll                      600     0.12     0.10     0.17     0.09     0.49
  event.handle                          600     1.81     1.39     3.70     1.06    10.77
  db.projection.write                   600     0.93     0.69     1.99     0.52     6.54
★ eventual_consistency_lag              600     1.29     1.32     2.15     0.22     4.91

═══ PATCH (update commands) ─ 2200 total / 2100 ok / 100 failed ═══
  error rate: 100 / 2200  (4.55%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2100     4.23     4.00     6.00     3.00    33.00
  command.execute                      2100     3.44     3.05     5.44     2.57    32.25
  db.eventstore.write                  2100     0.34     0.28     0.39     0.24    23.83
  db.snapshot.read                     2100     0.63     0.49     1.00     0.42    11.66
  db.snapshot.write                    2100     0.45     0.35     0.45     0.29    29.30
  event.publishAll                     2100     0.11     0.10     0.14     0.08     3.68
  event.handle                         2100    14.87     2.27     6.49     1.86  1012.22
  db.projection.read                   2100     0.55     0.34     1.77     0.26    12.91
  db.projection.write                  2100     0.36     0.27     0.75     0.23    19.61
★ eventual_consistency_lag             2100    14.36     2.12     4.57     0.89  1005.64

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     2.02     2.00     3.00     1.00    21.00
  query.execute                        1300     1.26     1.16     2.32     0.68    19.76
  db.projection.read                   1300     0.81     0.71     1.50     0.43    18.90
```

#### mCQRS Load

```
Source: ../logs/m7g-io2-m_cqrs-load.log
Parsed: 378269 log lines, 41044 unique req-ids, 41044 requests with http.request span

═══ POST  (create commands) ─ 11955 total / 11955 ok / 0 failed ═══
  error rate: 0 / 11955  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11955    85.95    12.00   526.00     2.00  1172.00
  command.execute                     11955    85.34    10.87   524.47     1.61  1171.17
  db.eventstore.write                 11955     2.51     2.10     6.09     0.20    27.18
  db.snapshot.read                     3979     2.86     2.50     6.70     0.26    22.70
  db.snapshot.write                   11955     2.50     1.98     6.24     0.26    28.88
  event.publishAll                    11955     0.07     0.06     0.10     0.04     1.12
  event.handle                        11955    68.14     3.95   478.12     0.95  1254.17
  db.projection.write                 11955     3.42     2.76     8.84     0.49    56.37
★ eventual_consistency_lag            11955    58.59     3.20   457.98     0.04   629.67

═══ PATCH (update commands) ─ 17345 total / 17013 ok / 332 failed ═══
  error rate: 332 / 17345  (1.91%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 17013   108.95    13.00   906.00     2.00  1181.00
  command.execute                     17013   108.38    12.14   905.62     2.04  1180.80
  db.eventstore.write                 17013     2.39     1.93     5.89     0.20    30.26
  db.snapshot.read                    17013     2.83     2.52     6.49     0.27    33.40
  db.snapshot.write                   17013     2.40     1.91     5.88     0.25    29.67
  event.publishAll                    17013     0.05     0.05     0.08     0.04     3.84
  event.handle                        17013    72.92    11.19   476.81     1.77  3047.22
  db.projection.read                  17013     3.13     2.44     8.55     0.25    37.51
  db.projection.write                 17013     2.84     2.20     7.86     0.25    33.84
★ eventual_consistency_lag            17013    67.33    10.16   467.32     0.93  3046.51

═══ GET   (queries) ─ 11744 total / 11744 ok / 0 failed ═══
  error rate: 0 / 11744  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11744    89.78     5.00   602.00     0.00  1169.00
  query.execute                       11744    89.20     4.28   601.85     0.43  1167.92
  db.projection.read                  11744     4.13     3.28    10.54     0.28    40.44
```

#### Classical CQRS Sequential

```
Source: ../logs/m7g-io2-classical_cqrs-seq.log
Parsed: 43327 log lines, 4102 unique req-ids, 4100 requests with http.request span

═══ POST  (create commands) ─ 600 total / 600 ok / 0 failed ═══
  error rate: 0 / 600  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                   600     2.88     3.00     4.00     1.00    16.00
  command.execute                       600     2.04     1.52     3.52     1.22    14.62
  db.eventstore.read                    200     0.44     0.42     0.51     0.36     1.65
  db.eventstore.write                   600     0.93     0.86     1.07     0.63    11.97
  db.snapshot.read                      200     0.55     0.49     0.65     0.44     3.60
  event.publishAll                      600     0.11     0.10     0.16     0.07     0.89
  event.handle                          600     1.75     1.34     3.56     0.99     9.61
  db.projection.write                   600     0.98     0.72     2.09     0.54     8.32
★ eventual_consistency_lag              600     1.31     1.41     2.26     0.34     4.66

═══ PATCH (update commands) ─ 2200 total / 2200 ok / 0 failed ═══
  error rate: 0 / 2200  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  2200     3.91     4.00     6.00     2.00    30.00
  command.execute                      2200     3.16     2.75     4.74     2.25    28.33
  db.eventstore.read                   2200     0.49     0.41     0.75     0.32    24.02
  db.eventstore.write                  2200     0.76     0.72     0.87     0.60    13.76
  db.snapshot.read                     2200     0.64     0.51     0.94     0.43    22.50
  db.snapshot.write                     400     0.63     0.60     0.75     0.51     3.53
  event.publishAll                     2200     0.10     0.09     0.13     0.07     0.54
  event.handle                         2200    14.14     2.15     5.92     1.74  1013.23
  db.projection.read                   2200     0.52     0.32     1.68     0.25     9.38
  db.projection.write                  2200     0.34     0.26     0.73     0.22    16.31
★ eventual_consistency_lag             2200    13.72     2.28     4.10     0.96  1006.95

═══ GET   (queries) ─ 1300 total / 1300 ok / 0 failed ═══
  error rate: 0 / 1300  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                  1300     1.85     2.00     3.00     1.00    12.00
  query.execute                        1300     1.12     1.10     1.68     0.66    10.71
  db.projection.read                   1300     0.72     0.69     1.01     0.40    10.19
```

#### Classical CQRS Load

```
Source: ../logs/m7g-io2-classical_cqrs-load.log
Parsed: 422498 log lines, 41284 unique req-ids, 41284 requests with http.request span

═══ POST  (create commands) ─ 12076 total / 12076 ok / 0 failed ═══
  error rate: 0 / 12076  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 12076   169.55     6.00   984.00     1.00  1994.00
  command.execute                     12076   168.91     5.30   983.28     0.82  1992.98
  db.eventstore.read                   3968     3.19     2.34     8.40     0.28    30.76
  db.eventstore.write                 12076     3.68     2.91     9.33     0.52    31.86
  db.snapshot.read                     3968     3.54     2.86     8.92     0.34    30.00
  event.publishAll                    12076     0.07     0.06     0.12     0.04     3.50
  event.handle                        12076   116.96     4.20   630.53     0.88  1579.34
  db.projection.write                 12076     4.14     3.22    11.17     0.51    38.13
★ eventual_consistency_lag            12076    99.54     3.50   595.56     0.01   793.19

═══ PATCH (update commands) ─ 17616 total / 17259 ok / 357 failed ═══
  error rate: 357 / 17616  (2.03%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 17259   293.22     9.00  1817.00     2.00  2613.00
  command.execute                     17259   292.63     8.94  1815.94     1.83  2611.77
  db.eventstore.read                  17259     3.09     2.20     8.26     0.27    35.03
  db.eventstore.write                 17259     3.34     2.43     8.68     0.51    31.31
  db.snapshot.read                    17259     3.42     2.73     8.57     0.33    30.46
  db.snapshot.write                    2668     3.27     2.61     8.13     0.49    20.52
  event.publishAll                    17259     0.06     0.05     0.09     0.04     3.83
  event.handle                        17259   144.44    11.35   667.11     1.65  6286.39
  db.projection.read                  17259     3.80     2.57    11.13     0.25    58.89
  db.projection.write                 17259     3.38     2.32    10.07     0.25    47.94
★ eventual_consistency_lag            17259   133.76    10.34   641.68     0.75  6285.99

═══ GET   (queries) ─ 11592 total / 11592 ok / 0 failed ═══
  error rate: 0 / 11592  (0.00%)
  span                                count      avg   median      p95      min      max
  ──────────────────────────────────────────────────────────────────────────────────────
  (pino) responseTime                 11592   149.00     5.00   888.00     0.00  1406.00
  query.execute                       11592   148.41     4.05   887.39     0.43  1405.10
  db.projection.read                  11592     4.81     3.44    13.72     0.26    47.42
```

## Summary

Comparison of all candidates (server + implementation variation) on three SLA-relevant metrics:

- **Error rate** — share of failed requests
- **Response time** — server-side time to first byte (pino `responseTime`)
- **Full processing time** — `responseTime + eventual_consistency_lag`, i.e. total time from request start until all command-side event handlers finished (commands only; GET has no event handlers)

> **Note on PATCH errors in Sequential mode (4.55% in mCQRS):** caused by `/users/exit-system` not being implemented in the mCQRS variant — the 100 failures = 100 iterations × 1 failing endpoint, not a load-induced issue.

Columns: `err` = error rate %, `resp` = pino `responseTime` avg (ms), `full` = `resp + ecLag` avg (ms; commands only, GET has no event handlers).

Price per month assumes 730 hours (AWS standard).

Price column = compute + EBS disk cost in eu-central-1, 100 GB volume, 730 h/mo:

- gp3 disk: 100 GB × $0.0952 = **$9.52/mo** (3000 baseline IOPS, 125 MB/s baseline throughput included)
- io2 disk: 100 GB × $0.138 + **1500 PIOPS** × $0.072 = $13.80 + $108.00 = **$121.80/mo** (right-sized; see footnote ³ under disk table)

So io2 adds **+$112.28/mo** over gp3 for the same volume size.

> **Sizing note:** Experiment ran with 3000 PIOPS on io2 (matching gp3 baseline for fair comparison). CloudWatch `VolumeAvgIOPS` peak was 722 (1-min average) and `VolumeIOPSExceededCheck = 0` for the entire test window — so real sub-minute bursts never exceeded gp3's 3000 baseline. Right-sized provisioning is **1500 PIOPS** (×2 over measured average, absorbing sub-minute bursts CloudWatch averages out). io2 latency is sub-ms regardless of provisioned IOPS, so this re-sizing changes cost but not measured latency.

### Апаратні характеристики

#### EC2 інстанси (3 компʼютери)

| Параметр                    | **m7i.large**                 | **m7a.large**                 | **m7g.large**      |
|-----------------------------|-------------------------------|-------------------------------|--------------------|
| Архітектура                 | x86_64                        | x86_64                        | aarch64 (ARM)      |
| Виробник CPU                | Intel                         | AMD                           | AWS Graviton3      |
| Модель CPU                  | Xeon Platinum 8488C           | EPYC 9R14                     | Neoverse-V1        |
| vCPU                        | 2                             | 2                             | 2                  |
| Thread(s) per core          | 2                             | 1                             | 1                  |
| Core(s) per socket          | 1                             | 2                             | 2                  |
| Socket(s)                   | 1                             | 1                             | 1                  |
| BogoMIPS                    | 4800                          | 5200                          | 2100               |
| L1d / L1i                   | 48 / 32 KiB                   | 64 / 64 KiB (×2)              | 128 / 128 KiB (×2) |
| L2                          | 2 MiB                         | 2 MiB (×2) = 4 MiB            | 2 MiB (×2) = 4 MiB |
| L3                          | 105 MiB (спільний на хості)   | 8 MiB                         | 32 MiB             |
| RAM                         | 8 GB DDR5                     | 8 GB DDR5                     | 8 GB DDR5          |
| Швидкість памʼяті           | 4800 (gp3) / 5600 (io2) MT/s¹ | 4800 (gp3) / 5600 (io2) MT/s¹ | 4800 MT/s          |
| Network (max)               | до 12,5 Gbps²                 | до 12,5 Gbps²                 | до 12,5 Gbps²      |
| Ціна (on-demand, us-east-1) | 0,1008 USD/год                | 0,11592 USD/год               | 0,0816 USD/год     |

¹ Різниця у швидкості памʼяті — артефакт того, що прогони gp3 та io2 потрапили на різні фізичні хости AWS; від типу диска не залежить.
² Значення з документації AWS, у логах їх немає.

#### EBS диски — порівняння для тому 100 GB

| Параметр                           | **gp3 (100 GB)**              | **io2 (100 GB)**                             |
|------------------------------------|-------------------------------|----------------------------------------------|
| Тип тому EBS                       | General Purpose SSD           | Provisioned IOPS SSD                         |
| Розмір тому                        | 100 GiB                       | 100 GiB                                      |
| Baseline IOPS (включено в ціну)    | 3 000                         | — (повністю provisioned)                     |
| Provisioned IOPS (sized)           | 3 000 (default, безкоштовно)  | 1 500 (×2 запас над виміряним avg peak)³     |
| Max IOPS @ 100 GiB                 | 16 000 (можна доплатити)      | 50 000 (limit 500 IOPS/GiB)                  |
| Max IOPS @ 100 GiB (Block Express) | —                             | 100 000 (limit 1000 IOPS/GiB)                |
| Baseline throughput                | 125 MiB/s (включено)          | ~12 MiB/s @ 3000 IOPS (4 MiB/s на 1000 IOPS) |
| Max throughput @ 100 GiB           | 1 000 MiB/s (можна доплатити) | 1 000 MiB/s (4 000 на Block Express)         |
| EBS Bandwidth (стеля від EC2)      | до 10 Gbps (~1250 MiB/s)      | до 10 Gbps (~1250 MiB/s)                     |
| Durability                         | 99,8 %                        | 99,999 %                                     |
| SLA                                | —                             | 99,999 %                                     |
| Latency                            | single‑digit ms               | sub‑ms (Nitro / Block Express)               |
| Ціна за GB‑міс (eu-central-1)      | $0,0952                       | $0,138                                       |
| Ціна за PIOPS‑міс (eu-central-1)   | — (включено)                  | $0,072 за IOPS (перші 32k)                   |
| **Capacity cost (100 GiB)**        | 100 × $0,0952 = **$9,52/міс** | 100 × $0,138 = **$13,80/міс**                |
| **IOPS cost** (sized)              | $0 (в межах baseline)         | 1500 × $0,072 = **$108,00/міс**              |
| **Разом за 100 GB/міс**            | **$9,52**                     | **$121,80**                                  |
| Доплата io2 над gp3                | —                             | **+$112,28/міс** (×13)                       |

³ Експеримент проводився на 3 000 IOPS для еквівалентності з gp3 baseline. CloudWatch EBS metrics на m7a gp3 показали `VolumeAvgIOPS` peak **722** (1‑хв average) і `VolumeIOPSExceededCheck = 0` за весь час — тобто реальні sub‑minute бурсти жодного разу не перевищували gp3 baseline 3 000. Sized provisioning **1 500 IOPS** = ×2 над виміряним avg peak, що покриває короткі бурсти, які CloudWatch усереднює. **Latency io2 sub‑ms на Nitro не залежить від кількості provisioned IOPS**, тож latency‑результати експерименту валідні для нової sized ціни.

#### Посилання для перевірки

**EC2 інстанси:**

- M7i: <https://aws.amazon.com/ec2/instance-types/m7i/>
- M7a: <https://aws.amazon.com/ec2/instance-types/m7a/>
- M7g: <https://aws.amazon.com/ec2/instance-types/m7g/>

**EBS:**

- Порівняння типів томів EBS: <https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html>
- gp3: <https://docs.aws.amazon.com/ebs/latest/userguide/general-purpose.html>
- io2: <https://docs.aws.amazon.com/ebs/latest/userguide/provisioned-iops.html>

**Ціни:**

- EC2 pricing: <https://aws.amazon.com/ec2/pricing/on-demand/>
- EBS pricing: <https://aws.amazon.com/ebs/pricing/>

### Load mode

| Candidate         | Price (USD/mo) | POST err | POST resp | POST full | PATCH err | PATCH resp | PATCH full | GET err | GET resp |
|-------------------|---------------:|---------:|----------:|----------:|----------:|-----------:|-----------:|--------:|---------:|
| M7i gp3 mCQRS     |          83.10 |    0.00% |     19.80 |     31.62 |     0.93% |      23.20 |      41.96 |   0.00% |    15.09 |
| M7i io2 mCQRS     |         195.38 |    0.00% |     15.55 |     24.56 |     0.84% |      17.29 |      28.80 |   0.00% |    12.22 |
| M7a gp3 mCQRS     |          94.14 |    0.00% |      8.85 |     14.30 |     0.54% |       9.94 |      18.26 |   0.00% |     6.49 |
| M7a io2 mCQRS     |         206.42 |    0.00% |      3.95 |      5.86 |     0.22% |       4.27 |       7.69 |   0.00% |     1.86 |
| M7g gp3 mCQRS     |          69.09 |    0.00% |   2577.76 |   4522.74 |     7.63% |    3951.92 |    6281.58 |   0.00% |  2831.01 |
| M7g io2 mCQRS     |         181.37 |    0.00% |     85.95 |    144.54 |     1.91% |     108.95 |     176.28 |   0.00% |    89.78 |
| M7i gp3 Classical |          83.10 |    0.00% |      9.47 |     15.16 |     0.45% |      13.79 |      27.20 |   0.00% |     6.71 |
| M7i io2 Classical |         195.38 |    0.00% |     10.22 |     16.32 |     0.57% |      16.40 |      30.78 |   0.00% |     8.52 |
| M7a gp3 Classical |          94.14 |    0.00% |      3.05 |      5.21 |     0.16% |       4.43 |       9.07 |   0.00% |     1.70 |
| M7a io2 Classical |         206.42 |    0.00% |      3.05 |      4.97 |     0.14% |       4.36 |      10.74 |   0.00% |     1.88 |
| M7g gp3 Classical |          69.09 |    0.00% |   2967.32 |   4758.93 |     6.80% |    5759.75 |    7951.55 |   0.00% |  2608.19 |
| M7g io2 Classical |         181.37 |    0.00% |    169.55 |    269.09 |     2.03% |     293.22 |     426.98 |   0.00% |   149.00 |

### SLA Assessment

io2 adds **+$112/mo over gp3 per node** (1500 PIOPS × $0.072 + 100 GB × $0.138 = $121.80 vs gp3's $9.52). That's ~1.4× M7a compute cost ($84.62) and ~2× M7g compute ($59.57) — disk cost is comparable to compute but no longer crushes the bill like with 3000 PIOPS.

- **Disk type matters most for M7g.large.** io2 cuts M7g Load latency by ~30× (mCQRS PATCH full: 6281 ms → 176 ms; Classical: 7951 ms → 427 ms). M7g+gp3 was unusable; M7g+io2 is workable but still ~20× slower than M7a candidates — and at $181/mo costs nearly 2× M7a gp3 ($94) for worse latency.
- **For M7a and M7i, io2 brings only marginal Load improvements** (single-digit ms shifts). They were CPU-bound on gp3, not disk-bound, so paying +$112/mo for io2 is still hard to justify unless sub-10ms PATCH is a hard requirement.
- **M7a gp3 + Classical CQRS** is the price/perf winner: $94.14/mo, 5.21/9.07 ms POST/PATCH full, 0.16% PATCH error.
- **M7a io2 + mCQRS** has the absolute lowest PATCH full avg (7.69 ms) — at $206.42/mo (+119% over M7a gp3 Classical), the ~1.4 ms latency reduction is defensible only when sub-10ms PATCH is critical (much more reasonable than at the original $314 / +234%).
- **M7i remains the worst x86 candidate** under load on either disk — PATCH full avg stays ≈29–31 ms.
- **Classical vs mCQRS** verdict flips on io2: with disk no longer bottlenecking, M7a io2 mCQRS slightly beats M7a io2 Classical on PATCH (7.69 vs 10.74 ms). On gp3, Classical wins.
- Sequential mode metrics still don't discriminate between candidates (no contention).

**Recommended candidate (Load): M7a.large gp3 + Classical CQRS** — $94.14/mo, PATCH full ≈9 ms, 0.16% error. With right-sized io2 (1500 PIOPS) the io2 alternatives are ~2.2–2.6× more expensive instead of 3.3×; M7a io2 mCQRS at $206/mo becomes a defensible choice when sub-10ms PATCH matters.

If absolute lowest latency is required regardless of cost: **M7a.large io2 + mCQRS** ($206.42/mo, PATCH full ≈7.7 ms).

### Дискусія: апаратні характеристики → результуючі метрики

Як апаратні параметри з таблиці вище пояснюють отримані результати Load‑режиму.

#### Чому M7a — лідер на обох дисках

- **Найвищий BogoMIPS (5200)** — приблизно +8% до M7i і ×2,5 до M7g. Це найвища швидкість виконання інструкцій на потік.
- **2 фізичних ядра без SMT** (`Core(s) per socket = 2`, `Thread(s) per core = 1`): кожне vCPU має ексклюзивні execution units, ALU, L1/L2 кеш. HTTP‑обробник і event‑handler не конкурують за ресурси одного фізичного ядра.
- **5600 MT/s DDR5 на io2‑хості** — на 17% швидша памʼять, що дає невеликий додатковий виграш для io2‑прогонів понад дисковий ефект.
- Маленький L3 (8 MiB) не критичний: гарячий робочий набір CQRS (events + snapshots по кілька KB) поміщається в L2 (4 MiB сумарно).

#### Чому M7i посередині

- **Тільки 1 фізичне ядро з SMT=2** (`Core(s) per socket = 1`, `Thread(s) per core = 2`): обидва vCPU розділяють execution pipeline одного ядра. Під навантаженням (паралельні POST/PATCH/GET) це створює внутрішню конкуренцію за ALU, L1/L2, gen registers.
- BogoMIPS 4800 — нижчий, ніж у M7a (5200).
- L3 = 105 MiB, але це **спільний на хості** кеш через усі VM, що працюють на цьому фізичному сервері — не доступний нашій VM ексклюзивно.
- У Sequential‑режимі проблема SMT‑контеншна непомітна, тому що паралельної роботи немає; саме тому M7i і M7a у Sequential показують схожі цифри, а в Load — розходяться.

#### Чому M7g колапсує на gp3 і "оживає" на io2

- **Найнижчий BogoMIPS (2100)** — у ~2,5 раза менше, ніж у M7a/M7i. Це фундаментальна стеля per‑thread продуктивності.
- На gp3 (3000 IOPS, ~125 MiB/s) повільний CPU не встигає вичерпувати IO‑чергу → накопичення бек‑логу → каскадне зростання latency до 2500–3000 мс.
- io2 із sub‑ms latency на Nitro прибирає очікування дискових операцій → CPU стає єдиним боттлнеком → покращення в ~30 разів (6281 мс → 176 мс на PATCH full).
- Навіть на io2 M7g у ~20 разів повільніший за M7a — це чиста стеля по compute, далі впиратися немає куди.

#### Артефакт швидкості памʼяті (4800 vs 5600 MT/s)

- На M7i і M7a io2‑хости отримали DDR5‑5600, gp3‑хости — DDR5‑4800. M7g обидва на 4800.
- Для CQRS‑воркфлоу робочий набір малий (events + snapshots), тому memory bandwidth не є основним боттлнеком, але **+17%** до швидкості памʼяті дає невеликий внесок у перевагу io2 для M7i/M7a понад чисто дисковий ефект.
- Це означає, що різницю gp3 → io2 для M7i/M7a не можна повністю атрибутувати лише диску — є плутанина (confounding) з memory speed. Для M7g цей фактор відсутній, тому покращення там ×30 — це справді переважно дисковий ефект.

#### Чому Sequential‑режим плоский на всіх кандидатах

- Без конкурентності немає контеншна за CPU, RAM та IO‑чергу.
- Боттлнек послідовний — це сам HTTP round‑trip + Node.js event loop (~1–2 мс) + одна синхронна дискова операція.
- Апаратні переваги M7a (2 фізичні ядра) та переваги io2 (нижча latency на чергу) у цьому режимі невидимі — всі укладаються в ~3–10 мс на запит.

#### Підсумок мапінгу спостережень на апаратні причини

| Спостереження                                  | Апаратна причина                                                                                                        |
|------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| M7a у 2–3 рази швидший за M7i у Load           | 2 фізичні ядра без SMT vs 1 ядро з SMT — немає внутрішнього контеншна                                                   |
| M7g колапсує на gp3 (4500–6000 мс)             | BogoMIPS у ~2,5 раза нижче + gp3 не покриває IO‑чергу повільного CPU                                                    |
| M7g на io2 ще у ~20× повільніший за M7a        | Чиста compute floor (Neoverse‑V1 single‑thread perf), дисковий ефект уже знято                                          |
| io2 для M7i/M7a дає лише одиниці мс покращення | Вони були CPU‑bound, а не disk‑bound; диск не був боттлнеком                                                            |
| io2 для M7g дає ×30 покращення                 | M7g був disk‑bound на gp3 — типова ситуація для слабкого CPU + повільного диска                                         |
| Sequential не дискримінує кандидатів           | Боттлнек у послідовній latency запиту, а не в hardware contention                                                       |
| Classical стабільно швидший за mCQRS на gp3    | Менше дискових операцій (немає окремого snapshot.write + projection.write конкуренції), що критично коли диск повільний |
| На io2 mCQRS може обігнати Classical (M7a)     | Коли диск перестає бути боттлнеком, паралелізм mCQRS обробників стає перевагою                                          |
