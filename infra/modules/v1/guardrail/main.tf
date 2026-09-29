data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_bedrock_guardrail" "this" {
  name                      = var.name
  description               = var.description
  blocked_input_messaging   = var.blocked_message
  blocked_outputs_messaging = var.blocked_message

  cross_region_config {
    guardrail_profile_identifier = "arn:aws:bedrock:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:guardrail-profile/${var.cross_region_profile}"
  }

  content_policy_config {
    tier_config = [{ tier_name = var.tier }]

    dynamic "filters_config" {
      for_each = var.content_filters
      content {
        type            = filters_config.value.type
        input_strength  = filters_config.value.input
        output_strength = filters_config.value.output
      }
    }

    # Prompt attacks only exist on the input side; Bedrock rejects any other output strength.
    filters_config {
      type            = "PROMPT_ATTACK"
      input_strength  = var.prompt_attack_strength
      output_strength = "NONE"
    }
  }

  # Without the input side set explicitly, Bedrock only evaluates masking on model output.
  sensitive_information_policy_config {
    dynamic "pii_entities_config" {
      for_each = var.pii_entities
      content {
        type           = pii_entities_config.value.type
        action         = pii_entities_config.value.action
        input_action   = pii_entities_config.value.action
        input_enabled  = true
        output_action  = pii_entities_config.value.action
        output_enabled = true
      }
    }

    dynamic "regexes_config" {
      for_each = var.regexes
      content {
        name           = regexes_config.value.name
        description    = regexes_config.value.description
        pattern        = regexes_config.value.pattern
        action         = regexes_config.value.action
        input_action   = regexes_config.value.action
        input_enabled  = true
        output_action  = regexes_config.value.action
        output_enabled = true
      }
    }
  }

  topic_policy_config {
    tier_config = [{ tier_name = var.tier }]

    dynamic "topics_config" {
      for_each = var.denied_topics
      content {
        name       = topics_config.value.name
        definition = topics_config.value.definition
        examples   = topics_config.value.examples
        type       = "DENY"
      }
    }
  }

  tags = var.tags
}

# The API pins a numbered version; DRAFT changes with every apply.
resource "aws_bedrock_guardrail_version" "this" {
  guardrail_arn = aws_bedrock_guardrail.this.guardrail_arn
  description   = "Published by terraform, guardrail updated ${aws_bedrock_guardrail.this.updated_at}"
  skip_destroy  = true
}
