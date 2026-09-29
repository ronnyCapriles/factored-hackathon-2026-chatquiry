from datetime import UTC, datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import Session, Staff
from app.core.context import RequestContext, localized
from app.models import Conversation, Customer, StaffUser
from app.orchestrator.engine import Orchestrator, TurnResult, customer_language, first_name, greeting_text, live_profile
from app.orchestrator.intake import IntakeClassifier, get_classifier
from app.orchestrator.llm import LLM, get_llm
from app.schemas.api import ChatTurnRequest, ChatTurnResponse, MessageOut, Signal, TestCustomerOut, TraceStepOut, TurnInspection
from app.services.audit import record
from app.services.format import hhmm
from app.services.i18n import T

router = APIRouter(prefix="/v1/test-chat", tags=["test-chat"])


async def _demo_customer(session: Session, ctx: RequestContext, customer_id: str | None) -> Customer:
    # Staff may only chat as the demo customers, never as an arbitrary account.
    customer = await session.scalar(
        select(Customer).where(Customer.workspace_id == ctx.workspace_id, Customer.customer_id == customer_id, Customer.demo_scenario.is_not(None))
    )
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not_found")
    return customer


@router.get("/customers", response_model=list[TestCustomerOut])
async def test_customers(ctx: Staff, session: Session) -> list[TestCustomerOut]:
    rows = await session.scalars(
        select(Customer).where(Customer.workspace_id == ctx.workspace_id, Customer.demo_scenario.is_not(None)).order_by(Customer.demo_scenario)
    )
    return [
        TestCustomerOut(
            customer_id=c.customer_id,
            first_name=first_name(c),
            full_name=f"{c.first_name} {c.last_name}",
            country=c.country,
            language=customer_language(c),  # type: ignore[arg-type]
            hint=f"{T(ctx.locale, 'try')}: “{T(customer_language(c), f'try_{c.demo_scenario}')}”",  # type: ignore[arg-type]
        )
        for c in rows
    ]


@router.get("/customers/{customer_id}/greeting", response_model=list[MessageOut])
async def greeting(customer_id: str, ctx: Staff, session: Session) -> list[MessageOut]:
    customer = await _demo_customer(session, ctx, customer_id)
    profile = await live_profile(session, ctx)
    if not profile:
        return []
    text = await greeting_text(session, ctx, customer, profile)
    return [MessageOut(id=f"MSG-{uuid4().hex[:12]}", author="ai", author_name=profile.name, text=text, at=hhmm(datetime.now(UTC)))]


@router.post("/turns", response_model=ChatTurnResponse)
async def turn(
    body: ChatTurnRequest,
    ctx: Staff,
    session: Session,
    llm: Annotated[LLM, Depends(get_llm)],
    classifier: Annotated[IntakeClassifier, Depends(get_classifier)],
) -> ChatTurnResponse:
    customer = await _demo_customer(session, ctx, body.customer_id)
    orchestrator = Orchestrator(session, ctx, llm, classifier)
    if body.conversation_id:
        conversation = await session.scalar(
            select(Conversation).where(
                Conversation.workspace_id == ctx.workspace_id,
                Conversation.id == body.conversation_id,
                Conversation.channel == "test_chat",
                Conversation.customer_id == customer.customer_id,
            )
        )
        if not conversation:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "not_found")
    else:
        conversation = await orchestrator.start(customer, channel="test_chat")
        staff = await session.get(StaffUser, ctx.user_id)
        await record(
            session,
            ctx,
            actor=staff.name if staff else "?",
            actor_kind="human",
            action=f"Started a test chat as {customer.customer_id}",
            target=conversation.id,
            outcome="allowed",
        )
    return _response(await orchestrator.turn(conversation, body.text), ctx)


def _response(result: TurnResult, ctx: RequestContext) -> ChatTurnResponse:
    return ChatTurnResponse(
        conversation_id=result.conversation.id,
        replies=[MessageOut(id=m.id, author=m.author, author_name=m.author_name, text=m.text, at=hhmm(m.created_at)) for m in result.replies],  # type: ignore[arg-type]
        handed_off=result.handed_off,
        inspection=TurnInspection(
            customer_text=result.customer_text,
            state=result.conversation.state,  # type: ignore[arg-type]
            department=localized(result.department.name, ctx.locale) if result.department else "",
            profile=result.responder,
            signals=[Signal(**s) for s in result.signals],
            rule={"id": result.rule.id, "name": localized(result.rule.name, ctx.locale)} if result.rule else None,
            steps=[TraceStepOut(t=f"{s.t_ms / 1000:.3f}", step=s.step, detail=s.detail, status=s.status, ms=s.ms) for s in result.steps],  # type: ignore[arg-type]
            total_ms=result.total_ms,
        ),
    )
