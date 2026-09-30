"""Deterministic policy engine. It decides; the model only explains the decision."""

import unicodedata
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal

from app.models import Customer, Transaction

TRANSFER_POLICY = "POL-TRX-PEND-24H"
DISPUTE_POLICY = "POL-DSP-FRAUD-01"

# ISO 8583 response codes present in the core data.
DECLINE_REASONS = {
    "05": "the issuing bank did not authorize it",
    "14": "the card or account number was not valid",
    "51": "there were not enough funds",
    "54": "the card was expired",
}


@dataclass
class Decision:
    policy: str
    outcome: str
    # A person must take the case now; the orchestrator enforces it even if the model does not ask.
    human_now: bool
    explanation: str
    params: dict = field(default_factory=dict)
    # The AI may open a dispute after the customer's explicit yes.
    dispute_allowed: bool = False
    fraud_signal: bool = False

    def as_tool_result(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v not in (None, {}, [])}


def _plain(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    return "".join(c for c in text if not unicodedata.combining(c)).strip().lower()


def _fmt(at: datetime) -> str:
    return at.strftime("%Y-%m-%d %H:%M")


def transaction_status(values: dict, tx: Transaction, customer: Customer, now: datetime) -> Decision:
    status = tx.transaction_status
    base = {
        "transaction_id": tx.transaction_id,
        "type": tx.transaction_type,
        "amount": f"{tx.amount:.2f}",
        "currency": tx.currency,
        "status": status,
        "made_at": _fmt(tx.transaction_date),
    }

    if status == "Pending" and tx.transaction_type == "Transfer":
        international = bool(tx.transaction_country) and _plain(tx.transaction_country) != _plain(customer.country)
        hours = int(values["sla_hours_international" if international else "sla_hours"])
        deadline = tx.transaction_date + timedelta(hours=hours)
        params = {**base, "sla_hours": hours, "international": international, "deadline": _fmt(deadline)}
        if now <= deadline:
            return Decision(
                TRANSFER_POLICY,
                "pending_in_time",
                False,
                f"The transfer is still within the {hours} h crediting window. Tell the customer it should be credited before {_fmt(deadline)} "
                "and that they can write back here if it has not arrived by then.",
                params,
            )
        overdue = now - deadline
        params["overdue_hours"] = int(overdue.total_seconds() // 3600)
        return Decision(
            TRANSFER_POLICY,
            "pending_overdue",
            True,
            f"It should have been credited by {_fmt(deadline)} and was not. Your reply tells the customer exactly that, with the date and time; "
            "a person from the transfers team takes over right after it.",
            params,
        )
    if status == "Pending":
        return Decision(TRANSFER_POLICY, "pending", False, "The movement is still being processed by the core system. Explain that it is in process.", base)
    if status == "Declined":
        reason = DECLINE_REASONS.get(tx.response_code or "", "the bank did not authorize it")
        return Decision(
            TRANSFER_POLICY,
            "declined",
            False,
            f"It was declined because {reason}. No money left the account. Explain that plainly.",
            {**base, "response_code": tx.response_code},
        )
    if status == "Reversed":
        reason = DECLINE_REASONS.get(tx.response_code or "")
        why = f" The bank's reason: {reason}." if reason else " The data gives no reason, so don't suggest one."
        # A reversed deposit never reached the balance; a reversed charge came back to it.
        effect = (
            "The deposit was reversed, so it was not credited: the money did not stay in the account."
            if tx.transaction_type == "Deposit"
            else "The charge was reversed, so the money went back to the account."
        )
        return Decision(TRANSFER_POLICY, "reversed", False, effect + why, {**base, "response_code": tx.response_code})
    return Decision(TRANSFER_POLICY, "approved", False, "It was approved and completed.", base)


def dispute_eligibility(values: dict, tx: Transaction, now: datetime, already_disputed: bool) -> Decision:
    age_days = (now - tx.transaction_date).days
    amount_usd = Decimal(tx.amount_usd if tx.amount_usd is not None else tx.amount)
    fraud = bool(tx.is_fraud) or Decimal(tx.fraud_score or 0) > Decimal(str(values["fraud_score_threshold"]))
    params = {"transaction_id": tx.transaction_id, "age_days": age_days, "amount_usd": float(amount_usd)}

    if already_disputed:
        return Decision(DISPUTE_POLICY, "already_disputed", False, "A dispute already exists for this transaction. Do not open another.", params)
    if tx.transaction_status in ("Declined", "Reversed"):
        return Decision(DISPUTE_POLICY, "not_charged", False, "The transaction was not charged (declined or reversed), so there is nothing to dispute.", params)
    if age_days > int(values["max_age_days"]):
        return Decision(
            DISPUTE_POLICY, "too_old", True, "It is older than the dispute window. A person must review it; do not open a dispute.", params, fraud_signal=fraud
        )
    if amount_usd > Decimal(str(values["auto_limit_usd"])):
        return Decision(
            DISPUTE_POLICY,
            "over_limit",
            True,
            "The amount is above what the AI may dispute. A person must review it; do not open a dispute.",
            params,
            fraud_signal=fraud,
        )
    if fraud:
        return Decision(
            DISPUTE_POLICY,
            "eligible_fraud",
            False,
            "The AI may open the dispute after the customer's explicit yes. It carries a fraud signal, so a person from security takes over "
            "once it is open. Do not mention scores or signals to the customer.",
            params,
            dispute_allowed=True,
            fraud_signal=True,
        )
    return Decision(DISPUTE_POLICY, "eligible", False, "The AI may open the dispute after the customer's explicit yes.", params, dispute_allowed=True)
