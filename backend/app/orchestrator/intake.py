"""Intake: the guardrail check and the signals routing decides on. Neither talks to the customer."""

import asyncio
import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Protocol

import boto3

from app.core.config import get_settings


@dataclass
class Signals:
    language: str
    intent: str
    intent_confidence: float
    injection_risk: float
    needs_human: float
    frustration: float
    closing: bool = False
    identity_doubt: bool = False

    def as_list(self) -> list[dict]:
        return [
            {"name": "language", "value": self.language},
            {"name": "intent", "value": self.intent, "confidence": round(self.intent_confidence, 2)},
            {"name": "injection_risk", "value": f"{self.injection_risk:.2f}"},
            {"name": "needs_human", "value": f"{self.needs_human:.2f}"},
            {"name": "frustration", "value": f"{self.frustration:.2f}"},
        ]

    def value(self, name: str) -> str | float | None:
        return {
            "language": self.language,
            "intent": self.intent,
            "injection_risk": self.injection_risk,
            "needs_human": self.needs_human,
            "frustration": self.frustration,
        }.get(name)


class IntakeClassifier(Protocol):
    name: str

    def classify(self, text: str, current_language: str) -> Signals: ...


def plain(text: str) -> str:
    """Lowercase without accents, so one pattern covers Spanish and Portuguese spellings."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _any(patterns: str, text: str) -> bool:
    return re.search(patterns, text) is not None


INJECTION = (
    r"ignora|ignore|olvida (tus|las) (instrucciones|reglas)|esquece|instrucciones|instrucoes|instructions|system prompt|prompt del sistema|"
    r"actua como|finge ser|you are now|eres ahora|modo desarrollador|developer mode|otra cuenta|outra conta|"
    r"cuenta (numero )?\d{3,}|conta (numero )?\d{3,}|de mi (hermano|esposa|mama|papa)|do meu (irmao|pai)|da minha (mae|esposa)"
)
# Someone saying they are not the account holder is a takeover signal, however polite the rest of the message is.
IDENTITY = (
    r"no soy (yo|el titular|la titular|el dueno|la duena|el cliente|la cliente)\b|no es mi cuenta|esta cuenta no es mia|cuenta de otra persona|"
    r"estoy usando (la cuenta|el celular|el telefono) de|encontre (este|su|el) (celular|telefono)|"
    r"nao sou (eu|o titular|a titular|o dono|a dona|o cliente|a cliente)\b|nao e minha conta|conta de outra pessoa|estou usando (a conta|o celular) de"
)
HUMAN = (
    r"(hablar|habla|comunicar|pasar|pasame|comunicame|atienda|atender) (con|a|me) ?(una |un |el |la )?"
    r"(persona|humano|agente|asesor|ejecutivo|alguien|supervisor|supervisora|gerente|encargad|operador)|"
    r"(falar|fala|passar|me passa|atenda|atender) (com|para|me) ?(uma |um |o |a )?(pessoa|humano|atendente|agente|alguem|supervisor|gerente)|"
    r"persona real|pessoa de verdade|alguien mas|otra persona|alguem mais|outra pessoa|"
    r"quiero (un|una|al|a un) (asesor|agente|humano|supervisor|gerente|persona)|quero (um|uma|o) (atendente|humano|supervisor|gerente|pessoa)"
)
DISPUTE = (
    r"no reconozco|nao reconheco|no (la |lo )?hice|nao fiz|no fui yo|nao fui eu|fraude|cobro raro|cargo raro|compra rara|compra estranha|"
    r"no autorice|nao autorizei|me robaron|clonaron|clonado|disputa|contestar|contestacao|desconozco|desconheco|cobro que no|cobranca que nao"
)
STATUS = (
    r"transferencia|transferi|transfer|transacc|transac|no (me )?(ha )?(llega|llegado)|no llego|nada que llega|nao chegou|nao caiu|pendiente|pendente|"
    r"rechaz|recusad|declin|revert|estorn|movimiento|movimentac|deposit|\bpago\b|pague|pagamento|envie|enviei|no aparece|nao aparece"
)
CREDIT = r"credito|prestamo|emprestimo|\bcupo\b|\blimite\b|hipoteca|tasa de interes|juros|\binvert|inversion|investimento|\bacciones\b|\bacoes\b"
CARD = r"(bloquear|bloquea|bloqueie|perdi|robaron|roubaram) (la |mi |o |meu )?(tarjeta|cartao)|tarjeta nueva|cartao novo|reposicion|segunda via|\bpin\b"
# Strong: the customer threatens to leave or says the service failed them. Mild: annoyance.
FRUSTRATION_STRONG = (
    r"cambiar(me|e)? de banco|trocar de banco|vou sair do banco|me voy del banco|pesimo servicio|mal servicio|pessimo atendimento|"
    r"no me (estas|esta|estan) ayudando|nao (esta|estao) me ajudando|no sirve|nao serve|inutil|que parte de|totalmente frustrad|muy frustrad|"
    r"ya no me importa|nao me importa mais|denuncia|superintendencia|procon"
)
FRUSTRATION = (
    r"!!|frustrad|pesimo|pessimo|horrible|horrivel|terrible|terrivel|harto|cansad|absurdo|inaceptable|inaceitavel|ridiculo|"
    r"molest|irritad|nadie me|ninguem me|otra vez|de novo|no entiendes|nao entende|no me importa|hasta cuando|ate quando|increible"
)
CLOSING = r"^(muchas )?gracias|^obrigad|^valeu|^listo|^perfecto|^perfeito|eso es todo|era isso|nada mas|^chau|^tchau|^adios|^ok,? gracias"

PT_HINT = r"\bnao\b|voce|obrigad|reconheco|cartao|\bola\b|\boi\b|\bsim\b|ontem|\besta\b|\bconta\b|\bisso\b|minha|\bmeu\b|cao\b|\bpode\b|\bquero\b|\bda\b|\bdo\b"
ES_HINT = r"\bno\b|usted|gracias|reconozco|tarjeta|hola|\bsi\b|ayer|cuenta|pueden|quiero|\bmi\b|cion\b|\bel\b|\bla\b|\bdel\b|\bpor\b|\bllega\b|\bhice\b"


class RulesClassifier:
    """Keyword baseline in Spanish and Portuguese. The trained model replaces it behind the same interface."""

    name = "rules-v1"

    def classify(self, text: str, current_language: str) -> Signals:
        t = plain(text)
        pt, es = len(re.findall(PT_HINT, t)), len(re.findall(ES_HINT, t))
        language = "pt" if pt > es else "es" if es > pt else current_language

        if _any(DISPUTE, t):
            intent, confidence = "txn_dispute", 0.9
        elif _any(STATUS, t):
            intent, confidence = "txn_status", 0.88
        elif _any(CARD, t):
            intent, confidence = "card", 0.85
        elif _any(CREDIT, t):
            intent, confidence = "credit", 0.85
        else:
            intent, confidence = "other", 0.55

        human = 0.9 if _any(HUMAN, t) else 0.7 if intent == "card" else 0.1
        frustration = 0.9 if _any(FRUSTRATION_STRONG, t) else 0.75 if _any(FRUSTRATION, t) or (len(t) > 12 and text.isupper()) else 0.1
        return Signals(
            language=language,
            intent=intent,
            intent_confidence=confidence,
            injection_risk=0.93 if _any(INJECTION, t) else 0.02,
            needs_human=human,
            frustration=frustration,
            closing=intent == "other" and len(t.split()) <= 8 and _any(CLOSING, t),
            identity_doubt=_any(IDENTITY, t),
        )


YES = (
    r"^(si|sim|claro|dale|ok|okay|de acuerdo|va|vale|por favor|confirmo|correcto|certo|isso|pode|quero|hazlo|abrela|abre|abra|"
    r"adelante|exacto|exato|afirmativo|perfecto|perfeito)\b"
)
NO = r"^(no|nao|nop|nunca|mejor no|melhor nao|todavia no|ainda nao|cancela|cancelar|espera|aguarda)\b"


def detect_confirmation(text: str) -> tuple[str, float]:
    """Deterministic yes or no to a pending action. The model never makes this call."""
    t = plain(text).strip(" .!¡¿?")
    if _any(NO, t):
        return "no", 0.97
    if _any(YES, t):
        return "yes", 0.98
    return "unclear", 0.5


# Secrets the customer should never type; a message carrying one is not stored anywhere.
SECRET_TYPES = {"PIN", "PASSWORD", "CREDIT_DEBIT_CARD_CVV"}
REDACTED = "[mensaje retenido: contenía un dato secreto]"


@dataclass
class GuardrailResult:
    configured: bool
    blocked: bool
    text: str
    findings: list[str]
    secret: bool = False
    # Denied topics are questions outside this chat; attacks are content or prompt-attack filters.
    topics: list[str] = field(default_factory=list)
    attack: bool = False


@lru_cache
def _bedrock_runtime():
    return boto3.client("bedrock-runtime", region_name=get_settings().aws_region)


async def check_guardrail(text: str) -> GuardrailResult:
    """Bedrock ApplyGuardrail on the customer's message: prompt attacks, denied topics and PII masking."""
    settings = get_settings()
    if not settings.guardrail_id:
        return GuardrailResult(False, False, text, [])
    response = await asyncio.to_thread(
        _bedrock_runtime().apply_guardrail,
        guardrailIdentifier=settings.guardrail_id,
        guardrailVersion=settings.guardrail_version,
        source="INPUT",
        content=[{"text": {"text": text}}],
    )
    findings: list[str] = []
    blocked = False
    secret = False
    topics: list[str] = []
    attack = False
    for assessment in response.get("assessments", []):
        topics += [t["name"] for t in assessment.get("topicPolicy", {}).get("topics", []) if t.get("action") == "BLOCKED"]
        attack = attack or any(f.get("action") == "BLOCKED" for f in assessment.get("contentPolicy", {}).get("filters", []))
        groups = [
            assessment.get("contentPolicy", {}).get("filters", []),
            assessment.get("topicPolicy", {}).get("topics", []),
            assessment.get("wordPolicy", {}).get("customWords", []),
            assessment.get("wordPolicy", {}).get("managedWordLists", []),
            assessment.get("sensitiveInformationPolicy", {}).get("piiEntities", []),
        ]
        for group in groups:
            for item in group:
                # Topics carry their name; filters and PII carry their type.
                findings.append(item.get("name") or item.get("type") or item.get("match") or "finding")
                blocked = blocked or item.get("action") == "BLOCKED"
                secret = secret or (item.get("type") in SECRET_TYPES and item.get("action") == "BLOCKED")
    outputs = response.get("outputs") or []
    if secret:
        return GuardrailResult(True, True, REDACTED, findings, secret=True)
    masked = outputs[0]["text"] if outputs and not blocked else text
    return GuardrailResult(True, blocked, masked, findings, topics=topics, attack=attack)


@lru_cache
def get_classifier() -> IntakeClassifier:
    return RulesClassifier()
