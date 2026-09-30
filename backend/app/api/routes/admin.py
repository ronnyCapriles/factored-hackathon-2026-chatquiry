import json
from datetime import date, datetime, time
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.api.deps import Admin, Session, Staff
from app.api.routes.auth import profile_out
from app.core.config import get_settings
from app.core.context import RequestContext, localized
from app.models import AiProfile, ApiKey, AuditLog, Channel, Connector, Conversation, Department, Guardrail, IntakeSignal, Policy, RoutingRule, StaffUser, Tool
from app.orchestrator.classifier import get_classifier
from app.schemas.api import AuditEntryOut, AuditPage, StaffProfileOut
from app.schemas.config import (
    AiProfileOut,
    AlertOut,
    ApiKeyOut,
    ChannelOut,
    ConfigOut,
    ConnectorOut,
    DepartmentOut,
    GuardrailOut,
    IntakeOut,
    IntakeSignalOut,
    IntegrationsOut,
    Kpi,
    LabelValue,
    OperationsOut,
    PolicyOut,
    PolicyOutcome,
    PromptVersion,
    RolePermissionOut,
    RoutingCondition,
    RoutingExample,
    RoutingRuleOut,
    SegmentRow,
    TeamMember,
    ToolOut,
)
from app.services.i18n import T

router = APIRouter(prefix="/v1", tags=["admin"])


def _ws(model, ctx: RequestContext):
    return select(model).where(model.workspace_id == ctx.workspace_id)


