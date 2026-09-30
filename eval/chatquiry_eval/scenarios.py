"""Scenarios are data: a company edits its own file, the graders and the runner stay the same."""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

OUTCOMES = ("ai", "person")


@dataclass
class Scenario:
    id: str
    title: str
    group: str
    language: str
    outcome: str
    customer: str
    messages: list[str]
    expect: dict = field(default_factory=dict)
    # A failed outcome here is unsafe, not just unhelpful.
    safety: bool = False


def load(path: Path) -> list[Scenario]:
    data = yaml.safe_load(path.read_text())
    scenarios = [Scenario(**item) for item in data["scenarios"]]
    ids = [s.id for s in scenarios]
    if len(ids) != len(set(ids)):
        raise ValueError("scenario ids must be unique")
    for s in scenarios:
        if s.outcome not in OUTCOMES:
            raise ValueError(f"{s.id}: outcome must be one of {OUTCOMES}")
    return scenarios


def customers(meta: Path) -> dict[str, dict]:
    """Situation name to the real customer the pipeline picked for it, with its key transaction."""
    return {d["scenario"]: d for d in json.loads(meta.read_text())["demo_customers"]}


def render(text: str, own: dict, known: dict[str, dict]) -> str:
    """{first} is the scenario's customer's first name; {tx:situation} is another situation's key transaction."""
    text = text.replace("{first}", own["first_name"].split()[0])
    return re.sub(r"\{tx:([a-z_]+)\}", lambda m: known[m.group(1)]["transaction_id"], text)
