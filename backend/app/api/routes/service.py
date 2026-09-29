from typing import Literal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on

from app.api.deps import Session, Staff
from app.core.context import RequestContext
from app.models import Complaint, Conversation, Customer, Dispute, DisputeEvent, Handoff, Message, Product, StaffUser, TraceEvent, Transaction
from app.schemas.api import (
    ActionTaken,
    CaseRef,
    ConversationCounts,
    ConversationOut,
    ConversationSummary,
    CustomerConversationRef,
    CustomerOut,
    DisputeEventOut,
    DisputeOut,
    HandoffOut,
    HumanOnlyAction,
    LabelValue,
    MessageOut,
    ProductOut,
    TraceOut,
    TraceStepOut,
    TransactionOut,
    VerifiedFact,
)
from app.services.audit import record
from app.services.format import hhmm, initials, mask_email, mask_phone, mask_tail, month_year

router = APIRouter(prefix="/v1", tags=["service"])

Filter = Literal["human", "ai", "resolved", "all"]
STATES: dict[str, tuple[str, ...]] = {
    "human": ("with_human", "needs_human"),
    "ai": ("ai_attending", "waiting_customer"),
    "resolved": ("resolved",),
}


def _scoped(stmt, model, ctx: RequestContext):
    return stmt.where(model.workspace_id == ctx.workspace_id)


async def _last_messages(session: Session, ctx: RequestContext, ids: list[str]) -> dict[str, Message]:
    if not ids:
        return {}
    rows = await session.scalars(
        _scoped(select(Message), Message, ctx)
        .where(Message.conversation_id.in_(ids))
        .order_by(Message.conversation_id, Message.created_at.desc())
        .ext(distinct_on(Message.conversation_id))
    )
    return {m.conversation_id: m for m in rows}


def _summary(c: Conversation, customer: Customer, last: Message | None) -> ConversationSummary:
    return ConversationSummary(
        id=c.id,
        customer_id=customer.customer_id,
        customer_name=f"{customer.first_name} {customer.last_name}",
        customer_initials=initials(customer.first_name, customer.last_name),
        language=c.language,  # type: ignore[arg-type]
        channel=c.channel,  # type: ignore[arg-type]
        state=c.state,  # type: ignore[arg-type]
        last_message=last.text if last else "",
        last_at=hhmm(last.created_at if last else c.updated_at),
        assigned_to=c.assigned_to,
    )


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(ctx: Staff, session: Session, filter: Filter = "all") -> list[ConversationSummary]:
    stmt = _scoped(select(Conversation, Customer).join(Customer, Customer.customer_id == Conversation.customer_id), Conversation, ctx)
    if filter != "all":
        stmt = stmt.where(Conversation.state.in_(STATES[filter]))
    rows = (await session.execute(stmt.order_by(Conversation.updated_at.desc()).limit(200))).all()
    last = await _last_messages(session, ctx, [c.id for c, _ in rows])
    return [_summary(c, cust, last.get(c.id)) for c, cust in rows]


