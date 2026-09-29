"""Deterministic routing over the workspace rules, evaluated in priority order; the first match wins."""

from dataclasses import dataclass

from app.models import RoutingRule
from app.orchestrator.intake import Signals

TRANSACTIONS = "DEP-TRX"
DISPUTES = "DEP-DSP"


@dataclass
class Route:
    action: str
    department_id: str | None
    rule: RoutingRule | None = None


def _matches(condition: dict, values: dict) -> bool:
    actual = values.get(condition["signal"])
    expected = str(condition["value"])
    op = condition["op"]
    if actual is None:
        return False
    if op == "=":
        return str(actual) == expected
    if op == "∈":
        return str(actual) in {v.strip() for v in expected.split("·")}
    number = float(actual)
    limit = float(expected)
    return {"≥": number >= limit, ">": number > limit, "≤": number <= limit, "<": number < limit}.get(op, False)


def route(rules: list[RoutingRule], signals: Signals, *, turns: int, guardrail_blocked: bool, current_department: str | None) -> Route:
    values = {
        "guardrail": "blocked" if guardrail_blocked else "allowed",
        "turns": turns,
        **{name: signals.value(name) for name in ("language", "intent", "injection_risk", "needs_human", "frustration")},
    }
    for rule in sorted(rules, key=lambda r: r.priority):
        if not all(_matches(c, values) for c in rule.conditions):
            continue
        if rule.action == "abstain" and signals.intent == "other" and current_department:
            # A reply like "the first one" carries no intent of its own; it belongs to the ongoing inquiry.
            return Route("continue", current_department)
        if rule.action == "human":
            fallback = DISPUTES if signals.intent in ("card", "txn_dispute") else TRANSACTIONS
            return Route("human", rule.department_id or current_department or fallback, rule)
        return Route(rule.action, rule.department_id or current_department, rule)
    return Route("continue", current_department) if current_department else Route("abstain", None)