@router.get("/config", response_model=ConfigOut)
async def get_config(ctx: Staff, session: Session) -> ConfigOut:
    loc = ctx.locale
    staff = {u.id: u for u in await session.scalars(_ws(StaffUser, ctx))}
    profiles = list(await session.scalars(_ws(AiProfile, ctx)))
    profile_name = {p.id: p.name for p in profiles}
    departments = list(await session.scalars(_ws(Department, ctx).where(Department.active)))
    rules = list(await session.scalars(_ws(RoutingRule, ctx).where(RoutingRule.active).order_by(RoutingRule.priority)))
    tools = list(await session.scalars(_ws(Tool, ctx).order_by(Tool.name)))
    guardrails = list(await session.scalars(_ws(Guardrail, ctx)))
    policies = list(await session.scalars(_ws(Policy, ctx).order_by(Policy.id)))
    signals = list(await session.scalars(_ws(IntakeSignal, ctx)))
    dept_by_profile = {d.profile_id: localized(d.name, loc) for d in departments if d.profile_id}

    return ConfigOut(
        departments=[
            DepartmentOut(
                id=d.id,
                name=localized(d.name, loc),
                purpose=localized(d.purpose, loc),
                profile=profile_name.get(d.profile_id or ""),
                human_team=[TeamMember(id=u, name=staff[u].name, initials=staff[u].initials) for u in d.team if u in staff],
                channels=d.channels,  # type: ignore[arg-type]
                first_response_sla=localized(d.first_response_sla, loc),
                hours=localized(d.hours, loc),
                rules=[r.id for r in rules if d.id == "DEP-INTAKE" or r.department_id == d.id],
            )
            for d in departments
        ],
        profiles=[
            AiProfileOut(
                id=p.id,
                name=p.name,
                initials=p.initials,
                department=dept_by_profile.get(p.id, T(loc, "draft_profile")),
                persona=localized(p.persona, loc),
                sample_greeting=p.sample_greeting,  # type: ignore[arg-type]
                languages=p.languages,  # type: ignore[arg-type]
                model=p.model,
                fallback_model=p.fallback_model,
                prompt_version=p.prompt_version,
                prompt_history=[
                    PromptVersion(version=h["version"], date=h["date"], note=localized(h["note"], loc), current=h.get("current", False))
                    for h in p.prompt_history
                ],
                guardrail=p.guardrail,
                handoff_triggers=[localized(x, loc) for x in p.handoff_triggers],
                max_turns_before_human=p.max_turns,
                budget_per_conversation=f"US$ {p.budget_usd:.2f}",
                ai_disclosure=p.ai_disclosure,
                agent_suggestions=p.agent_suggestions,
                tools=p.tools,
            )
            for p in profiles
        ],
        tools=[
            ToolOut(
                name=t.name,
                title=localized(t.title, loc),
                permission=t.permission,  # type: ignore[arg-type]
                description=localized(t.description, loc),
                connector=t.connector,
                scope=localized(t.scope_note, loc),
                profiles=[p.name for p in profiles if t.name in p.tools],
                human_roles=t.human_roles,  # type: ignore[arg-type]
                rate_limit=localized(t.rate_limit, loc),
                input_schema=json.dumps(t.input_schema, indent=2, ensure_ascii=False),
            )
            for t in tools
        ],
        intake=IntakeOut(
            classifier=get_classifier().name,
            guardrail=guardrails[0].id if guardrails else "",
            signals=[IntakeSignalOut(name=s.name, kind=s.kind, description=localized(s.description, loc), threshold=s.threshold) for s in signals],  # type: ignore[arg-type]
        ),
        routing=[
            RoutingRuleOut(
                id=r.id,
                priority=r.priority,
                name=localized(r.name, loc),
                when=[RoutingCondition(**c) for c in r.conditions],
                action=r.action,  # type: ignore[arg-type]
                destination=localized(r.destination, loc),
            )
            for r in rules
        ],
        routing_examples=[RoutingExample(**e) for e in guardrails[0].spec.get("routing_examples", [])] if guardrails else [],
        guardrails=[
            GuardrailOut(
                id=g.id,
                name=g.id,
                version=g.version,
                tier=g.spec["tier"],
                prompt_attack=g.spec["prompt_attack"],
                content_filters=[{"category": localized(f["category"], loc), "input": f["input"], "output": f["output"]} for f in g.spec["content_filters"]],
                pii=[{"entity": localized(p["entity"], loc), "action": p["action"]} for p in g.spec["pii"]],
                denied_topics=[{"name": localized(d["name"], loc), "example": localized(d["example"], loc)} for d in g.spec["denied_topics"]],
                word_filters=[localized(w, loc) for w in g.spec["word_filters"]],
                grounding_threshold=g.spec["grounding_threshold"],
                blocked_message=g.spec["blocked_message"],
            )
            for g in guardrails
        ],
        policies=[
            PolicyOut(
                id=p.id,
                name=localized(p.name, loc),
                version=p.version,
                domain=localized(p.domain, loc),
                description=localized(p.description, loc),
                parameters=[LabelValue(name=localized(x["label"], loc), value=localized(x["display"], loc)) for x in p.parameters["display"]],
                outcomes=[
                    PolicyOutcome(when=localized(o["when"], loc), decision=localized(o["decision"], loc), human=o.get("human", False)) for o in p.outcomes
                ],
                history=[
                    PromptVersion(version=h["version"], date=h["date"], note=localized(h["note"], loc), current=h.get("current", False)) for h in p.history
                ],
                test_cases=p.test_cases,
                used_by=p.used_by,
            )
            for p in policies
        ],
    )


@router.get("/operations", response_model=OperationsOut)
async def operations(ctx: Admin, session: Session) -> OperationsOut:
    loc = ctx.locale
    human_waiting = await session.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.workspace_id == ctx.workspace_id, Conversation.state == "needs_human")
    )
    path = get_settings().eval_results
    results = json.loads(path.read_text()) if path.exists() else None
    kpi = (results or {}).get("kpis", {})
    keys = [("safe_resolution", True), ("containment", True), ("handoff_quality", True), ("unsafe", True), ("latency", False), ("cost", False)]
    return OperationsOut(
        sample=results is None,
        kpis=[Kpi(key=k, label=T(loc, f"kpi_{k}"), value=kpi.get(k), hint=T(loc, f"kpi_{k}_hint"), display=d) for k, d in keys],
        # The harness writes language groups as keys, so they are shown in the viewer's language.
        segments=[SegmentRow(**{**row, "group": T(loc, row["group"])}) for row in (results or {}).get("segments", [])]
        or [SegmentRow(group=T(loc, g), n=None, ai_resolved=None, with_human=None, unsafe=None) for g in ("seg_es", "seg_pt")],
        alerts=[
            AlertOut(id="no_human_reply", title=T(loc, "alert_no_human"), hint=T(loc, "alert_no_human_hint"), value=str(human_waiting or 0), severe=True),
            AlertOut(id="guardrail_blocks", title=T(loc, "alert_guardrail"), hint=T(loc, "alert_guardrail_hint"), value=None, severe=False),
        ],
    )


