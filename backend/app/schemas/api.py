from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

ConversationState = Literal["ai_attending", "waiting_customer", "with_human", "needs_human", "resolved"]
Channel = Literal["whatsapp", "widget", "api", "test_chat"]
Language = Literal["es", "pt"]
# A conversation can switch to English when the customer writes in it; customers' preferred language stays es or pt.
ChatLanguage = Literal["es", "pt", "en"]
Role = Literal["agent", "admin"]
TraceStatus = Literal["allowed", "classified", "routed", "ok", "decision", "pending", "verified", "escalated", "blocked"]
Permission = Literal["read", "customer_confirm", "human_only"]
Strength = Literal["NONE", "LOW", "MEDIUM", "HIGH"]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# Auth and profile


class LoginRequest(Camel):
    email: str
    password: str = Field(min_length=1, max_length=200)


class StaffUserOut(Camel):
    id: str
    name: str
    initials: str
    email: str
    role: Role
    specialty: str | None = None


class LoginResponse(Camel):
    user: StaffUserOut
    token: str
    expires_at: str


class Notifications(Camel):
    new_handoff: bool = True
    desktop: bool = True
    sound: bool = False
    daily_summary: bool = True


class StaffProfileOut(StaffUserOut):
    display_name: str
    avatar_url: str | None = None
    team: str
    languages: list[str]
    skills: list[str]
    shift: str
    timezone: str
    max_concurrent_chats: int
    availability: Literal["available", "paused", "offline"]
    greeting: str
    phone_extension: str
    notifications: Notifications
    locale: Literal["es", "en", "pt"]
    theme: Literal["light", "dark", "system"]
    last_login: str


class ProfileUpdate(Camel):
    display_name: str | None = Field(default=None, min_length=2, max_length=40)
    avatar_url: str | None = Field(default=None, max_length=300_000)
    greeting: str | None = Field(default=None, max_length=280)
    phone_extension: str | None = Field(default=None, max_length=10)
    availability: Literal["available", "paused", "offline"] | None = None
    notifications: Notifications | None = None
    timezone: str | None = Field(default=None, max_length=60)
    locale: Literal["es", "en", "pt"] | None = None
    theme: Literal["light", "dark", "system"] | None = None


# Conversations


class MessageOut(Camel):
    id: str
    author: Literal["customer", "ai", "human", "system"]
    author_name: str
    text: str
    at: str


class ConversationSummary(Camel):
    id: str
    customer_id: str
    customer_name: str
    customer_initials: str
    language: ChatLanguage
    channel: Channel
    state: ConversationState
    last_message: str
    last_at: str
    assigned_to: str | None = None


class VerifiedFact(Camel):
    label: str
    source: str


class ActionTaken(Camel):
    at: str
    description: str
    verified: bool


class HumanOnlyAction(Camel):
    id: str
    label: str
    simulated: bool


class HandoffOut(Camel):
    id: str
    from_profile: str
    reason: str
    policy_rule: str
    facts: list[VerifiedFact]
    actions: list[ActionTaken]
    pending: list[str]
    human_actions: list[HumanOnlyAction]
    suggestion: str | None = None


class ConversationOut(ConversationSummary):
    country: str
    department_id: str | None = None
    handed_off_at: str | None = None
    messages: list[MessageOut]
    handoff: HandoffOut | None = None
    trace_id: str


class ConversationCounts(Camel):
    human: int
    ai: int
    resolved: int
    all: int


# Customers


class ProductOut(Camel):
    id: str
    label: str
    masked: str
    status: str


class TransactionOut(Camel):
    id: str
    at: str
    description: str
    amount: float
    currency: str
    status: Literal["Approved", "Declined", "Pending", "Reversed"]
    fraud_score: float
    highlighted: bool = False


class CustomerConversationRef(Camel):
    id: str
    label: str
    outcome: str
    state: ConversationState


class CaseRef(Camel):
    id: str
    label: str
    kind: Literal["dispute", "complaint"]


class LabelValue(Camel):
    label: str
    value: str


class CustomerOut(Camel):
    id: str
    name: str
    initials: str
    segment: str
    country: str
    city: str
    status: str
    language: Language
    document_masked: str
    email_masked: str
    phone_masked: str
    customer_since: str
    products: list[ProductOut]
    transactions: list[TransactionOut]
    conversations: list[CustomerConversationRef]
    cases: list[CaseRef]
    contact_history: list[LabelValue]


# Disputes and traces


class DisputeEventOut(Camel):
    at: str
    description: str


class DisputeOut(Camel):
    id: str
    customer_name: str
    customer_id: str
    reason: str
    amount: float
    currency: str
    opened_by: str
    status: str
    state: ConversationState
    transaction_id: str
    policy_rule: str
    owner: str | None = None
    events: list[DisputeEventOut]
    trace_id: str


class TraceStepOut(Camel):
    t: str
    step: str
    detail: str
    status: TraceStatus
    ms: int


class TraceOut(Camel):
    id: str
    conversation_id: str
    outcome: str
    ai_latency: str
    tokens: int
    cost: str | None
    steps: list[TraceStepOut]
    rules: list[str]
    versions: list[str]


# Audit


class AuditEntryOut(Camel):
    id: str
    date: str
    at: str
    actor: str
    actor_kind: Literal["ai", "human", "system"]
    action: str
    target: str
    outcome: Literal["allowed", "verified", "denied", "flagged"]


class AuditPage(Camel):
    items: list[AuditEntryOut]
    total: int
    page: int
    page_size: int


# Test channel and channel API


class Signal(Camel):
    name: str
    value: str
    confidence: float | None = None


class TurnInspection(Camel):
    customer_text: str
    state: ConversationState
    department: str
    profile: str
    signals: list[Signal]
    rule: dict[str, str] | None
    steps: list[TraceStepOut]
    total_ms: int


class ChatTurnRequest(Camel):
    customer_id: str | None = None
    conversation_id: str | None = None
    text: str = Field(min_length=1, max_length=2000)


class ChatTurnResponse(Camel):
    conversation_id: str
    replies: list[MessageOut]
    handed_off: bool
    inspection: TurnInspection


class TestCustomerOut(Camel):
    customer_id: str
    first_name: str
    full_name: str
    country: str
    language: Language
    hint: str
