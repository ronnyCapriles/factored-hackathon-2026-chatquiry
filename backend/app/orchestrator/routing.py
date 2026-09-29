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

    @property
    def counter(self) -> str | None:
        """The running count that fired this rule, if any: it decides how the handoff is worded."""
        signals = {c["signal"] for c in self.rule.conditions} if self.rule else set()
        return next((c for c in COUNTERS if c in signals), None)


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


COUNTERS = ("security_strikes", "frustration_hits", "human_requests")


def route(rules: list[RoutingRule], signals: Signals, *, counters: dict, guardrail_blocked: bool, current_department: str | None) -> Route:
    values = {
        "guardrail": "blocked" if guardrail_blocked else "allowed",
        **counters,
        **{name: signals.value(name) for name in ("language", "intent", "injection_risk", "needs_human", "frustration")},
    }
    for rule in sorted(rules, key=lambda r: r.priority):
        if not all(_matches(c, values) for c in rule.conditions):
            continue
        if rule.action == "human":
            fallback = DISPUTES if signals.intent in ("card", "txn_dispute") else TRANSACTIONS
            return Route("human", rule.department_id or current_department or fallback, rule)
        return Route(rule.action, rule.department_id or current_department, rule)
    # A reply like "the first one" carries no intent of its own; it belongs to the ongoing inquiry, if any.
    return Route("continue", current_department)
