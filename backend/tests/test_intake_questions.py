"""Editing the intake questions: wording may change, the shape routing depends on may not."""

import copy

import pytest
from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.models import ClassifierQuestions
from app.orchestrator.jev import QUESTIONS


@pytest.fixture
async def restore_wording():
    async with SessionLocal() as s:
        before = await s.scalar(select(ClassifierQuestions))
        saved = (copy.deepcopy(before.questions), before.version, before.updated_by) if before else None
    yield
    async with SessionLocal() as s:
        if saved is None:
            await s.execute(delete(ClassifierQuestions))
        else:
            row = await s.scalar(select(ClassifierQuestions))
            row.questions, row.version, row.updated_by = saved
        await s.commit()


async def test_config_shows_the_request_jev_receives(client, admin):
    intake = (await client.get("/v1/config", headers=admin)).json()["intake"]["questions"]
    assert set(intake["questions"]) == set(QUESTIONS)
    assert '"customer_message"' in intake["request"] and intake["provider"] == "TypeSafe Jev"


async def test_wording_can_change_and_be_restored(client, admin, restore_wording):
    edited = copy.deepcopy(QUESTIONS)
    edited["frustrated"]["instructions"] = "The customer sounds annoyed or impatient."
    saved = await client.put("/v1/config/intake/questions", headers=admin, json={"questions": edited})
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert not body["isDefault"] and body["questions"]["frustrated"]["instructions"] == "The customer sounds annoyed or impatient."
    assert body["updatedBy"] == "Marco Vidal"

    restored = (await client.delete("/v1/config/intake/questions", headers=admin)).json()
    assert restored["isDefault"] and restored["version"] == body["version"] + 1


@pytest.mark.parametrize(
    "change",
    [
        lambda q: q.pop("closing"),
        lambda q: q["intent"]["criteria"].pop("card"),
        lambda q: q["manipulation"].update(type="choice"),
        lambda q: q["language"].update(instructions="  "),
    ],
)
async def test_the_shape_routing_reads_cannot_change(client, admin, restore_wording, change):
    edited = copy.deepcopy(QUESTIONS)
    change(edited)
    assert (await client.put("/v1/config/intake/questions", headers=admin, json={"questions": edited})).status_code == 422


async def test_agents_cannot_edit_the_questions(client, agent):
    assert (await client.put("/v1/config/intake/questions", headers=agent, json={"questions": QUESTIONS})).status_code == 403
