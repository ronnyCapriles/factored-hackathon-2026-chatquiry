"""Hands a conversation to a person with a packet that spares the customer from repeating anything."""

import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.models import Conversation, Department, Handoff, StaffUser
from app.models.base import utcnow

SUGGESTIONS = {
    "fraud": {
        "es": "Hola, {first}, soy {agent}. Ya revisé lo que conversaste. ¿Tu tarjeta sigue contigo?",
        "pt": "Oi, {first}, aqui é {agent}. Já li a conversa. Seu cartão ainda está com você?",
    },
    "transfer": {
        "es": "Hola, {first}, soy {agent}. Ya estoy revisando tu transferencia con el banco de destino y te escribo por aquí.",
        "pt": "Oi, {first}, aqui é {agent}. Já estou verificando sua transferência com o banco de destino e te escrevo por aqui.",
    },
    "general": {
        "es": "Hola, {first}, soy {agent}. Ya leí la conversación. ¿Me cuentas si hay algo más que deba saber?",
        "pt": "Oi, {first}, aqui é {agent}. Já li a conversa. Tem mais alguma coisa que eu deva saber?",
    },
}


async def pick_agent(session: AsyncSession, ctx: RequestContext, department: Department) -> StaffUser | None:
    team = list(
        await session.scalars(select(StaffUser).where(StaffUser.workspace_id == ctx.workspace_id, StaffUser.active, StaffUser.id.in_(department.team or [""])))
    )
    team.sort(key=lambda u: (u.availability != "available", department.team.index(u.id)))
    return team[0] if team else None


async def hand_off(
    session: AsyncSession,
    ctx: RequestContext,
    conversation: Conversation,
    *,
    department: Department,
    from_profile: str,
    reason: str,
    rule: str,
    facts: list[dict],
    actions: list[dict],
    pending: list[str],
    human_actions: list[dict],
    suggestion_kind: str | None,
    customer_first_name: str,
) -> StaffUser | None:
    agent = await pick_agent(session, ctx, department)
    suggestion = None
    if suggestion_kind and agent:
        template = SUGGESTIONS[suggestion_kind].get(conversation.language) or SUGGESTIONS[suggestion_kind]["es"]
        suggestion = template.format(first=customer_first_name, agent=agent.display_name or agent.name.split()[0])
    session.add(
        Handoff(
            id=f"HND-{secrets.token_hex(4).upper()}",
            org_id=ctx.org_id,
            workspace_id=ctx.workspace_id,
            conversation_id=conversation.id,
            from_profile=from_profile,
            reason=reason,
            policy_rule=rule,
            facts=facts,
            actions=actions,
            pending=pending,
            human_actions=human_actions,
            suggestion=suggestion,
        )
    )
    conversation.state = "needs_human"
    conversation.department_id = department.id
    conversation.assigned_to = agent.id if agent else None
    conversation.handed_off_at = utcnow()
    return agent
