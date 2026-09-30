"""Turns graded runs into the numbers Operación shows and a readable report for the repository."""

import json
import re
import statistics
from datetime import datetime
from pathlib import Path

from chatquiry_eval.config import EVAL, ROOT
from chatquiry_eval.graders import Check
from chatquiry_eval.runner import Run
from chatquiry_eval.scenarios import Scenario

Graded = tuple[Scenario, Run, list[Check]]


def _pct(n: int, total: int) -> str:
    return f"{round(100 * n / total)}%" if total else "—"


def _percentile(values: list[int], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(q * (len(ordered) - 1))))] / 1000


def _cost(run: Run) -> float:
    match = re.search(r"[\d.]+", run.trace.get("cost") or "")
    return float(match.group()) if match else 0.0


def summarize(graded: list[Graded], *, base_url: str, runs: int, started: datetime) -> dict:
    total = len(graded)
    passed = [g for g in graded if all(c.passed for c in g[2])]
    unsafe = [g for g in graded if any(c.safety and not c.passed for c in g[2])]
    ai_expected = [g for g in graded if g[0].outcome == "ai"]
    resolved = [g for g in ai_expected if not g[1].handed_off and all(c.passed for c in g[2])]
    missed = sum(1 for s, r, _ in graded if s.outcome == "person" and not r.handed_off)
    unnecessary = sum(1 for s, r, _ in graded if s.outcome == "ai" and r.handed_off)
    contained = sum(1 for _, r, _ in graded if not r.handed_off)
    turn_ms = [t.ms for _, r, _ in graded for t in r.turns]
    costs = [_cost(r) for _, r, _ in graded]
    routed = [g for g in graded if "rules_any" in g[0].expect]
    routed_ok = [g for g in routed if next(c for c in g[2] if c.name == "rules").passed] if routed else []
    versions = sorted({v for _, r, _ in graded for v in r.trace.get("versions", [])})

    segments = []
    for language in ("es", "pt"):
        group = [g for g in graded if g[0].language == language]
        if group:
            segments.append(
                {
                    "group": f"seg_{language}",
                    "n": len(group),
                    "ai_resolved": _pct(sum(1 for s, r, c in group if s.outcome == "ai" and not r.handed_off and all(x.passed for x in c)), len(group)),
                    "with_human": _pct(sum(1 for _, r, _ in group if r.handed_off), len(group)),
                    "unsafe": sum(1 for g in group if g in unsafe),
                }
            )

    per_resolution = sum(costs) / len(resolved) if resolved else 0.0
    return {
        "run_at": started.isoformat(timespec="seconds"),
        "base_url": base_url,
        "versions": versions,
        "scenarios": len({g[0].id for g in graded}),
        "runs_per_scenario": runs,
        "conversations": total,
        "passed": len(passed),
        "routing_accuracy": _pct(len(routed_ok), len(routed)),
        "kpis": {
            "safe_resolution": f"{_pct(len(resolved), len(ai_expected))} · {len(resolved)}/{len(ai_expected)}",
            "containment": _pct(contained, total),
            "handoff_quality": f"{missed} · {unnecessary}",
            "unsafe": f"{len(unsafe)} / {total}",
            "latency": f"{_percentile(turn_ms, 0.5):.1f} s · {_percentile(turn_ms, 0.95):.1f} s",
            "cost": f"US$ {statistics.fmean(costs) if costs else 0:.4f} · {per_resolution:.4f}",
        },
        "segments": segments,
        "results": [
            {
                "scenario": s.id,
                "attempt": r.attempt,
                "conversation": r.conversation_id,
                "passed": all(c.passed for c in checks),
                "unsafe": any(c.safety and not c.passed for c in checks),
                "failed": [f"{c.name}{f' ({c.detail})' if c.detail else ''}" for c in checks if not c.passed],
            }
            for s, r, checks in graded
        ],
    }


def write(summary: dict, scenarios: list[Scenario]) -> Path:
    results = EVAL / "results"
    (results / "runs").mkdir(parents=True, exist_ok=True)
    stamp = summary["run_at"].replace(":", "").replace("-", "")
    body = json.dumps(summary, indent=2, ensure_ascii=False)
    (results / "runs" / f"{stamp}.json").write_text(body)
    (results / "latest.json").write_text(body)
    report = ROOT / "docs" / "results.md"
    report.write_text(markdown(summary, scenarios))
    return report


def markdown(summary: dict, scenarios: list[Scenario]) -> str:
    k = summary["kpis"]
    by_id = {s.id: s for s in scenarios}
    rows = []
    for s in scenarios:
        runs = [r for r in summary["results"] if r["scenario"] == s.id]
        if not runs:
            continue
        ok = sum(r["passed"] for r in runs)
        failures = sorted({f for r in runs for f in r["failed"]})
        flag = " ⚠ unsafe" if any(r["unsafe"] for r in runs) else ""
        rows.append(f"| `{s.id}` | {s.group} | {s.language} | {s.outcome} | {ok}/{len(runs)}{flag} | {'; '.join(failures) or ''} |")
    groups = sorted({s.group for s in by_id.values()})
    return f"""# Evaluation results

Generated by `eval/` on {summary["run_at"]} against `{summary["base_url"]}`. Offline evaluation on the demo bank's data: {summary["scenarios"]} scripted scenarios, {summary["runs_per_scenario"]} runs each ({summary["conversations"]} conversations), played through the bank-facing API with an API key and a signed customer assertion, graded by deterministic checks on the replies and the trace. No model grades another model.

Versions under test: {", ".join(summary["versions"]) or "not reported"}.

## Summary

| Measure | Result | How it is computed |
|---|---|---|
| Safe automated resolution | {k["safe_resolution"]} | Runs of scenarios the AI should handle that ended without a person and passed every check |
| Containment | {k["containment"]} | Conversations that ended without a person (some scenarios must reach one) |
| Handoff quality | {k["handoff_quality"]} | Missed handoffs · unnecessary handoffs |
| Unsafe outcomes | {k["unsafe"]} | Runs with any safety check failed: a disclosure, an action without consent, a missed security handoff |
| Latency p50 · p95 | {k["latency"]} | Per customer message, measured by the caller with one conversation at a time, guardrail and intake included |
| Cost per case · per resolution | {k["cost"]} | Model tokens at Bedrock list prices; guardrail and intake calls are not included |
| Routing accuracy | {summary["routing_accuracy"]} | Runs where the expected routing or policy rule fired, which measures the intake classifier in context |
| All checks passed | {summary["passed"]} / {summary["conversations"]} | |

## Scenarios

Groups: {", ".join(groups)}. `ai` means the AI should handle it; `person` means a person must take over.

| Scenario | Group | Language | Outcome | Passed | Failed checks |
|---|---|---|---|---|---|
{chr(10).join(rows)}

## Limits

- The data is the organizers' static dataset; the service treats 2026-06-18 05:59 as "now".
- The model's wording varies between runs, which is why every scenario runs more than once.
- Scenario messages are fixed scripts. A customer who reacts to what the AI just said is not simulated.
- Costs cover model tokens only.
"""
