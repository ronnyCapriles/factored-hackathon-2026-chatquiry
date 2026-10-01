from sqlalchemy import JSON, Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Tenant, Timestamps

# Free text is stored per language, e.g. {"es": "...", "en": "...", "pt": "..."}.
Localized = dict[str, str]


class Department(Base, Tenant, Timestamps):
    __tablename__ = "departments"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[Localized] = mapped_column(JSON)
    purpose: Mapped[Localized] = mapped_column(JSON)
    profile_id: Mapped[str | None] = mapped_column(String(32))
    team: Mapped[list[str]] = mapped_column(JSON, default=list)
    channels: Mapped[list[str]] = mapped_column(JSON, default=list)
    first_response_sla: Mapped[Localized] = mapped_column(JSON)
    hours: Mapped[Localized] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class AiProfile(Base, Tenant, Timestamps):
    __tablename__ = "ai_profiles"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(40))
    initials: Mapped[str] = mapped_column(String(4))
    persona: Mapped[Localized] = mapped_column(JSON)
    sample_greeting: Mapped[Localized] = mapped_column(JSON)
    languages: Mapped[list[str]] = mapped_column(JSON)
    model: Mapped[str] = mapped_column(String(60))
    fallback_model: Mapped[str] = mapped_column(String(60))
    prompt_version: Mapped[str] = mapped_column(String(40))
    prompt_history: Mapped[list[dict]] = mapped_column(JSON, default=list)
    guardrail: Mapped[str] = mapped_column(String(60))
    handoff_triggers: Mapped[list[Localized]] = mapped_column(JSON, default=list)
    max_turns: Mapped[int] = mapped_column(Integer, default=12)
    budget_usd: Mapped[float] = mapped_column(default=0.05)
    ai_disclosure: Mapped[bool] = mapped_column(Boolean, default=True)
    agent_suggestions: Mapped[bool] = mapped_column(Boolean, default=True)
    tools: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="active")


class Tool(Base, Tenant, Timestamps):
    __tablename__ = "tools"
    name: Mapped[str] = mapped_column(String(60), primary_key=True)
    title: Mapped[Localized] = mapped_column(JSON)
    permission: Mapped[str] = mapped_column(String(20))
    description: Mapped[Localized] = mapped_column(JSON)
    connector: Mapped[str] = mapped_column(String(80))
    scope_note: Mapped[Localized] = mapped_column(JSON)
    human_roles: Mapped[list[str]] = mapped_column(JSON, default=list)
    rate_limit: Mapped[Localized] = mapped_column(JSON)
    input_schema: Mapped[dict] = mapped_column(JSON)


class RoutingRule(Base, Tenant, Timestamps):
    __tablename__ = "routing_rules"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    priority: Mapped[int] = mapped_column(Integer)
    name: Mapped[Localized] = mapped_column(JSON)
    conditions: Mapped[list[dict]] = mapped_column(JSON)
    action: Mapped[str] = mapped_column(String(10))
    department_id: Mapped[str | None] = mapped_column(String(32))
    destination: Mapped[Localized] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Policy(Base, Tenant, Timestamps):
    __tablename__ = "policies"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[Localized] = mapped_column(JSON)
    version: Mapped[str] = mapped_column(String(10))
    domain: Mapped[Localized] = mapped_column(JSON)
    description: Mapped[Localized] = mapped_column(JSON)
    parameters: Mapped[dict] = mapped_column(JSON)
    outcomes: Mapped[list[dict]] = mapped_column(JSON)
    history: Mapped[list[dict]] = mapped_column(JSON, default=list)
    test_cases: Mapped[int] = mapped_column(Integer, default=0)
    used_by: Mapped[list[str]] = mapped_column(JSON, default=list)


class Guardrail(Base, Tenant, Timestamps):
    __tablename__ = "guardrails"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    version: Mapped[str] = mapped_column(String(10))
    spec: Mapped[dict] = mapped_column(JSON)


class IntakeSignal(Base, Tenant):
    __tablename__ = "intake_signals"
    name: Mapped[str] = mapped_column(String(40), primary_key=True)
    kind: Mapped[str] = mapped_column(String(12))
    description: Mapped[Localized] = mapped_column(JSON)
    threshold: Mapped[float | None] = mapped_column()


class ClassifierQuestions(Base, Tenant, Timestamps):
    """The workspace's own wording of the intake questions. Without a row the defaults in code apply.

    The seed never replaces it, so edits survive a restart.
    """

    __tablename__ = "classifier_questions"
    __table_args__ = (UniqueConstraint("workspace_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    questions: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_by: Mapped[str | None] = mapped_column(String(80))


class Channel(Base, Tenant):
    __tablename__ = "channels"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    detail: Mapped[Localized] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16))


class Connector(Base, Tenant):
    __tablename__ = "connectors"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    detail: Mapped[Localized] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16))
    planned: Mapped[bool] = mapped_column(Boolean, default=False)
