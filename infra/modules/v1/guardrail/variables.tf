variable "name" { type = string }
variable "description" { type = string }

variable "blocked_message" {
  type        = string
  description = "Bedrock returns it when it blocks; the API replaces it with a localized sentence."
}

variable "tier" {
  type        = string
  default     = "STANDARD"
  description = "STANDARD covers Spanish and Portuguese for prompt attacks; CLASSIC does not."
}

variable "cross_region_profile" {
  type        = string
  description = "Guardrail profile the STANDARD tier runs through, for example us.guardrail.v1:0."
}

variable "prompt_attack_strength" {
  type    = string
  default = "HIGH"
}

variable "content_filters" {
  type = list(object({
    type   = string
    input  = string
    output = string
  }))
}

variable "pii_entities" {
  type = list(object({
    type   = string
    action = string
  }))
}

variable "regexes" {
  type = list(object({
    name        = string
    description = string
    pattern     = string
    action      = string
  }))
  default = []
}

variable "denied_topics" {
  type = list(object({
    name       = string
    definition = string
    examples   = list(string)
  }))
}

variable "tags" {
  type    = map(string)
  default = {}
}
