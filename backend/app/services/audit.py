from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.models import AuditLog


async def record(
    session: AsyncSession,
    ctx: RequestContext,
    *,
    actor: str,
    actor_kind: str,
    action: str,
    target: str,
    outcome: str,
    data: dict | None = None,
) -> None:
    session.add(
        AuditLog(
            org_id=ctx.org_id,
            workspace_id=ctx.workspace_id,
            actor=actor,
            actor_kind=actor_kind,
            action=action,
            target=target,
            outcome=outcome,
            data=data or {},
        )
    )
