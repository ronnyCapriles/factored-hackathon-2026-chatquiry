"""One customer turn: intake, routing, the agent with scoped tools, verification, then a reply or a handoff."""

import json
import re
import secrets
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.context import RequestContext, localized
from app.models import (
    AiProfile,
    Conversation,
    Customer,
    Department,
    Dispute,
    DisputeEvent,
    Guardrail,
    IntakeSignal,
    Message,
    Organization,
    PendingAction,
    RoutingRule,
    StaffUser,
    Tool,
    TraceEvent,
    Transaction,
)
from app.models.base import utcnow
from app.orchestrator import grounding, prompts
from app.orchestrator.handoff import hand_off
from app.orchestrator.intake import GuardrailResult, IntakeClassifier, RulesClassifier, Signals, check_guardrail, detect_confirmation, plain
from app.orchestrator.llm import LLM, LLMReply, LLMUnavailable
from app.orchestrator.policy import TRANSFER_POLICY
from app.orchestrator.routing import COUNTERS, DISPUTES, Route, route
from app.orchestrator.texts import money
from app.orchestrator.texts import text as say
from app.orchestrator.tools import ToolBox, ToolError
from app.orchestrator.trace import Recorder, Step
from app.services.audit import record
from app.services.format import hhmm
from app.services.i18n import T

MAX_MODEL_CALLS = 6
INTAKE = "DEP-INTAKE"


async def live_profile(session: AsyncSession, ctx: RequestContext) -> AiProfile | None:
    """The active profile that answers customers: the first one a department uses."""
    used = select(Department.profile_id).where(Department.workspace_id == ctx.workspace_id, Department.active, Department.profile_id.is_not(None))
    return await session.scalar(
        select(AiProfile).where(AiProfile.workspace_id == ctx.workspace_id, AiProfile.status == "active", AiProfile.id.in_(used)).order_by(AiProfile.id)
    )


def customer_language(customer: Customer) -> str:
    return customer.preferred_language if customer.preferred_language in ("es", "pt") else "es"


def first_name(customer: Customer) -> str:
    return customer.first_name.split()[0]


async def greeting_text(session: AsyncSession, ctx: RequestContext, customer: Customer, profile: AiProfile) -> str:
    org = await session.get(Organization, ctx.org_id)
    return T(customer_language(customer), "greeting").format(first=first_name(customer), ai=profile.name, bank=org.name if org else "")  # type: ignore[arg-type]


@dataclass
class TurnResult:
    conversation: Conversation
    replies: list[Message]
    handed_off: bool
    department: Department | None
    responder: str
    signals: list[dict]
    rule: RoutingRule | None
    steps: list[Step]
    total_ms: int
    customer_text: str