@router.get("/conversations/counts", response_model=ConversationCounts)
async def conversation_counts(ctx: Staff, session: Session) -> ConversationCounts:
    rows = (await session.execute(_scoped(select(Conversation.state, func.count()), Conversation, ctx).group_by(Conversation.state))).all()
    by_state = {s: n for s, n in rows}
    return ConversationCounts(
        human=sum(by_state.get(s, 0) for s in STATES["human"]),
        ai=sum(by_state.get(s, 0) for s in STATES["ai"]),
        resolved=by_state.get("resolved", 0),
        all=sum(by_state.values()),
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
async def get_conversation(conversation_id: str, ctx: Staff, session: Session) -> ConversationOut:
    row = (
        await session.execute(
            _scoped(select(Conversation, Customer).join(Customer, Customer.customer_id == Conversation.customer_id), Conversation, ctx).where(
                Conversation.id == conversation_id
            )
        )
    ).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not_found")
    conv, customer = row
    messages = list(await session.scalars(_scoped(select(Message), Message, ctx).where(Message.conversation_id == conv.id).order_by(Message.created_at)))
    handoff = await session.scalar(_scoped(select(Handoff), Handoff, ctx).where(Handoff.conversation_id == conv.id))
    base = _summary(conv, customer, messages[-1] if messages else None)
    return ConversationOut(
        **base.model_dump(),
        country=customer.country,
        handed_off_at=hhmm(conv.handed_off_at) or None,
        trace_id=conv.id,
        messages=[MessageOut(id=m.id, author=m.author, author_name=m.author_name, text=m.text, at=hhmm(m.created_at)) for m in messages],  # type: ignore[arg-type]
        handoff=HandoffOut(
            id=handoff.id,
            from_profile=handoff.from_profile,
            reason=handoff.reason,
            policy_rule=handoff.policy_rule,
            facts=[VerifiedFact(**f) for f in handoff.facts],
            actions=[ActionTaken(**a) for a in handoff.actions],
            pending=handoff.pending,
            human_actions=[HumanOnlyAction(**h) for h in handoff.human_actions],
            suggestion=handoff.suggestion,
        )
        if handoff
        else None,
    )


def _product_label(p: Product) -> str:
    return p.product_type


async def _customer_out(session: Session, ctx: RequestContext, customer: Customer) -> CustomerOut:
    cid = customer.customer_id
    products = list(await session.scalars(_scoped(select(Product), Product, ctx).where(Product.customer_id == cid).order_by(Product.opening_date)))
    txs = list(
        await session.scalars(
            _scoped(select(Transaction), Transaction, ctx).where(Transaction.customer_id == cid).order_by(Transaction.transaction_date.desc()).limit(12)
        )
    )
    convs = list(
        await session.scalars(_scoped(select(Conversation), Conversation, ctx).where(Conversation.customer_id == cid).order_by(Conversation.created_at.desc()))
    )
    disputes = list(await session.scalars(_scoped(select(Dispute), Dispute, ctx).where(Dispute.customer_id == cid)))
    complaints = list(
        await session.scalars(_scoped(select(Complaint), Complaint, ctx).where(Complaint.customer_id == cid).order_by(Complaint.creation_date.desc()).limit(3))
    )
    disputed = {d.transaction_id for d in disputes}
    first_msgs = {}
    if convs:
        rows = await session.scalars(
            _scoped(select(Message), Message, ctx)
            .where(Message.conversation_id.in_([c.id for c in convs]), Message.author == "customer")
            .order_by(Message.conversation_id, Message.created_at)
            .ext(distinct_on(Message.conversation_id))
        )
        first_msgs = {m.conversation_id: m.text for m in rows}

    return CustomerOut(
        id=cid,
        name=f"{customer.first_name} {customer.last_name}",
        initials=initials(customer.first_name, customer.last_name),
        segment=customer.segment,
        country=customer.country,
        city=customer.city,
        status=customer.customer_status,
        language=customer.preferred_language,  # type: ignore[arg-type]
        document_masked=f"{customer.document_type} {mask_tail(customer.document_number)}",
        email_masked=mask_email(customer.email),
        phone_masked=mask_phone(customer.mobile_phone),
        customer_since=month_year(customer.registration_date, ctx.locale),
        products=[ProductOut(id=p.product_id, label=_product_label(p), masked=mask_tail(p.product_number), status=p.product_status) for p in products],
        transactions=[
            TransactionOut(
                id=t.transaction_id,
                at=t.transaction_date.strftime("%d/%m %H:%M"),
                description=" · ".join(x for x in (t.merchant_name, t.transaction_type) if x),
                amount=float(t.amount),
                currency=t.currency,
                status=t.transaction_status,  # type: ignore[arg-type]
                fraud_score=float(t.fraud_score or 0),
                highlighted=t.transaction_id in disputed,
            )
            for t in txs
        ],
        conversations=[
            CustomerConversationRef(
                id=c.id,
                label=f"{c.created_at:%d/%m} · {first_msgs.get(c.id, '')[:48]}",
                outcome=c.state,
                state=c.state,  # type: ignore[arg-type]
            )
            for c in convs
        ],
        cases=[CaseRef(id=d.id, label=f"{d.status} · {d.created_at:%d/%m}", kind="dispute") for d in disputes]
        + [CaseRef(id=c.complaint_id, label=f"{c.status} · {c.creation_date:%Y}", kind="complaint") for c in complaints],
        contact_history=[LabelValue(label="Chatquiry", value=str(len(convs)))],
    )


@router.get("/customers", response_model=list[CustomerOut])
async def list_customers(ctx: Staff, session: Session) -> list[CustomerOut]:
    ids = select(Conversation.customer_id).where(Conversation.workspace_id == ctx.workspace_id).distinct()
    customers = list(await session.scalars(_scoped(select(Customer), Customer, ctx).where(Customer.customer_id.in_(ids)).order_by(Customer.first_name)))
    return [await _customer_out(session, ctx, c) for c in customers]


@router.get("/customers/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: str, ctx: Staff, session: Session) -> CustomerOut:
    customer = await session.scalar(_scoped(select(Customer), Customer, ctx).where(Customer.customer_id == customer_id))
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not_found")
    viewer = await session.get(StaffUser, ctx.user_id)
    await record(
        session, ctx, actor=viewer.name if viewer else "?", actor_kind="human", action="Viewed customer profile", target=customer_id, outcome="allowed"
    )
    await session.commit()
    return await _customer_out(session, ctx, customer)


@router.get("/disputes", response_model=list[DisputeOut])
async def list_disputes(ctx: Staff, session: Session) -> list[DisputeOut]:
    rows = (
        await session.execute(
            _scoped(select(Dispute, Customer).join(Customer, Customer.customer_id == Dispute.customer_id), Dispute, ctx).order_by(Dispute.created_at.desc())
        )
    ).all()
    events = await session.scalars(_scoped(select(DisputeEvent), DisputeEvent, ctx).order_by(DisputeEvent.at))
    by_dispute: dict[str, list[DisputeEventOut]] = {}
    for e in events:
        by_dispute.setdefault(e.dispute_id, []).append(DisputeEventOut(at=e.at.strftime("%d/%m %H:%M:%S"), description=e.description))
    owners = {u.id: u.name for u in await session.scalars(_scoped(select(StaffUser), StaffUser, ctx))}
    return [
        DisputeOut(
            id=d.id,
            customer_name=f"{c.first_name} {c.last_name}",
            customer_id=c.customer_id,
            reason=d.reason,
            amount=float(d.amount),
            currency=d.currency,
            opened_by=d.opened_by,
            status=d.status,
            state=d.state,  # type: ignore[arg-type]
            transaction_id=d.transaction_id,
            policy_rule=d.policy_rule,
            owner=owners.get(d.owner_id or ""),
            events=by_dispute.get(d.id, []),
            trace_id=d.conversation_id or "",
        )
        for d, c in rows
    ]


@router.get("/traces/{conversation_id}", response_model=TraceOut)
async def get_trace(conversation_id: str, ctx: Staff, session: Session, turn: int | None = None) -> TraceOut:
    conv = await session.scalar(_scoped(select(Conversation), Conversation, ctx).where(Conversation.id == conversation_id))
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not_found")
    stmt = _scoped(select(TraceEvent), TraceEvent, ctx).where(TraceEvent.conversation_id == conversation_id)
    if turn is not None:
        stmt = stmt.where(TraceEvent.turn == turn)
    events = list(await session.scalars(stmt.order_by(TraceEvent.turn, TraceEvent.seq)))
    rules = sorted({e.data["rule"] for e in events if e.data.get("rule")})
    versions = sorted({v for e in events for v in e.data.get("versions", [])})
    llm_ms = sum(e.ms for e in events if e.step.startswith(("intake", "router", "tool", "policy", "llm", "verify", "handoff")))
    return TraceOut(
        id=conversation_id,
        conversation_id=conversation_id,
        outcome=conv.state,
        ai_latency=f"{llm_ms / 1000:.2f} s",
        tokens=conv.tokens_in + conv.tokens_out,
        cost=f"US$ {conv.cost_usd:.4f}" if conv.cost_usd else None,
        steps=[TraceStepOut(t=f"{e.t_ms / 1000:.3f}", step=e.step, detail=e.detail, status=e.status, ms=e.ms) for e in events],  # type: ignore[arg-type]
        rules=rules,
        versions=versions,
    )