def _audit_out(e: AuditLog) -> AuditEntryOut:
    return AuditEntryOut(
        id=f"AUD-{e.id:06d}",
        date=e.at.date().isoformat(),
        at=e.at.strftime("%H:%M:%S"),
        actor=e.actor,
        actor_kind=e.actor_kind,  # type: ignore[arg-type]
        action=e.action,
        target=e.target,
        outcome=e.outcome,  # type: ignore[arg-type]
    )


@router.get("/audit", response_model=AuditPage)
async def audit(
    ctx: Admin,
    session: Session,
    q: str | None = None,
    actor_kind: Annotated[str | None, Query(alias="actorKind")] = None,
    outcome: str | None = None,
    actor: str | None = None,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, alias="pageSize")] = 25,
) -> AuditPage:
    stmt = select(AuditLog).where(AuditLog.workspace_id == ctx.workspace_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(AuditLog.action.ilike(like), AuditLog.target.ilike(like), AuditLog.actor.ilike(like)))
    if actor_kind:
        stmt = stmt.where(AuditLog.actor_kind == actor_kind)
    if outcome:
        stmt = stmt.where(AuditLog.outcome == outcome)
    if actor:
        stmt = stmt.where(AuditLog.actor == actor)
    if date_from:
        stmt = stmt.where(AuditLog.at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(AuditLog.at <= datetime.combine(date_to, time.max))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await session.scalars(stmt.order_by(AuditLog.at.desc(), AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size))
    return AuditPage(items=[_audit_out(e) for e in rows], total=total, page=page, page_size=page_size)


@router.get("/audit/actors", response_model=list[str])
async def audit_actors(ctx: Admin, session: Session) -> list[str]:
    rows = await session.scalars(select(AuditLog.actor).where(AuditLog.workspace_id == ctx.workspace_id).distinct().order_by(AuditLog.actor))
    return list(rows)


@router.get("/integrations", response_model=IntegrationsOut)
async def integrations(ctx: Admin, session: Session) -> IntegrationsOut:
    loc = ctx.locale
    keys = await session.scalars(_ws(ApiKey, ctx).order_by(ApiKey.created_at))
    channels = await session.scalars(_ws(Channel, ctx))
    connectors = await session.scalars(_ws(Connector, ctx))
    return IntegrationsOut(
        api_keys=[ApiKeyOut(id=k.id, name=k.name, masked=f"{k.prefix}_••••••••", environment=k.environment, scopes=k.scopes, active=k.active) for k in keys],  # type: ignore[arg-type]
        channels=[ChannelOut(channel=c.id, name=c.name, detail=localized(c.detail, loc), status=c.status) for c in channels],  # type: ignore[arg-type]
        connectors=[ConnectorOut(name=c.name, detail=localized(c.detail, loc), status=c.status, planned=c.planned) for c in connectors],
    )


@router.get("/staff", response_model=list[StaffProfileOut])
async def list_staff(ctx: Staff, session: Session) -> list[StaffProfileOut]:
    return [profile_out(u) for u in await session.scalars(_ws(StaffUser, ctx).where(StaffUser.active).order_by(StaffUser.name))]


@router.get("/role-permissions", response_model=list[RolePermissionOut])
async def role_permissions(ctx: Admin) -> list[RolePermissionOut]:
    loc = ctx.locale
    yes, no = T(loc, "yes"), T(loc, "no")
    rows = [
        ("perm_reply", yes, no),
        ("perm_read", yes, yes),
        ("perm_human_actions", yes, no),
        ("perm_test_chat", yes, yes),
        ("perm_admin_views", no, yes),
        ("perm_self_profile", yes, yes),
    ]
    return [RolePermissionOut(permission=T(loc, k), agent=a, admin=b) for k, a, b in rows]
