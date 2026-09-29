from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import Session, Staff
from app.core.context import RequestContext
from app.models import AiProfile, Customer, Department, Organization
from app.schemas.api import MessageOut, TestCustomerOut
from app.services.format import hhmm
from app.services.i18n import T

router = APIRouter(prefix="/v1/test-chat", tags=["test-chat"])


def _language(c: Customer) -> str:
    return c.preferred_language if c.preferred_language in ("es", "pt") else "es"


async def _demo_customer(session: Session, ctx: RequestContext, customer_id: str) -> Customer:
    # Staff may only chat as the demo customers, never as an arbitrary account.
    customer = await session.scalar(
        select(Customer).where(Customer.workspace_id == ctx.workspace_id, Customer.customer_id == customer_id, Customer.demo_scenario.is_not(None))
    )
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not_found")
    return customer


async def live_profile(session: Session, ctx: RequestContext) -> AiProfile | None:
    """The active profile that answers customers: the first one a department uses."""
    used = select(Department.profile_id).where(Department.workspace_id == ctx.workspace_id, Department.active, Department.profile_id.is_not(None))
    return await session.scalar(
        select(AiProfile).where(AiProfile.workspace_id == ctx.workspace_id, AiProfile.status == "active", AiProfile.id.in_(used)).order_by(AiProfile.id)
    )


@router.get("/customers", response_model=list[TestCustomerOut])
async def test_customers(ctx: Staff, session: Session) -> list[TestCustomerOut]:
    rows = await session.scalars(
        select(Customer).where(Customer.workspace_id == ctx.workspace_id, Customer.demo_scenario.is_not(None)).order_by(Customer.demo_scenario)
    )
    return [
        TestCustomerOut(
            customer_id=c.customer_id,
            first_name=c.first_name.split()[0],
            full_name=f"{c.first_name} {c.last_name}",
            country=c.country,
            language=_language(c),  # type: ignore[arg-type]
            hint=f"{T(ctx.locale, 'try')}: “{T(_language(c), f'try_{c.demo_scenario}')}”",  # type: ignore[arg-type]
        )
        for c in rows
    ]


@router.get("/customers/{customer_id}/greeting", response_model=list[MessageOut])
async def greeting(customer_id: str, ctx: Staff, session: Session) -> list[MessageOut]:
    customer = await _demo_customer(session, ctx, customer_id)
    profile = await live_profile(session, ctx)
    org = await session.get(Organization, ctx.org_id)
    if not profile or not org:
        return []
    text = T(_language(customer), "greeting").format(first=customer.first_name.split()[0], ai=profile.name, bank=org.name)  # type: ignore[arg-type]
    return [MessageOut(id=f"MSG-{uuid4().hex[:12]}", author="ai", author_name=profile.name, text=text, at=hhmm(datetime.now(UTC)))]
