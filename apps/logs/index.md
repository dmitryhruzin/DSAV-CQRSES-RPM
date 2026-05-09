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
admin@ip-172-31-22-194:~$ sudo dmidecode -t memory
# dmidecode 3.4
Getting SMBIOS data from sysfs.
SMBIOS 3.0.0 present.
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
