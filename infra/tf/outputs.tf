output "enabled_profiles" {
  value = [for name, enabled in var.profile_enabled : name if enabled]
}

output "selected_instance_types" {
  value = { for name, cfg in local.enabled_profiles : name => cfg.instance_type }
}

output "s3_bucket_name" {
  value = data.aws_s3_bucket.app_artifacts.bucket
}

output "s3_object_key" {
  value = var.source_zip_key
}

output "ec2_instance_ids" {
  value = { for name, instance in aws_instance.app_host : name => instance.id }
}

output "ec2_public_ips" {
  value = { for name, instance in aws_instance.app_host : name => instance.public_ip }
}

output "ec2_public_dns" {
  value = { for name, instance in aws_instance.app_host : name => instance.public_dns }
}

output "rds_endpoint" {
  description = "RDS host:port"
  value       = aws_db_instance.this.endpoint
}

output "rds_address" {
  description = "RDS hostname"
  value       = aws_db_instance.this.address
}

output "rds_username" {
  value = var.db_username
}

output "rds_password" {
  description = "RDS master password (generated if not supplied)"
  value       = local.db_password
  sensitive   = true // set to false to see password in terminal
}

output "rds_databases" {
  value = var.db_names
}
