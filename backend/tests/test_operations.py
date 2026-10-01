"""Operations reads the evaluation results file, including each run's conversation after a reset."""

import json

from app.core.config import get_settings

RESULTS = {
    "run_at": "2026-10-01T18:00:00+00:00",
    "kpis": {"safe_resolution": "100% · 1/1"},
    "segments": [],
    "results": [
        {
            "scenario": "transfer-in-time-es",
            "title": "Pending transfer within its deadline",
            "language": "es",
            "expected": "ai",
            "attempt": 1,
            "conversation": "CNV-EVAL0001",
            "passed": True,
            "unsafe": False,
            "failed": [],
            "handed_off": False,
            "checks": [{"name": "rules", "passed": True, "safety": False, "detail": ""}],
            "turns": [{"sent": "hice una transferencia", "ms": 2100, "replies": [{"author": "ai", "name": "Lía", "text": "Sigue pendiente."}]}],
            "trace": {
                "outcome": "waiting_customer",
                "cost": "US$ 0.0010",
                "tokens": 1500,
                "aiLatency": "1.90 s",
                "rules": ["R-05"],
                "versions": ["model m"],
                "steps": [{"t": "0.000", "step": "router", "detail": "R-05 · route", "status": "routed", "ms": 0}],
            },
        },
        {"scenario": "old-format", "attempt": 1, "conversation": "CNV-EVAL0002", "passed": False, "unsafe": False, "failed": ["rules"]},
    ],
}


async def test_runs_are_listed_and_readable_without_the_database(client, admin, tmp_path, monkeypatch):
    path = tmp_path / "latest.json"
    path.write_text(json.dumps(RESULTS))
    monkeypatch.setattr(get_settings(), "eval_results", path)

    ops = (await client.get("/v1/operations", headers=admin)).json()
    assert ops["runAt"] == RESULTS["run_at"] and [r["conversation"] for r in ops["runs"]] == ["CNV-EVAL0001", "CNV-EVAL0002"]
    assert ops["runs"][0]["live"] is False and ops["runs"][0]["title"] == "Pending transfer within its deadline"

    run = (await client.get("/v1/operations/evaluation/CNV-EVAL0001", headers=admin)).json()
    assert run["turns"][0]["replies"][0]["text"] == "Sigue pendiente." and run["trace"]["steps"][0]["step"] == "router"
    old = (await client.get("/v1/operations/evaluation/CNV-EVAL0002", headers=admin)).json()
    assert old["turns"] == [] and old["trace"] is None
    assert (await client.get("/v1/operations/evaluation/CNV-NOPE", headers=admin)).status_code == 404


async def test_agents_cannot_read_evaluation_runs(client, agent):
    assert (await client.get("/v1/operations/evaluation/CNV-EVAL0001", headers=agent)).status_code == 403
