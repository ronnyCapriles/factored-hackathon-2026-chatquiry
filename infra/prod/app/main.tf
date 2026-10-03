data "terraform_remote_state" "guardrail" {
  backend = "s3"

  config = {
    bucket = var.state_bucket
    key    = "prod/guardrail/terraform.tfstate"
    region = var.region
  }
}

locals {
  name          = "${var.project}-${var.environment}"
  secret_prefix = "${var.project}/${var.environment}"
  # Values are set with the CLI so they never enter the Terraform state.
  secrets = ["postgres-password", "jwt-secret", "seed-password", "typesafe-api-key"]
}

module "app_host" {
  source = "../../modules/v1/app_host"

  name          = local.name
  instance_type = var.instance_type
  guardrail_arn = data.terraform_remote_state.guardrail.outputs.guardrail_arn
  secret_prefix = local.secret_prefix
}

resource "aws_secretsmanager_secret" "app" {
  for_each = toset(local.secrets)
  name     = "${local.secret_prefix}/${each.key}"
  # Without this a destroy keeps the name reserved for a week and the next apply fails.
  recovery_window_in_days = 0
}

resource "aws_budgets_budget" "monthly" {
  name         = local.name
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_email]
  }
}
