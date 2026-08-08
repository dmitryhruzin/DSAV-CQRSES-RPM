lscpu
Architecture:                aarch64
  CPU op-mode(s):            32-bit, 64-bit
  Byte Order:                Little Endian
CPU(s):                      2
  On-line CPU(s) list:       0,1
Vendor ID:                   ARM
  Model name:                Neoverse-N1
    Model:                   1
    Thread(s) per core:      1
    Core(s) per socket:      2
    Socket(s):               1
    Stepping:                r3p1
    BogoMIPS:                243.75
    Flags:                   fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics fphp asimdhp cpuid asimdrdm lrcpc dcpop asimddp
Caches (sum of all):         
  L1d:                       128 KiB (2 instances)
  L1i:                       128 KiB (2 instances)
  L2:                        2 MiB (2 instances)
  L3:                        32 MiB (1 instance)
NUMA:                        
  NUMA node(s):              1
  NUMA node0 CPU(s):         0,1
Vulnerabilities:             
  Gather data sampling:      Not affected
  Indirect target selection: Not affected
  Itlb multihit:             Not affected
  L1tf:                      Not affected
  Mds:                       Not affected
  Meltdown:                  Not affected
  Mmio stale data:           Not affected
  Reg file data sampling:    Not affected
  Retbleed:                  Not affected
  Spec rstack overflow:      Not affected
  Spec store bypass:         Mitigation; Speculative Store Bypass disabled via prctl
  Spectre v1:                Mitigation; __user pointer sanitization
  Spectre v2:                Mitigation; CSV2, BHB
  Srbds:                     Not affected
  Tsa:                       Not affected
  Tsx async abort:           Not affected
  Vmscape:                   Not affected

sudo apt install dmidecode
sudo dmidecode -t memory

# dmidecode 3.4
Getting SMBIOS data from sysfs.
SMBIOS 3.0.0 present.