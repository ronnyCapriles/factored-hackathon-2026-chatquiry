variable "project" {
  type    = string
  default = "chatquiry"
}

variable "environment" { type = string }
variable "region" { type = string }

variable "state_bucket" {
  type        = string
  description = "Same bucket as backend.hcl; the guardrail ARN is read from its state."
}

variable "instance_type" {
  type    = string
  default = "t4g.small"
}

variable "monthly_budget_usd" {
  type    = number
  default = 50
}

variable "budget_email" {
  type        = string
  description = "Receives the budget alerts. Pass it with TF_VAR_budget_email so it stays out of the repository."
}

variable "github_repository" {
  type        = string
  description = "owner/name of the repository whose main branch may deploy."
}
