# The API reads these as CQ_GUARDRAIL_ID and CQ_GUARDRAIL_VERSION.
output "guardrail_id" { value = module.guardrail.guardrail_id }
output "guardrail_version" { value = module.guardrail.version }
output "guardrail_arn" { value = module.guardrail.guardrail_arn }
