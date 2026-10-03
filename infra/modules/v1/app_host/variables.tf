variable "name" { type = string }

variable "instance_type" {
  type        = string
  default     = "t4g.small"
  description = "Graviton, so the API image must be built for linux/arm64."
}

variable "root_size_gb" {
  type    = number
  default = 30
}

variable "guardrail_arn" {
  type        = string
  description = "The only guardrail the API may apply."
}

variable "secret_prefix" {
  type        = string
  description = "Secrets Manager names under this prefix are readable by the instance, for example chatquiry/prod."
}

variable "tags" {
  type    = map(string)
  default = {}
}
