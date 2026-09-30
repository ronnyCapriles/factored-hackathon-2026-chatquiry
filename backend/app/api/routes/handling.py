"""What a person does once a conversation is theirs: reply, resolve, hand it back to the AI, run human-only actions."""

import secrets

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import Field
from sqlalchemy import select

from app.api.deps import Agent, Session, Staff
from app.core.context import RequestContext
from app.models import AiProfile, Conversation, Handoff, Message, StaffUser
from app.models.base import utcnow
from app.orchestrator.routing import COUNTERS
from app.orchestrator.texts import text as say
from app.schemas.api import Camel, ConversationState, MessageOut
from app.services.audit import record
from app.services.format import hhmm

router = APIRouter(prefix="/v1/conversations", tags=["handling"])

WITH_A_PERSON = ("needs_human", "with_human")


class AgentReply(Camel):
    text: str = Field(min_length=1, max_length=2000)


class ConversationUpdates(Camel):
    messages: list[MessageOut]
    state: ConversationState
    responder: str
    human: bool


def message_out(m: Message) -> MessageOut:
    return MessageOut(id=m.id, author=m.author, author_name=m.author_name, text=m.text, at=hhmm(m.created_at))  # type: ignore[arg-type]


async def _conversation(session: Session, ctx: RequestContext, conversation_id: str) -> Conversation:
    conversation = await session.scalar(select(Conversation).where(Conversation.workspace_id == ctx.workspace_id, Conversation.id == conversation_id))
    if not conversation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not_found")
    return conversation


def _with_a_person(conversation: Conversation) -> None:
    if conversation.state not in WITH_A_PERSON:
        raise HTTPException(status.HTTP_409_CONFLICT, "not_with_a_person")


async def _staff(session: Session, ctx: RequestContext) -> StaffUser:
    staff = await session.get(StaffUser, ctx.user_id)
    if not staff:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_token")
    return staff


def _add(session: Session, conversation: Conversation, author: str, name: str, body: str) -> Message:
    message = Message(
        id=f"MSG-{secrets.token_hex(8)}",
        org_id=conversation.org_id,
        workspace_id=conversation.workspace_id,
        conversation_id=conversation.id,
        author=author,
        author_name=name,
        text=body,
        created_at=utcnow(),
    )
    session.add(message)
    return message


@router.post("/{conversation_id}/reply", response_model=MessageOut)
async def reply(conversation_id: str, body: AgentReply, ctx: Agent, session: Session) -> MessageOut:
    conversation = await _conversation(session, ctx, conversation_id)
    _with_a_person(conversation)
    staff = await _staff(session, ctx)
    message = _add(session, conversation, "human", staff.display_name or staff.name.split()[0], body.text.strip())
    # Whoever answers owns the conversation from now on.
    conversation.state = "with_human"
    conversation.assigned_to = staff.id
    conversation.updated_at = utcnow()
    await record(session, ctx, actor=staff.name, actor_kind="human", action="Replied to the customer", target=conversation.id, outcome="allowed")
    await session.commit()
    return message_out(message)


