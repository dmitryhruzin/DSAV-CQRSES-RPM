variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Prefix for resource names"
  type        = string
  default     = "perf-research"
}

variable "profile_enabled" {
  description = "Enable/disable profile creation. Only profiles with true will be created."
  type        = map(bool)
  default = {
    arm_ddr4   = false
    arm_ddr5   = false
    amd_ddr4   = false
    amd_ddr5   = false
    intel_ddr5 = false
    arm_small  = true
    amd_small  = true
  }
}

variable "source_zip_key" {
  description = "S3 object key for the application archive"
  type        = string
  default     = "source.zip"
}

variable "source_bucket_name" {
  description = "S3 bucket name that contains application archive"
  type        = string
  default     = "temp-perf-research-sources"
}

variable "instance_key_name" {
  description = "Existing EC2 key pair name for SSH access (optional). If null, key from ssh_public_key_path is used."
  type        = string
  default     = null
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key file used when instance_key_name is not set"
  type        = string
  default     = "./keys/perf-research-ed25519.pub"
}

variable "instance_type_override" {
  description = "Override instance type manually; null means use profile default"
  type        = string
  default     = null
}

variable "instance_volume_size" {
  description = "Root EBS volume size in GiB"
  type        = number
  default     = 30
}

variable "instance_volume_type" {
  description = "Root EBS volume type (gp3, io2, io1)"
  type        = string
  default     = "gp3"
}

variable "instance_volume_iops" {
  description = "Provisioned IOPS. Required for io1/io2; ignored for gp3 default."
  type        = number
  default     = null
}

variable "allow_ssh_cidr" {
  description = "CIDR allowed to access SSH"
  type        = string
  default     = "0.0.0.0/0"
}

# --- RDS (PostgreSQL) ---

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "PostgreSQL major version for RDS (minor is chosen automatically)"
  type        = string
  default     = "16"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GiB"
  type        = number
  default     = 20
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "app"
}

variable "db_password" {
  description = "RDS master password. If null, a random one is generated."
  type        = string
  default     = null
  sensitive   = true
}

variable "db_names" {
  description = "Databases to create on the RDS instance (one per app)"
  type        = list(string)
  default     = ["m_cqrs", "classical_cqrs"]
}
