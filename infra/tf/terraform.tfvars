aws_region         = "eu-central-1"
project_name       = "perf-research"
source_bucket_name = "temp-perf-research-sources"
source_zip_key     = "source.zip"

profile_enabled = {
  arm_ddr4   = false
  arm_ddr5   = false
  amd_ddr4   = false
  amd_ddr5   = false
  intel_ddr5 = false
  arm_small  = false
  amd_small  = true # x86_64 profile -> uses Debian amd64 AMI (required for t3.micro)
}

instance_type_override = "t3.nano" # Intel burstable, 2 vCPU / 0.5 GiB, x86_64
ssh_public_key_path = "" # your AWS keys e.g. "./keys/perf-research-ed25519.pub" 
allow_ssh_cidr      = "0.0.0.0/0"

instance_volume_size = 100
instance_volume_type = "gp3"

# --- RDS ---
db_instance_class = "db.t4g.small" # ARM (Graviton2) burstable, 2 vCPU / 2 GiB
