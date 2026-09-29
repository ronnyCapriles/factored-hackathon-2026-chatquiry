"""Customer-facing sentences the orchestrator writes itself, for outcomes that must not depend on the model."""

from decimal import Decimal

from app.core.context import Locale

TEXTS: dict[str, dict[Locale, str]] = {
    "only_own_accounts": {
        "es": "Solo puedo ayudarte con las cuentas a tu nombre. ¿Hay algo de tus movimientos que quieras revisar?",
        "en": "I can only help with accounts in your name. Is there anything in your transactions you'd like to check?",
        "pt": "Só posso ajudar com as contas no seu nome. Tem algo nas suas movimentações que você quer revisar?",
    },
    "handoff": {
        "es": "Te paso con {agent}, del equipo de {department}. Ya tiene todo el contexto, no vas a tener que repetir nada.",
        "en": "I'm passing you to {agent} from the {department} team. They already have the full context, so you won't need to repeat anything.",
        "pt": "Vou passar você para {agent}, da equipe de {department}. Já tem todo o contexto, você não vai precisar repetir nada.",
    },
    "handoff_fraud": {
        "es": "Como puede tratarse de fraude, te paso con {agent}, del equipo de {department}. Ya tiene todo el contexto, no vas a tener que repetir nada.",
        "en": "Since this may be fraud, I'm passing you to {agent} from the {department} team. They already have the full context.",
        "pt": "Como pode ser fraude, vou passar você para {agent}, da equipe de {department}. Já tem todo o contexto, você não vai precisar repetir nada.",
    },
    "handoff_after_reply": {
        "es": "{agent}, del equipo de {department}, ya tiene todo el contexto y sigue contigo por aquí.",
        "en": "{agent} from the {department} team already has the full context and will continue with you here.",
        "pt": "{agent}, da equipe de {department}, já tem todo o contexto e continua com você por aqui.",
    },
    "handoff_security": {
        "es": "Para proteger la cuenta, esta conversación sigue con {agent}, del equipo de {department}. Ya tiene todo el contexto.",
        "en": "To protect the account, this conversation continues with {agent} from the {department} team. They already have the full context.",
        "pt": "Para proteger a conta, esta conversa continua com {agent}, da equipe de {department}. Já tem todo o contexto.",
    },
    "handoff_frustration": {
        "es": "Lamento que esto te esté costando tanto. Te paso con {agent}, del equipo de {department}, que ya tiene todo el contexto y va a seguir contigo por aquí.",
        "en": "I'm sorry this is taking so much of your time. I'm passing you to {agent} from the {department} team, who already has the full context and will continue with you here.",
        "pt": "Sinto muito que isso esteja dando tanto trabalho. Vou passar você para {agent}, da equipe de {department}, que já tem todo o contexto e vai continuar com você por aqui.",
    },
    "handoff_unassigned": {
        "es": "Una persona del equipo va a continuar contigo por aquí. Ya tiene todo el contexto.",
        "en": "A person from the team will continue with you here. They already have the full context.",
        "pt": "Uma pessoa da equipe vai continuar com você por aqui. Já tem todo o contexto.",
    },
    "handoff_request": {
        "es": "Claro.",
        "en": "Of course.",
        "pt": "Claro.",
    },
    "agent_joined": {
        "es": "{agent} se unió a la conversación",
        "en": "{agent} joined the conversation",
        "pt": "{agent} entrou na conversa",
    },
    "dispute_created": {
        "es": "Listo, la disputa por {amount} quedó registrada con el número {dispute}.",
        "en": "Done, the dispute for {amount} is registered under number {dispute}.",
        "pt": "Pronto, a contestação de {amount} ficou registrada com o número {dispute}.",
    },
    "dispute_created_next": {
        "es": "Te aviso por aquí cualquier novedad. ¿Hay algo más en lo que te ayude?",
        "en": "I'll let you know here about any updates. Is there anything else I can help with?",
        "pt": "Aviso por aqui qualquer novidade. Posso ajudar em mais alguma coisa?",
    },
    "dispute_declined": {
        "es": "De acuerdo, no abro nada por ahora. Si cambias de opinión, solo dímelo.",
        "en": "All right, I won't open anything for now. If you change your mind, just tell me.",
        "pt": "Tudo bem, não vou abrir nada por enquanto. Se mudar de ideia, é só me dizer.",
    },
    "outside_this_chat": {
        "es": "Eso no lo puedo resolver por este chat. Puedes gestionarlo en la app del banco o en una sucursal, y si prefieres te comunico con una persona.",
        "en": "I can't handle that in this chat. You can do it in the bank's app or at a branch, and if you prefer I can connect you with a person.",
        "pt": "Isso eu não consigo resolver por este chat. Você pode fazer pelo app do banco ou numa agência, e se preferir te passo para uma pessoa.",
    },
    "never_share_secrets": {
        "es": "Por tu seguridad, nunca compartas tu PIN, contraseña ni código de seguridad por este chat. Nadie del banco te los va a pedir. ¿En qué más te ayudo?",
        "en": "For your security, never share your PIN, password or security code in this chat. No one at the bank will ask for them. How else can I help?",
        "pt": "Para sua segurança, nunca compartilhe seu PIN, senha ou código de segurança por este chat. Ninguém do banco vai pedir isso. Posso ajudar em mais alguma coisa?",
    },
    "technical_problem": {
        "es": "Perdona, tuve un problema para revisar eso y no quiero darte un dato equivocado.",
        "en": "Sorry, I had a problem checking that and I don't want to give you wrong information.",
        "pt": "Desculpe, tive um problema para verificar isso e não quero te passar uma informação errada.",
    },
    "system_name": {"es": "Sistema", "en": "System", "pt": "Sistema"},
}


def text(key: str, locale: Locale, **values: str) -> str:
    entry = TEXTS[key]
    return (entry.get(locale) or entry["es"]).format(**values)


def money(amount: Decimal | float, currency: str, locale: Locale) -> str:
    """Currency code first; Spanish and Portuguese group with dots and use a decimal comma."""
    formatted = f"{Decimal(amount):,.2f}"
    if locale in ("es", "pt"):
        formatted = formatted.replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{currency} {formatted}"
