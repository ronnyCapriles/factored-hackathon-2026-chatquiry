from app.core.context import Locale

# Strings the backend composes itself. Stored config text is translated per row instead.
MESSAGES: dict[str, dict[Locale, str]] = {
    "yes": {"es": "sí", "en": "yes", "pt": "sim"},
    "no": {"es": "no", "en": "no", "pt": "não"},
    "draft_profile": {"es": "Borrador · sin departamento", "en": "Draft · no department", "pt": "Rascunho · sem departamento"},
    "kpi_safe_resolution": {"es": "Resolución segura", "en": "Safe resolution", "pt": "Resolução segura"},
    "kpi_safe_resolution_hint": {"es": "n / N elegibles", "en": "n / N eligible", "pt": "n / N elegíveis"},
    "kpi_containment": {"es": "Contención", "en": "Containment", "pt": "Contenção"},
    "kpi_containment_hint": {"es": "sin pasar a persona", "en": "without a handoff", "pt": "sem transferir"},
    "kpi_handoff_quality": {"es": "Traspaso correcto", "en": "Correct handoff", "pt": "Transferência correta"},
    "kpi_handoff_quality_hint": {"es": "omitidos · innecesarios", "en": "missed · unnecessary", "pt": "omitidas · desnecessárias"},
    "kpi_unsafe": {"es": "Inseguros", "en": "Unsafe", "pt": "Inseguros"},
    "kpi_unsafe_hint": {"es": "divulgación · acción", "en": "disclosure · action", "pt": "divulgação · ação"},
    "kpi_latency": {"es": "Latencia p50/p95", "en": "Latency p50/p95", "pt": "Latência p50/p95"},
    "kpi_latency_hint": {"es": "por respuesta", "en": "per reply", "pt": "por resposta"},
    "kpi_cost": {"es": "Costo / caso", "en": "Cost / case", "pt": "Custo / caso"},
    "kpi_cost_hint": {"es": "y por resolución", "en": "and per resolution", "pt": "e por resolução"},
    "seg_es": {"es": "Español", "en": "Spanish", "pt": "Espanhol"},
    "seg_pt": {"es": "Portugués", "en": "Portuguese", "pt": "Português"},
    "alert_no_human": {"es": "Esperan a una persona", "en": "Waiting for a person", "pt": "Aguardam uma pessoa"},
    "alert_no_human_hint": {"es": "conversaciones sin agente asignado", "en": "conversations without an agent", "pt": "conversas sem agente"},
    "alert_guardrail": {"es": "Bloqueos del guardrail", "en": "Guardrail blocks", "pt": "Bloqueios do guardrail"},
    "alert_guardrail_hint": {"es": "posible campaña de inyección", "en": "possible injection campaign", "pt": "possível campanha de injeção"},
    "perm_reply": {"es": "Responder y resolver conversaciones", "en": "Reply to and resolve conversations", "pt": "Responder e resolver conversas"},
    "perm_read": {
        "es": "Ver conversaciones, clientes, disputas y trazas",
        "en": "View conversations, customers, disputes and traces",
        "pt": "Ver conversas, clientes, contestações e rastros",
    },
    "perm_human_actions": {
        "es": "Acciones solo humanas (bloquear tarjeta)",
        "en": "Human-only actions (block card)",
        "pt": "Ações somente humanas (bloquear cartão)",
    },
    "perm_test_chat": {"es": "Usar el chat de prueba", "en": "Use the test chat", "pt": "Usar o chat de teste"},
    "perm_admin_views": {
        "es": "Ver operación, auditoría y configuración",
        "en": "View operations, audit and configuration",
        "pt": "Ver operação, auditoria e configuração",
    },
    "perm_self_profile": {"es": "Editar su propio perfil", "en": "Edit their own profile", "pt": "Editar o próprio perfil"},
}


def T(locale: Locale, key: str) -> str:
    entry = MESSAGES.get(key)
    if not entry:
        return key
    return entry.get(locale) or entry["es"]
