# Terraform: S3 + EC2 + Docker Compose benchmark runner

This config creates:
- Uses S3 bucket from `source_bucket_name` variable with `source.zip` (or custom key) in root
- EC2 instance on Debian 12 that downloads `source.zip`, unpacks it, installs Docker, and runs `docker compose up -d`
- Profile switch to launch different CPU/memory generation combinations for benchmarking

## Profiles

Set `profile_enabled` flags (`true` = create, `false` = skip):
- `arm_ddr4` -> `m6g.large` (Graviton2 generation)
- `arm_ddr5` -> `m7g.large` (Graviton3 generation)
- `amd_ddr4` -> `m6a.large` (EPYC older generation)
- `amd_ddr5` -> `m7a.large` (EPYC newer generation)
- `arm_small` -> `t4g.small` (ARM burstable, small size)
- `amd_small` -> `t3a.small` (x86 burstable, small size)

> AWS does not expose a direct "DDR flag" in Terraform. Here DDR is approximated by instance family generation.

## Usage

1. Ensure archive exists in `s3://<source_bucket_name>/<source_zip_key>`.
2. Create variables file:

```bash
cp terraform.tfvars.example terraform.tfvars
```

3. Edit `terraform.tfvars` (region, SSH key, profile flags).
   - Default behavior: Terraform creates/imports EC2 key pair from `./keys/perf-research-ed25519.pub`
   - Optional: set `instance_key_name` to use an already existing AWS key pair
4. Deploy:

```bash
terraform init
terraform apply
```

5. For `m7i.large` launch, keep any x86 profile enabled and set:

```hcl
instance_type_override = "m7i.large"
```

6. Run any combination by toggling flags:

```bash
terraform apply -var='profile_enabled={arm_ddr4=true,arm_ddr5=false,amd_ddr4=false,amd_ddr5=false,arm_small=false,amd_small=false}'
terraform apply -var='profile_enabled={arm_ddr4=false,arm_ddr5=true,amd_ddr4=false,amd_ddr5=false,arm_small=false,amd_small=false}'
terraform apply -var='profile_enabled={arm_ddr4=false,arm_ddr5=false,amd_ddr4=true,amd_ddr5=true,arm_small=false,amd_small=false}'
```

7. Destroy when done:

```bash
terraform destroy
```

## App archive expectation

`source.zip` should unpack into a directory containing one of:
- `docker-compose.yml`
- `compose.yaml`

and all app files required by compose.