@router.post("/{conversation_id}/resolve", status_code=status.HTTP_204_NO_CONTENT)
async def resolve(conversation_id: str, ctx: Agent, session: Session) -> Response:
    conversation = await _conversation(session, ctx, conversation_id)
    _with_a_person(conversation)
    staff = await _staff(session, ctx)
    name = staff.display_name or staff.name.split()[0]
    _add(session, conversation, "system", say("system_name", conversation.language), say("resolved_by_person", conversation.language, agent=name))  # type: ignore[arg-type]
    conversation.state = "resolved"
    conversation.closed_at = conversation.updated_at = utcnow()
    await record(session, ctx, actor=staff.name, actor_kind="human", action="Resolved the conversation", target=conversation.id, outcome="allowed")
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{conversation_id}/return", status_code=status.HTTP_204_NO_CONTENT)
async def return_to_ai(conversation_id: str, ctx: Agent, session: Session) -> Response:
    conversation = await _conversation(session, ctx, conversation_id)
    _with_a_person(conversation)
    staff = await _staff(session, ctx)
    profile = await session.get(AiProfile, conversation.profile_id)
    ai = profile.name if profile else "AI"

    # The model never saw what happened while a person had the conversation; it gets a summary before resuming.
    since = conversation.handed_off_at or conversation.created_at
    rows = await session.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id, Message.created_at >= since, Message.author.in_(("customer", "human")))
        .order_by(Message.created_at)
    )
    lines = [f"{'customer' if m.author == 'customer' else m.author_name}: {m.text}" for m in rows]
    event = f"A person ({staff.name}) handled the conversation and handed it back to you. What was said meanwhile: " + (" | ".join(lines) or "nothing")
    note = {"role": "user", "content": [{"type": "text", "text": f"<system_event>{event}</system_event>"}]}
    conversation.agent_messages = [*(conversation.agent_messages or []), note]

    flags = dict(conversation.flags or {})
    for counter in COUNTERS:
        flags[counter] = 0
    flags.pop("not_holder", None)
    flags["returned_by"] = staff.id
    conversation.flags = flags

    _add(session, conversation, "system", say("system_name", conversation.language), say("ai_back", conversation.language, ai=ai))  # type: ignore[arg-type]
    conversation.state = "waiting_customer"
    conversation.updated_at = utcnow()
    await record(session, ctx, actor=staff.name, actor_kind="human", action=f"Handed the conversation back to {ai}", target=conversation.id, outcome="allowed")
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{conversation_id}/human-actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def human_action(conversation_id: str, action_id: str, ctx: Agent, session: Session) -> Response:
    conversation = await _conversation(session, ctx, conversation_id)
    _with_a_person(conversation)
    handoff = await session.scalar(select(Handoff).where(Handoff.conversation_id == conversation.id).order_by(Handoff.created_at.desc()))
    action = next((a for a in (handoff.human_actions if handoff else []) if a["id"] == action_id), None)
    if not handoff or not action:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown_action")
    staff = await _staff(session, ctx)
    # No card system is connected, so the action is simulated and says so everywhere it is recorded.
    handoff.actions = [
        *handoff.actions,
        {"at": hhmm(utcnow()), "description": f"{action['label']} · {staff.name} (simulado)", "verified": False},
    ]
    await record(
        session,
        ctx,
        actor=staff.name,
        actor_kind="human",
        action=f"{action['label']} (simulated)",
        target=conversation.id,
        outcome="allowed",
        data={"action": action_id},
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{conversation_id}/updates", response_model=ConversationUpdates)
async def updates(conversation_id: str, ctx: Staff, session: Session, after: str | None = None) -> ConversationUpdates:
    """Messages after a given one, so open screens can follow the conversation without reloading."""
    conversation = await _conversation(session, ctx, conversation_id)
    return await conversation_updates(session, conversation, after)


async def conversation_updates(session: Session, conversation: Conversation, after: str | None) -> ConversationUpdates:
    stmt = select(Message).where(Message.conversation_id == conversation.id)
    if after:
        cursor = await session.scalar(select(Message.created_at).where(Message.conversation_id == conversation.id, Message.id == after))
        if cursor is not None:
            stmt = stmt.where(Message.created_at > cursor)
    messages = list(await session.scalars(stmt.order_by(Message.created_at)))
    human = conversation.state in WITH_A_PERSON
    staff = await session.get(StaffUser, conversation.assigned_to) if human and conversation.assigned_to else None
    profile = await session.get(AiProfile, conversation.profile_id)
    responder = (staff.display_name or staff.name) if staff else (profile.name if profile else "")
    return ConversationUpdates(messages=[message_out(m) for m in messages], state=conversation.state, responder=responder, human=human)  # type: ignore[arg-type]
