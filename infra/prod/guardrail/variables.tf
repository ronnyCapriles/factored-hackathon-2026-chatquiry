variable "project" {
  type    = string
  default = "chatquiry"
}

variable "environment" { type = string }
variable "region" { type = string }

variable "cross_region_profile" {
  type    = string
  default = "us.guardrail.v1:0"
}
