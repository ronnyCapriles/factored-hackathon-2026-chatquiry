from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from sqlalchemy import select

from app.api.deps import BankChannel, Session
from app.api.routes.handling import ConversationUpdates, conversation_updates
from app.models import Conversation, Customer, Message
from app.orchestrator.classifier import get_classifier
from app.orchestrator.engine import Orchestrator
from app.orchestrator.intake import IntakeClassifier
from app.orchestrator.llm import LLM, get_llm
from app.schemas.api import Camel, ConversationState, MessageOut
from app.services.format import hhmm

router = APIRouter(prefix="/v1/conversations", tags=["channel"])

Model = Annotated[LLM, Depends(get_llm)]
Classifier = Annotated[IntakeClassifier, Depends(get_classifier)]


class StartRequest(Camel):
    channel: Literal["api", "widget", "whatsapp"] = "api"


class CustomerMessage(Camel):
    text: str = Field(min_length=1, max_length=2000)


class ChannelReply(Camel):
    conversation_id: str
    state: ConversationState
    handed_off: bool
    replies: list[MessageOut]


def _out(messages: list[Message]) -> list[MessageOut]:
    return [MessageOut(id=m.id, author=m.author, author_name=m.author_name, text=m.text, at=hhmm(m.created_at)) for m in messages]  # type: ignore[arg-type]


@router.post("", response_model=ChannelReply, status_code=status.HTTP_201_CREATED)
async def start(body: StartRequest, ctx: BankChannel, session: Session, llm: Model, classifier: Classifier) -> ChannelReply:
    customer = await session.scalar(select(Customer).where(Customer.workspace_id == ctx.workspace_id, Customer.customer_id == ctx.customer_id))
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown_customer")
    conversation = await Orchestrator(session, ctx, llm, classifier).start(customer, channel=body.channel)
    await session.commit()
    greeting = list(await session.scalars(select(Message).where(Message.conversation_id == conversation.id)))
    return ChannelReply(conversation_id=conversation.id, state=conversation.state, handed_off=False, replies=_out(greeting))  # type: ignore[arg-type]


async def _own_conversation(session: Session, ctx, conversation_id: str) -> Conversation:
    # The assertion's customer must own the conversation; anything else looks like it does not exist.
    conversation = await session.scalar(
        select(Conversation).where(
            Conversation.workspace_id == ctx.workspace_id,
            Conversation.id == conversation_id,
            Conversation.customer_id == ctx.customer_id,
            Conversation.channel != "test_chat",
        )
    )
    if not conversation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not_found")
    return conversation


@router.get("/{conversation_id}/messages", response_model=ConversationUpdates)
async def messages(conversation_id: str, ctx: BankChannel, session: Session, after: str | None = None) -> ConversationUpdates:
    """The bank polls this to deliver what a person writes after a handoff."""
    return await conversation_updates(session, await _own_conversation(session, ctx, conversation_id), after)


@router.post("/{conversation_id}/messages", response_model=ChannelReply)
async def message(conversation_id: str, body: CustomerMessage, ctx: BankChannel, session: Session, llm: Model, classifier: Classifier) -> ChannelReply:
    conversation = await _own_conversation(session, ctx, conversation_id)
    result = await Orchestrator(session, ctx, llm, classifier).turn(conversation, body.text)
    return ChannelReply(
        conversation_id=conversation.id,
        state=conversation.state,  # type: ignore[arg-type]
        handed_off=result.handed_off,
        replies=_out(result.replies),
    )
