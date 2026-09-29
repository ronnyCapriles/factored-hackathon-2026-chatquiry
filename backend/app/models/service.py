from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Tenant, Timestamps


class Conversation(Base, Tenant, Timestamps):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    customer_id: Mapped[str] = mapped_column(String(20), ForeignKey("customers.customer_id"), index=True)
    channel: Mapped[str] = mapped_column(String(16))
    language: Mapped[str] = mapped_column(String(2))
    state: Mapped[str] = mapped_column(String(20), index=True)
    department_id: Mapped[str | None] = mapped_column(String(32))
    profile_id: Mapped[str | None] = mapped_column(String(32))
    assigned_to: Mapped[str | None] = mapped_column(String(32), ForeignKey("staff_users.id"))
    handed_off_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 6), default=0)
    turns: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Running counts routing reads: security strikes, frustration, requests for a person.
    flags: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    # The model's side of the conversation, tool calls included, replayed on every turn.
    agent_messages: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default="[]")


class Message(Base, Tenant):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(32), ForeignKey("conversations.id"), index=True)
    author: Mapped[str] = mapped_column(String(10))
    author_name: Mapped[str] = mapped_column(String(60))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Handoff(Base, Tenant):
    __tablename__ = "handoffs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(32), ForeignKey("conversations.id"), unique=True)
    from_profile: Mapped[str] = mapped_column(String(60))
    reason: Mapped[str] = mapped_column(Text)
    policy_rule: Mapped[str] = mapped_column(String(40))
    facts: Mapped[list[dict]] = mapped_column(JSON, default=list)
    actions: Mapped[list[dict]] = mapped_column(JSON, default=list)
    pending: Mapped[list[str]] = mapped_column(JSON, default=list)
    human_actions: Mapped[list[dict]] = mapped_column(JSON, default=list)
    suggestion: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PendingAction(Base, Tenant):
    """An action the model proposed that waits for the customer's explicit yes."""

    __tablename__ = "pending_actions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(32), ForeignKey("conversations.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Dispute(Base, Tenant, Timestamps):
    __tablename__ = "disputes"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    customer_id: Mapped[str] = mapped_column(String(20), ForeignKey("customers.customer_id"), index=True)
    transaction_id: Mapped[str] = mapped_column(String(30))
    conversation_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("conversations.id"))
    reason: Mapped[str] = mapped_column(String(40))
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    currency: Mapped[str] = mapped_column(String(3))
    state: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(40))
    policy_rule: Mapped[str] = mapped_column(String(40))
    opened_by: Mapped[str] = mapped_column(String(60))
    owner_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("staff_users.id"))


class DisputeEvent(Base, Tenant):
    __tablename__ = "dispute_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dispute_id: Mapped[str] = mapped_column(String(32), ForeignKey("disputes.id"), index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    description: Mapped[str] = mapped_column(Text)


class TraceEvent(Base, Tenant):
    __tablename__ = "trace_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(String(32), ForeignKey("conversations.id"), index=True)
    turn: Mapped[int] = mapped_column(Integer)
    seq: Mapped[int] = mapped_column(Integer)
    t_ms: Mapped[int] = mapped_column(Integer)
    step: Mapped[str] = mapped_column(String(60))
    detail: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16))
    ms: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class AuditLog(Base, Tenant):
    """Append-only. Nothing updates or deletes rows here."""

    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    actor: Mapped[str] = mapped_column(String(80))
    actor_kind: Mapped[str] = mapped_column(String(10))
    action: Mapped[str] = mapped_column(Text)
    target: Mapped[str] = mapped_column(String(60))
    outcome: Mapped[str] = mapped_column(String(10), index=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
