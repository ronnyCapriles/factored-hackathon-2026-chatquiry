output "instance_id" { value = module.app_host.instance_id }
output "public_ip" { value = module.app_host.public_ip }
output "repository_url" { value = module.app_host.repository_url }
output "secret_names" { value = [for s in aws_secretsmanager_secret.app : s.name] }
