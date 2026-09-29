"""Tools the model may call. The customer always comes from the conversation, never from the model's input."""

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.models import Conversation, Customer, Dispute, PendingAction, Policy, Transaction
from app.models.base import utcnow
from app.orchestrator import policy
from app.orchestrator.trace import Recorder
from app.services.audit import record

MAX_RESULTS = 6
CONFIRMATION_WINDOW = timedelta(minutes=30)


class ToolError(Exception):
    """Returned to the model as an error result; the conversation continues."""


@dataclass
class HandoffRequest:
    reason: str
    pending: list[str]


@dataclass
class ToolBox:
    session: AsyncSession
    ctx: RequestContext
    conversation: Conversation
    customer: Customer
    recorder: Recorder
    now: datetime
    allowed: set[str]
    ai_name: str
    decisions: list[policy.Decision] = field(default_factory=list)
    facts: list[dict] = field(default_factory=list)
    handoff: HandoffRequest | None = None
    proposed: PendingAction | None = None
    matches: list[str] = field(default_factory=list)

    async def run(self, name: str, args: dict) -> dict:
        started = self.recorder.now()
        if name not in self.allowed:
            self.recorder.add(f"tool.{name}", "not in this profile's allowlist", "blocked", started)
            raise ToolError(f"Tool {name} is not available.")
        try:
            result = await getattr(self, f"_{name}")(**args)
        except TypeError as e:
            self.recorder.add(f"tool.{name}", f"invalid input: {e}", "blocked", started)
            raise ToolError("Invalid input for this tool.") from None
        except ToolError as e:
            self.recorder.add(f"tool.{name}", str(e), "blocked", started)
            raise
        self.recorder.add(f"tool.{name}", _summary(name, result), "pending" if name == "propose_dispute" else "ok", started)
        return result

    async def _policy_values(self, policy_id: str) -> dict:
        row = await self.session.scalar(select(Policy).where(Policy.workspace_id == self.ctx.workspace_id, Policy.id == policy_id))
        if not row:
            raise ToolError(f"Policy {policy_id} is not configured.")
        return row.parameters["values"]

    async def _own_transaction(self, transaction_id: str) -> Transaction:
        tx = await self.session.scalar(
            select(Transaction).where(Transaction.workspace_id == self.ctx.workspace_id, Transaction.transaction_id == str(transaction_id).strip())
        )
        if tx and tx.customer_id != self.customer.customer_id:
            await record(
                self.session,
                self.ctx,
                actor=self.ai_name,
                actor_kind="ai",
                action="Tried to read another customer's transaction",
                target=tx.transaction_id,
                outcome="denied",
                data={"conversation": self.conversation.id},
            )
        if not tx or tx.customer_id != self.customer.customer_id:
            raise ToolError("No transaction with that id belongs to this customer.")
        return tx

    def _describe(self, tx: Transaction) -> dict:
        item = {
            "transaction_id": tx.transaction_id,
            "date": tx.transaction_date.strftime("%Y-%m-%d %H:%M"),
            "type": tx.transaction_type,
            "amount": f"{tx.amount:.2f}",
            "currency": tx.currency,
            "status": tx.transaction_status,
            "channel": tx.channel,
        }
        if tx.merchant_name:
            item["merchant"] = tx.merchant_name
        if tx.transaction_city:
            item["city"] = tx.transaction_city
        return item

    async def _find_transactions(
        self, days_back: int = 30, amount_approx: float | None = None, transaction_type: str | None = None, merchant: str | None = None
    ) -> dict:
        days = max(1, min(int(days_back), 120))
        stmt = select(Transaction).where(
            Transaction.workspace_id == self.ctx.workspace_id,
            Transaction.customer_id == self.customer.customer_id,
            Transaction.transaction_date >= self.now - timedelta(days=days),
            Transaction.transaction_date <= self.now,
        )
        if transaction_type:
            stmt = stmt.where(Transaction.transaction_type == transaction_type)
        if merchant:
            stmt = stmt.where(Transaction.merchant_name.ilike(f"%{merchant.strip()[:60]}%"))
        if amount_approx:
            value = Decimal(str(amount_approx))
            stmt = stmt.where(Transaction.amount.between(value * Decimal("0.8"), value * Decimal("1.2")))
        rows = list(await self.session.scalars(stmt.order_by(Transaction.transaction_date.desc()).limit(MAX_RESULTS + 1)))
        items = [self._describe(t) for t in rows[:MAX_RESULTS]]
        self.matches = [t["transaction_id"] for t in items]
        return {"matches": items, "more_available": len(rows) > MAX_RESULTS, "searched_days": days}

    async def _get_transaction(self, transaction_id: str) -> dict:
        tx = await self._own_transaction(transaction_id)
        self.facts.append({"label": f"{tx.transaction_type} {tx.currency} {tx.amount:.2f} · {tx.transaction_status}", "source": tx.transaction_id})
        return self._describe(tx)

    async def _policy_lookup(self, transaction_id: str, question: str) -> dict:
        tx = await self._own_transaction(transaction_id)
        if question == "status":
            decision = policy.transaction_status(await self._policy_values(policy.TRANSFER_POLICY), tx, self.customer, self.now)
        elif question == "dispute_eligibility":
            disputed = await self.session.scalar(
                select(Dispute.id).where(Dispute.workspace_id == self.ctx.workspace_id, Dispute.transaction_id == tx.transaction_id)
            )
            decision = policy.dispute_eligibility(await self._policy_values(policy.DISPUTE_POLICY), tx, self.now, disputed is not None)
        else:
            raise ToolError("question must be status or dispute_eligibility.")
        self.decisions.append(decision)
        self.recorder.add("policy.evaluate", f"{decision.policy} → {decision.outcome}", "decision", rule=decision.policy, outcome=decision.outcome)
        return decision.as_tool_result()

    async def _propose_dispute(self, transaction_id: str, reason: str) -> dict:
        if reason not in ("not_recognized", "not_received", "duplicate"):
            raise ToolError("reason must be not_recognized, not_received or duplicate.")
        eligibility = await self._policy_lookup(transaction_id, "dispute_eligibility")
        decision = self.decisions[-1]
        if not decision.dispute_allowed:
            raise ToolError(f"Policy {decision.policy} does not allow the AI to open this dispute ({decision.outcome}). {decision.explanation}")
        tx = await self._own_transaction(transaction_id)
        open_actions = await self.session.scalars(
            select(PendingAction).where(PendingAction.conversation_id == self.conversation.id, PendingAction.status == "pending")
        )
        for action in open_actions:
            action.status = "superseded"
        self.proposed = PendingAction(
            id=f"PA-{secrets.token_hex(5).upper()}",
            org_id=self.ctx.org_id,
            workspace_id=self.ctx.workspace_id,
            conversation_id=self.conversation.id,
            kind="open_dispute",
            payload={
                "transaction_id": tx.transaction_id,
                "reason": reason,
                "amount": f"{tx.amount:.2f}",
                "currency": tx.currency,
                "fraud_signal": decision.fraud_signal,
                "policy": decision.policy,
                "outcome": decision.outcome,
            },
            expires_at=utcnow() + CONFIRMATION_WINDOW,
        )
        self.session.add(self.proposed)
        return {
            "status": "awaiting_customer_confirmation",
            "eligibility": eligibility["outcome"],
            "instruction": "Ask the customer to confirm with a clear yes. Nothing is opened until they do; never say it is already open.",
        }

    async def _handoff_to_human(self, reason: str, pending: list[str] | None = None) -> dict:
        self.handoff = HandoffRequest(reason=str(reason)[:300], pending=[str(p)[:200] for p in (pending or [])][:5])
        return {
            "status": "handoff_scheduled",
            "instruction": "A person takes over right after your reply and the system introduces them. Do not name anyone or promise times.",
        }


def _summary(name: str, result: dict) -> str:
    if name == "find_transactions":
        ids = ", ".join(m["transaction_id"] for m in result["matches"][:3])
        return f"{len(result['matches'])} match(es) in {result['searched_days']} days, scoped to the session customer" + (f" · {ids}" if ids else "")
    if name == "get_transaction":
        return f"{result['transaction_id']} · {result['status']} · scoped to the session customer"
    if name == "policy_lookup":
        return f"{result['policy']} → {result['outcome']}"
    if name == "propose_dispute":
        return "pending action stored on the server · waiting for the customer's yes"
    if name == "handoff_to_human":
        return "handoff requested by the model"
    return "ok"
