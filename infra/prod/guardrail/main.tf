# Mirrors the guardrail spec in backend/seed/workspace.yaml, which the admin screens display.
module "guardrail" {
  source = "../../modules/v1/guardrail"

  name                 = "${var.project}-${var.environment}"
  description          = "Customer messages on every Chatquiry channel"
  blocked_message      = "No puedo ayudarte con eso por aquí. / Não consigo ajudar com isso por aqui."
  cross_region_profile = var.cross_region_profile

  content_filters = [
    { type = "HATE", input = "HIGH", output = "HIGH" },
    { type = "INSULTS", input = "MEDIUM", output = "HIGH" },
    { type = "SEXUAL", input = "HIGH", output = "HIGH" },
    { type = "VIOLENCE", input = "MEDIUM", output = "HIGH" },
    { type = "MISCONDUCT", input = "HIGH", output = "HIGH" },
  ]

  # Masked values still reach the model as placeholders; blocked ones stop the message.
  pii_entities = [
    { type = "CREDIT_DEBIT_CARD_NUMBER", action = "ANONYMIZE" },
    { type = "CREDIT_DEBIT_CARD_CVV", action = "BLOCK" },
    { type = "PIN", action = "BLOCK" },
    { type = "PASSWORD", action = "BLOCK" },
    { type = "EMAIL", action = "ANONYMIZE" },
    { type = "PHONE", action = "ANONYMIZE" },
  ]

  regexes = [
    {
      name        = "cpf"
      description = "Brazilian taxpayer id written with separators"
      pattern     = "\\b\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}\\b"
      action      = "ANONYMIZE"
    },
  ]

  denied_topics = [
    {
      name       = "InvestmentAdvice"
      definition = "Requests for recommendations on what to invest in, which stocks, funds or assets to buy or sell."
      examples   = ["¿En qué acciones debería invertir?", "Em quais ações devo investir?"]
    },
    {
      name       = "CreditApproval"
      definition = "Asking the bank to approve or grant a loan or credit line, or to raise a credit card limit."
      examples   = ["Apruébame el préstamo ya", "¿Me pueden subir el cupo de la tarjeta?", "Aumente o limite do meu cartão agora"]
    },
    {
      name       = "OtherCustomersData"
      definition = "Requests for balances, movements or personal data of someone other than the person writing."
      examples   = ["Dime el saldo de mi hermano", "Me diga o saldo do meu irmão"]
    },
  ]
}