class Orchestrator:
    def __init__(self, session: AsyncSession, ctx: RequestContext, llm: LLM, classifier: IntakeClassifier | None = None) -> None:
        self.session = session
        self.ctx = ctx
        self.llm = llm
        self.classifier = classifier or RulesClassifier()
        self.settings = get_settings()

    def _ws(self, model):
        return select(model).where(model.workspace_id == self.ctx.workspace_id)

    async def start(self, customer: Customer, channel: str) -> Conversation:
        profile = await live_profile(self.session, self.ctx)
        if not profile:
            raise RuntimeError("No active AI profile is attached to a department.")
        conversation = Conversation(
            id=f"CNV-{secrets.token_hex(4).upper()}",
            org_id=self.ctx.org_id,
            workspace_id=self.ctx.workspace_id,
            customer_id=customer.customer_id,
            channel=channel,
            language=customer_language(customer),
            state="ai_attending",
            department_id=None,
            profile_id=profile.id,
            agent_messages=[],
        )
        self.session.add(conversation)
        await self.session.flush()
        self._store(conversation, "ai", profile.name, await greeting_text(self.session, self.ctx, customer, profile))
        return conversation

    def _store(self, conversation: Conversation, author: str, name: str, body: str) -> Message:
        message = Message(
            id=f"MSG-{secrets.token_hex(8)}",
            org_id=self.ctx.org_id,
            workspace_id=self.ctx.workspace_id,
            conversation_id=conversation.id,
            author=author,
            author_name=name,
            text=body,
            created_at=utcnow(),
        )
        self.session.add(message)
        return message

    async def turn(self, conversation: Conversation, text: str) -> TurnResult:
        self.conversation = conversation
        self.rec = Recorder()
        self.replies: list[Message] = []
        self.handed_off = False
        self.rule: RoutingRule | None = None
        self.events: list[str] = []
        self.remembered = False
        self.new_intent: str | None = None
        self.customer_text = text
        self.usage = {"in": 0, "out": 0, "cost": 0.0}

        self.profile = await self.session.get(AiProfile, conversation.profile_id)
        self.customer = await self.session.scalar(self._ws(Customer).where(Customer.customer_id == conversation.customer_id))
        self.departments = {d.id: d for d in await self.session.scalars(self._ws(Department))}
        self.responder = self.profile.name
        conversation.turns += 1

        if conversation.state in ("needs_human", "with_human"):
            owner = await self.session.get(StaffUser, conversation.assigned_to) if conversation.assigned_to else None
            self.responder = owner.name if owner else self.responder
            self._store(conversation, "customer", self._customer_name(), text)
            self.rec.add("router", "a person owns this conversation; the AI stays silent", "routed")
            return await self._finish([])

        guard = await self._guardrail(text)
        self._store(conversation, "customer", self._customer_name(), guard.text)
        started = self.rec.now()
        signals = self.classifier.classify(guard.text, conversation.language)
        conversation.language = signals.language
        self.lang = signals.language
        detail = " · ".join(f"{s['name']}={s['value']}" + (f" ({s['confidence']})" if s.get("confidence") else "") for s in signals.as_list())
        self.rec.add("intake.classifier", f"{self.classifier.name} · {detail}", "classified", started, versions=[f"classifier {self.classifier.name}"])
        self.customer_text = guard.text

        counters = await self._count(signals, guard)
        rules = list(await self.session.scalars(self._ws(RoutingRule).where(RoutingRule.active)))
        decision = route(rules, signals, counters=counters, guardrail_blocked=guard.blocked, current_department=conversation.department_id)
        self.rule = decision.rule
        target = self.departments.get(decision.department_id or "")
        rule_label = f"{decision.rule.id} · " if decision.rule else ""
        counts = " · ".join(f"{k}={v}" for k, v in counters.items() if v)
        self.rec.add(
            "router",
            f"{rule_label}{decision.action}" + (f" → {localized(target.name, 'en')}" if target else "") + (f" · {counts}" if counts else ""),
            "routed",
            rule=decision.rule.id if decision.rule else None,
        )

        pending = await self._pending_action()
        # Security comes first: a blocked message or a takeover signal can never confirm an action.
        if decision.action == "block" or (decision.action == "human" and decision.counter == "security_strikes"):
            if pending:
                pending.status = "superseded"
            if decision.action == "block":
                await self._block(guard, decision.rule)
            else:
                await self._escalate(decision, target, counters)
            return await self._finish(signals.as_list())

        if pending:
            label, confidence = detect_confirmation(guard.text)
            self.rec.add(
                "confirm.detect",
                f"“{guard.text[:60]}” → {label} p={confidence:.2f} (deterministic detector, not the model)",
                "verified" if label == "yes" else "ok",
            )
            if label in ("yes", "no"):
                if label == "yes":
                    await self._open_dispute(pending)
                else:
                    pending.status = "declined"
                    self._ai(say("dispute_declined", self.lang))
                    self.conversation.state = "waiting_customer"
                if decision.action == "human" and target and not self.handed_off:
                    await self._escalate(decision, target, counters)
                return await self._finish(signals.as_list())

        if decision.action == "human" and target:
            await self._escalate(decision, target, counters)
            return await self._finish(signals.as_list())
        if decision.action == "route" and target:
            conversation.department_id = target.id

        if conversation.turns > self.profile.max_turns or float(conversation.cost_usd or 0) >= self.profile.budget_usd:
            self.rec.add("profile.limits", "turn or budget limit of the AI profile reached", "escalated")
            self._ai(say("handoff_request", self.lang))
            await self._handoff(self._current_department(), reason="Límite de turnos o de presupuesto de la IA", rule="profile.limits", pending=[])
            return await self._finish(signals.as_list())

        new_intent = signals.intent if decision.action == "route" else None
        self.new_intent = new_intent
        asked_for_person = signals.needs_human >= self.thresholds.get("needs_human", 0.62)
        await self._run_agent(signals, out_of_scope=decision.action == "abstain", pending=pending, new_intent=new_intent, asked_for_person=asked_for_person)
        return await self._finish(signals.as_list())

    async def _count(self, signals: Signals, guard: GuardrailResult) -> dict:
        """Updates the conversation's running counts; one message alone rarely says enough."""
        self.thresholds = {x.name: x.threshold for x in await self.session.scalars(self._ws(IntakeSignal)) if x.threshold is not None}
        name = plain(first_name(self.customer))
        says_not_holder = signals.identity_doubt or re.search(rf"\b(no soy|nao sou) {re.escape(name)}\b", plain(guard.text)) is not None
        blocked_attack = guard.blocked and (guard.attack or "OtherCustomersData" in guard.topics)
        attack = blocked_attack or signals.injection_risk >= self.thresholds.get("injection_risk", 0.8)
        frustrated = signals.frustration >= self.thresholds.get("frustration", 0.7)
        flags = dict(self.conversation.flags or {})
        # Saying they are not the account holder counts double: it is enough on its own.
        flags["security_strikes"] = flags.get("security_strikes", 0) + (2 if says_not_holder else 1 if attack else 0)
        flags["frustration_hits"] = flags.get("frustration_hits", 0) + (2 if signals.frustration >= 0.9 else 1 if frustrated else 0)
        flags["human_requests"] = flags.get("human_requests", 0) + (1 if signals.needs_human >= self.thresholds.get("needs_human", 0.62) else 0)
        if says_not_holder:
            flags["not_holder"] = True
        self.conversation.flags = flags
        return {k: flags[k] for k in COUNTERS}

    async def _escalate(self, decision: Route, target: Department, counters: dict) -> None:
        """A handoff decided by routing, worded for what triggered it."""
        rule = decision.rule.id if decision.rule else "routing"
        if decision.counter == "security_strikes":
            not_holder = (self.conversation.flags or {}).get("not_holder")
            reason = (
                "Posible suplantación: dijo no ser el titular" if not_holder else "Intentos repetidos de acceder a datos ajenos o de manipular al asistente"
            )
            await self._handoff(
                target,
                reason=reason,
                rule=rule,
                facts=[{"label": f"{counters['security_strikes']} alertas de seguridad en la conversación", "source": "intake"}],
                pending=["Verificar la identidad del cliente por un canal seguro antes de dar cualquier dato"],
                template="handoff_security",
            )
        elif decision.counter == "frustration_hits":
            await self._handoff(target, reason="Cliente molesto; la IA no logró resolverlo", rule=rule, pending=[], template="handoff_frustration")
        else:
            self._ai(say("handoff_request", self.lang))
            await self._handoff(target, reason="El cliente pidió hablar con una persona", rule=rule, pending=[])

    def _customer_name(self) -> str:
        return f"{self.customer.first_name} {self.customer.last_name}"

    def _ai(self, body: str) -> None:
        self.replies.append(self._store(self.conversation, "ai", self.profile.name, body))

    def _current_department(self) -> Department:
        return self.departments.get(self.conversation.department_id or "") or self.departments["DEP-TRX"]

    async def _guardrail(self, text: str) -> GuardrailResult:
        started = self.rec.now()
        try:
            result = await check_guardrail(text)
        except Exception as e:  # noqa: BLE001 - an unavailable guardrail must not take the chat down; the classifier still runs
            self.rec.add("intake.guardrail", f"unavailable ({type(e).__name__}); continuing with the classifier", "pending", started)
            return GuardrailResult(False, False, text, [])
        if not result.configured:
            self.rec.add("intake.guardrail", "Bedrock Guardrails not configured in this environment", "ok", started)
        elif result.blocked:
            self.rec.add("intake.guardrail", f"Bedrock Guardrails blocked: {', '.join(result.findings[:3])}", "blocked", started)
        else:
            masked = f" · masked {', '.join(result.findings[:3])}" if result.findings else ""
            self.rec.add("intake.guardrail", f"Bedrock Guardrails · no blocking findings{masked}", "allowed", started)
        return result

    async def _pending_action(self) -> PendingAction | None:
        action = await self.session.scalar(
            self._ws(PendingAction)
            .where(PendingAction.conversation_id == self.conversation.id, PendingAction.status == "pending")
            .order_by(PendingAction.created_at.desc())
        )
        if action and action.expires_at < utcnow():
            action.status = "expired"
            return None
        return action

    async def _block(self, guard: GuardrailResult, rule: RoutingRule | None) -> None:
        guardrail = await self.session.scalar(self._ws(Guardrail))
        if guard.secret:
            self._ai(say("never_share_secrets", self.lang))
        elif guard.blocked and guard.topics and not guard.attack:
            self._ai(say("only_own_accounts" if "OtherCustomersData" in guard.topics else "outside_this_chat", self.lang))
        elif guard.blocked and guardrail:
            self._ai(guardrail.spec["blocked_message"].get(self.lang) or guardrail.spec["blocked_message"]["es"])
        else:
            self._ai(say("only_own_accounts", self.lang))
        await record(
            self.session,
            self.ctx,
            actor=self.profile.name,
            actor_kind="ai",
            action="Blocked a message for security review",
            target=self.conversation.id,
            outcome="flagged",
            data={"rule": rule.id if rule else None},
        )
        self.conversation.state = "waiting_customer"

    async def _handoff(
        self,
        department: Department,
        *,
        reason: str,
        rule: str,
        pending: list[str],
        facts: list[dict] | None = None,
        actions: list[dict] | None = None,
        human_actions: list[dict] | None = None,
        suggestion: str = "general",
        template: str = "handoff",
    ) -> None:
        started = self.rec.now()
        facts = facts or []
        actions = actions or []
        agent = await hand_off(
            self.session,
            self.ctx,
            self.conversation,
            department=department,
            from_profile=self.profile.name,
            reason=reason,
            rule=rule,
            facts=facts,
            actions=actions,
            pending=pending,
            human_actions=human_actions or [],
            suggestion_kind=suggestion if self.profile.agent_suggestions else None,
            customer_first_name=first_name(self.customer),
        )
        team = localized(department.name, self.lang)  # type: ignore[arg-type]
        if agent:
            short = agent.display_name or agent.name.split()[0]
            self._ai(say(template, self.lang, agent=short, department=team))
            self.replies.append(self._store(self.conversation, "system", say("system_name", self.lang), say("agent_joined", self.lang, agent=short)))
            self.responder = agent.name
        else:
            self._ai(say("handoff_unassigned", self.lang))
        self.handed_off = True
        self.events.append(f"handed off to {agent.name if agent else 'the team'} ({localized(department.name, 'en')})")
        self.rec.add(
            "handoff.create",
            f"{rule} → {agent.name if agent else 'unassigned'} · {len(facts)} facts, {len(actions)} actions, {len(pending)} pending",
            "escalated",
            started,
            rule=rule if rule.startswith(("POL-", "R-")) else None,
        )
        await record(
            self.session, self.ctx, actor=self.profile.name, actor_kind="ai", action="Handed off to a person", target=self.conversation.id, outcome="allowed"
        )

    async def _open_dispute(self, pending: PendingAction) -> None:
        payload = pending.payload
        started = self.rec.now()
        tx = await self.session.scalar(
            self._ws(Transaction).where(Transaction.transaction_id == payload["transaction_id"], Transaction.customer_id == self.customer.customer_id)
        )
        if not tx:
            pending.status = "failed"
            self.rec.add("action.open_dispute", "transaction no longer found for this customer", "blocked", started)
            self._ai(say("technical_problem", self.lang))
            await self._handoff(self.departments[DISPUTES], reason="No se pudo abrir la disputa confirmada", rule=payload["policy"], pending=[])
            return

        fraud = bool(payload.get("fraud_signal"))
        dispute = Dispute(
            id=f"DSP-{secrets.token_hex(3).upper()}",
            org_id=self.ctx.org_id,
            workspace_id=self.ctx.workspace_id,
            customer_id=self.customer.customer_id,
            transaction_id=tx.transaction_id,
            conversation_id=self.conversation.id,
            reason=payload["reason"],
            amount=tx.amount,
            currency=tx.currency,
            state="needs_human" if fraud else "waiting_customer",
            status="Abierta",
            policy_rule=payload["policy"],
            opened_by=self.profile.name,
        )
        self.session.add(dispute)
        self.session.add(
            DisputeEvent(
                org_id=self.ctx.org_id,
                workspace_id=self.ctx.workspace_id,
                dispute_id=dispute.id,
                description=f"Abierta por {self.profile.name} con el sí del cliente",
            )
        )
        await self.session.flush()
        stored = await self.session.scalar(self._ws(Dispute).where(Dispute.id == dispute.id))
        matches = stored is not None and stored.transaction_id == tx.transaction_id and Decimal(stored.amount) == Decimal(tx.amount)
        pending.status = "confirmed"
        self.rec.add(
            "action.open_dispute",
            f"{dispute.id} created · read back from the database: {'matches' if matches else 'mismatch'}",
            "verified" if matches else "blocked",
            started,
            rule=payload["policy"],
        )
        await record(
            self.session,
            self.ctx,
            actor=self.profile.name,
            actor_kind="ai",
            action="Opened a dispute after the customer's yes",
            target=dispute.id,
            outcome="verified" if matches else "flagged",
        )

        amount = money(tx.amount, tx.currency, self.lang)  # type: ignore[arg-type]
        self._ai(say("dispute_created", self.lang, amount=amount, dispute=dispute.id))
        self.events.append(f"dispute {dispute.id} opened for {tx.currency} {tx.amount:.2f} on {tx.transaction_id}")
        if not fraud:
            self._ai(say("dispute_created_next", self.lang))
            self.conversation.state = "waiting_customer"
            return
        await self._handoff(
            self.departments[DISPUTES],
            reason="Compra no reconocida con señal de fraude; la disputa ya está abierta",
            rule=payload["policy"],
            facts=[
                {
                    "label": f"{tx.transaction_type} {tx.currency} {tx.amount:.2f} · {tx.merchant_name or '—'} · {tx.transaction_date:%d/%m %H:%M}",
                    "source": tx.transaction_id,
                },
                {"label": f"Disputa {dispute.id} · {payload['reason']}", "source": "disputes"},
            ],
            actions=[{"at": hhmm(utcnow()), "description": f"Disputa {dispute.id} abierta por {amount} con el sí del cliente", "verified": matches}],
            pending=["Confirmar si el cliente conserva la tarjeta", "Evaluar bloqueo y reposición de la tarjeta"],
            human_actions=[{"id": "block_card", "label": "Bloquear tarjeta", "simulated": True}],
            suggestion="fraud",
            template="handoff_fraud",
        )
        dispute.owner_id = self.conversation.assigned_to

    async def _run_agent(
        self, signals: Signals, *, out_of_scope: bool, pending: PendingAction | None, new_intent: str | None, asked_for_person: bool = False
    ) -> None:
        tools = list(await self.session.scalars(self._ws(Tool).where(Tool.name.in_(self.profile.tools))))
        org = await self.session.get(Organization, self.ctx.org_id)
        system = prompts.system_prompt(self.profile, org.name if org else "", self.settings.data_as_of)
        department = self.departments.get(self.conversation.department_id or "")
        note = f"open a dispute for {pending.payload['transaction_id']} ({pending.payload['currency']} {pending.payload['amount']})" if pending else None
        box = ToolBox(
            session=self.session,
            ctx=self.ctx,
            conversation=self.conversation,
            customer=self.customer,
            recorder=self.rec,
            now=self.settings.data_as_of,
            allowed=set(self.profile.tools),
            ai_name=self.profile.name,
        )
        messages = [*self.conversation.agent_messages, self._user_message(out_of_scope, note, department, new_intent, asked_for_person)]

        started = self.rec.now()
        try:
            reply = await self._agent_loop(system, prompts.tool_definitions(tools), messages, box)
        except LLMUnavailable as e:
            self.rec.add(f"llm.{self._model()}", f"{e}: model unavailable, safe fallback", "blocked", started)
            reply = None

        if reply is None:
            self._ai(say("technical_problem", self.lang))
            self._remember_template(out_of_scope, note, department)
            await self._handoff(self._current_department(), reason="La IA no pudo dar una respuesta verificada", rule="verify.fallback", pending=[])
            return

        self.conversation.agent_messages = messages
        self.remembered = True
        for bubble in [b.strip() for b in _plain_text(reply).split("\n\n") if b.strip()][:3]:
            self._ai(bubble)

        forced = next((d for d in box.decisions if d.human_now), None)
        if box.handoff or forced:
            if forced and not box.handoff:
                detail = f"{forced.policy} → {forced.outcome} needs a person; the orchestrator hands off"
                self.rec.add("policy.enforce", detail, "escalated", rule=forced.policy)
            facts = box.facts + [{"label": f"{d.policy} → {d.outcome}", "source": "policy_lookup"} for d in box.decisions]
            await self._handoff(
                self._current_department(),
                reason=box.handoff.reason if box.handoff else f"{forced.policy}: {forced.outcome}",
                rule=forced.policy if forced else (self.rule.id if self.rule else "handoff_to_human"),
                facts=facts,
                pending=box.handoff.pending if box.handoff else [],
                suggestion="transfer" if forced and forced.policy == TRANSFER_POLICY else "general",
                # The model has just explained why, and often says a person is coming.
                template="handoff_after_reply",
            )
        elif box.proposed:
            self.conversation.state = "waiting_customer"
        else:
            self.conversation.state = "resolved" if signals.closing else "waiting_customer"

    def _user_message(
        self, out_of_scope: bool, note: str | None, department: Department | None, new_intent: str | None = None, asked_for_person: bool = False
    ) -> dict:
        blocks = [
            {"type": "text", "text": prompts.turn_context(self.lang, department, out_of_scope, note, new_intent, asked_for_person)},
            {"type": "text", "text": prompts.customer_text(self.customer_text)},
        ]
        return {"role": "user", "content": blocks}

    def _remember_template(self, out_of_scope: bool, note: str | None, department: Department | None) -> None:
        """Turns answered without the model still go into its history, so later turns read coherently."""
        user = self._user_message(out_of_scope, note, department)
        if self.events:
            user["content"].append({"type": "text", "text": "<system_event>" + "; ".join(self.events) + "</system_event>"})
        said = "\n\n".join(m.text for m in self.replies if m.author == "ai")
        self.conversation.agent_messages = [*self.conversation.agent_messages, user, {"role": "assistant", "content": [{"type": "text", "text": said}]}]
        self.remembered = True

    def _model(self) -> str:
        return self.llm.model.split(".")[-1]

    async def _call(self, system: str, tools: list[dict], messages: list[dict]) -> LLMReply:
        started = self.rec.now()
        reply = await self.llm.complete(system=system, messages=messages, tools=tools)
        cost = reply.cost_usd()
        tokens_in = reply.input_tokens + reply.cache_read_tokens + reply.cache_write_tokens
        self.usage["in"] += tokens_in
        self.usage["out"] += reply.output_tokens
        self.usage["cost"] += cost
        cached = f" ({reply.cache_read_tokens:,} cached)" if reply.cache_read_tokens else ""
        self.rec.add(
            f"llm.{self._model()}",
            f"{tokens_in:,} tokens in{cached} · {reply.output_tokens:,} out · US$ {cost:.4f}",
            "ok",
            started,
            versions=[f"model {self._model()}", f"prompt {self.profile.prompt_version}"],
        )
        return reply

    async def _agent_loop(self, system: str, tools: list[dict], messages: list[dict], box: ToolBox) -> str | None:
        rechecked = False
        nudged = False
        for _ in range(MAX_MODEL_CALLS):
            reply = await self._call(system, tools, messages)
            messages.append({"role": "assistant", "content": reply.content})
            if reply.stop_reason == "tool_use" and reply.tool_calls:
                results = []
                for call in reply.tool_calls:
                    try:
                        output = await box.run(call["name"], call.get("input") or {})
                        results.append({"type": "tool_result", "tool_use_id": call["id"], "content": json.dumps(output, ensure_ascii=False)})
                    except ToolError as e:
                        results.append({"type": "tool_result", "tool_use_id": call["id"], "content": str(e), "is_error": True})
                messages.append({"role": "user", "content": results})
                continue
            if reply.stop_reason == "refusal" or not reply.text:
                self.rec.add("verify.grounding", f"no usable reply (stop reason {reply.stop_reason})", "blocked")
                return None
            # A new inquiry answered with questions the data could have answered.
            if not nudged and self.new_intent in prompts.SEARCH_FIRST and not box.searched and not box.decisions:
                nudged = True
                self.rec.add("verify.progress", "asked the customer before searching; the model is sent back to search first", "pending")
                note = "Search the customer's recent transactions with find_transactions before asking them anything, then answer."
                messages.append({"role": "user", "content": [{"type": "text", "text": f"<system_check>{note}</system_check>"}]})
                continue
            # A reply that neither answers nor asks, right after finding transactions, is a stall.
            if not nudged and box.matches and not box.decisions and not box.proposed and "?" not in reply.text:
                nudged = True
                self.rec.add("verify.progress", "stalled after the search; the model is sent back to answer or ask", "pending")
                note = (
                    f"Exactly one transaction matched ({box.matches[0]}). Check it now and answer the customer; don't ask them to wait."
                    if len(box.matches) == 1
                    else "Several transactions matched. Check the one that clearly fits what the customer said, or ask which one; don't ask them to wait."
                )
                messages.append({"role": "user", "content": [{"type": "text", "text": f"<system_check>{note}</system_check>"}]})
                continue

            started = self.rec.now()
            problems = grounding.ungrounded(reply.text, _sources(messages))
            if not problems:
                self.rec.add("verify.grounding", "every figure and reference appears in a tool result or the customer's words", "verified", started)
                return reply.text
            self.rec.add("verify.grounding", f"not backed by any tool result: {', '.join(problems[:4])}", "blocked", started)
            if rechecked:
                return None
            rechecked = True
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"<system_check>Your reply mentions {', '.join(problems)}, which no tool result contains. "
                            "Rewrite it with facts from tool results only, or look the data up first.</system_check>",
                        }
                    ],
                }
            )
        self.rec.add("llm.loop", f"stopped after {MAX_MODEL_CALLS} model calls", "blocked")
        return None

    async def _finish(self, signals: list[dict]) -> TurnResult:
        if self.replies and not self.remembered:
            self._remember_template(False, None, self.departments.get(self.conversation.department_id or ""))
        conversation = self.conversation
        conversation.tokens_in += self.usage["in"]
        conversation.tokens_out += self.usage["out"]
        conversation.cost_usd = Decimal(conversation.cost_usd or 0) + Decimal(str(round(self.usage["cost"], 6)))
        conversation.updated_at = utcnow()
        for seq, step in enumerate(self.rec.ordered()):
            self.session.add(
                TraceEvent(
                    org_id=self.ctx.org_id,
                    workspace_id=self.ctx.workspace_id,
                    conversation_id=conversation.id,
                    turn=conversation.turns,
                    seq=seq,
                    t_ms=step.t_ms,
                    step=step.step,
                    detail=step.detail,
                    status=step.status,
                    ms=step.ms,
                    data={k: v for k, v in step.data.items() if v is not None},
                )
            )
        await self.session.commit()
        return TurnResult(
            conversation=conversation,
            replies=self.replies,
            handed_off=self.handed_off,
            department=self.departments.get(conversation.department_id or INTAKE),
            responder=self.responder,
            signals=signals,
            rule=self.rule,
            steps=self.rec.ordered(),
            total_ms=self.rec.total_ms,
            customer_text=self.customer_text,
        )


def _plain_text(reply: str) -> str:
    """Chat bubbles show text as typed, so markdown emphasis and bullets would appear as symbols."""
    text = re.sub(r"(\*\*|__|\*|`)(.+?)\1", r"\2", reply)
    text = re.sub(r"(?<!\.)\.\.(?!\.)", ".", text)
    return re.sub(r"(?m)^\s*[-•]\s+", "", text)


def _sources(messages: list[dict]) -> list[str]:
    """What a reply may cite: tool results, the customer's words and orchestrator events. Never the model's own drafts."""
    out: list[str] = []
    for message in messages:
        if message["role"] != "user" or isinstance(message["content"], str):
            continue
        for block in message["content"]:
            if block.get("type") == "tool_result" and not block.get("is_error"):
                out.append(block["content"] if isinstance(block["content"], str) else json.dumps(block["content"]))
            elif block.get("type") == "text" and not block["text"].startswith("<system_check>"):
                out.append(block["text"])
    return out
