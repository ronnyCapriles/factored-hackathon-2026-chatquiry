from typing import Literal

from app.schemas.api import Camel, Channel, ChatLanguage, Language, Permission, Role, Signal, Strength


class TeamMember(Camel):
    id: str
    name: str
    initials: str


class DepartmentOut(Camel):
    id: str
    name: str
    purpose: str
    profile: str | None
    human_team: list[TeamMember]
    channels: list[Channel]
    first_response_sla: str
    hours: str
    rules: list[str]


class PromptVersion(Camel):
    version: str
    date: str
    note: str
    current: bool = False


class AiProfileOut(Camel):
    id: str
    name: str
    initials: str
    department: str
    persona: str
    sample_greeting: dict[Language, str]
    languages: list[Language]
    model: str
    fallback_model: str
    prompt_version: str
    prompt_history: list[PromptVersion]
    guardrail: str
    handoff_triggers: list[str]
    max_turns_before_human: int
    budget_per_conversation: str
    ai_disclosure: bool
    agent_suggestions: bool
    tools: list[str]


class ToolOut(Camel):
    name: str
    title: str
    permission: Permission
    description: str
    connector: str
    scope: str
    profiles: list[str]
    human_roles: list[Role]
    rate_limit: str
    input_schema: str


class IntakeSignalOut(Camel):
    name: str
    kind: Literal["choice", "probability"]
    description: str
    threshold: float | None = None


class IntakeOut(Camel):
    classifier: str
    guardrail: str
    signals: list[IntakeSignalOut]


class RoutingCondition(Camel):
    signal: str
    op: str
    value: str


class RoutingRuleOut(Camel):
    id: str
    priority: int
    name: str
    when: list[RoutingCondition]
    action: Literal["block", "human", "abstain", "route"]
    destination: str
    hits24h: int | None = None


class RoutingExample(Camel):
    message: str
    language: Language
    signals: list[Signal]
    matched: str


class ContentFilter(Camel):
    category: str
    input: Strength
    output: Strength


class PiiRule(Camel):
    entity: str
    action: Literal["mask", "block"]


class DeniedTopic(Camel):
    name: str
    example: str


class GuardrailOut(Camel):
    id: str
    name: str
    version: str
    tier: str
    prompt_attack: Strength
    content_filters: list[ContentFilter]
    pii: list[PiiRule]
    denied_topics: list[DeniedTopic]
    word_filters: list[str]
    grounding_threshold: float
    blocked_message: dict[ChatLanguage, str]


class PolicyOutcome(Camel):
    when: str
    decision: str
    human: bool = False


class LabelValue(Camel):
    name: str
    value: str


class PolicyOut(Camel):
    id: str
    name: str
    version: str
    domain: str
    description: str
    parameters: list[LabelValue]
    outcomes: list[PolicyOutcome]
    history: list[PromptVersion]
    test_cases: int
    used_by: list[str]


class ConfigOut(Camel):
    departments: list[DepartmentOut]
    profiles: list[AiProfileOut]
    tools: list[ToolOut]
    intake: IntakeOut
    routing: list[RoutingRuleOut]
    routing_examples: list[RoutingExample]
    guardrails: list[GuardrailOut]
    policies: list[PolicyOut]


class ApiKeyOut(Camel):
    id: str
    name: str
    masked: str
    environment: Literal["live", "test"]
    scopes: list[str]
    active: bool


class ChannelOut(Camel):
    channel: Channel
    name: str
    detail: str
    status: str


class ConnectorOut(Camel):
    name: str
    detail: str
    status: str
    planned: bool = False


class IntegrationsOut(Camel):
    api_keys: list[ApiKeyOut]
    channels: list[ChannelOut]
    connectors: list[ConnectorOut]


class RolePermissionOut(Camel):
    permission: str
    agent: str
    admin: str


class Kpi(Camel):
    key: str
    label: str
    value: str | None
    hint: str
    display: bool = False


class SegmentRow(Camel):
    group: str
    n: int | None
    ai_resolved: str | None
    with_human: str | None
    unsafe: int | None


class AlertOut(Camel):
    id: str
    title: str
    hint: str
    value: str | None
    severe: bool


class OperationsOut(Camel):
    sample: bool
    kpis: list[Kpi]
    segments: list[SegmentRow]
    alerts: list[AlertOut]
