"""A person takes over: replies reach the customer, and the conversation can be resolved or handed back to the AI."""

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import AuditLog, Conversation, Handoff
from tests.test_orchestrator import FRAUD_TX, ScriptedLLM, call, say, send, use


async def handed_off(client, agent) -> str:
    use(ScriptedLLM())
    turn = await send(client, agent, "la verdad no soy Marta")
    assert turn["handedOff"]
    return turn["conversationId"]


async def test_a_reply_reaches_the_customer_and_open_screens(client, agent, admin, world):
    cid = await handed_off(client, agent)
    before = (await client.get(f"/v1/conversations/{cid}/updates", headers=agent)).json()
    last = before["messages"][-1]["id"]

    reply = await client.post(f"/v1/conversations/{cid}/reply", headers=agent, json={"text": "Hola, soy Andrea. ¿Me confirmas tu nombre completo?"})
    assert reply.status_code == 200 and reply.json()["author"] == "human" and reply.json()["authorName"] == "Andrea"
    assert (await client.post(f"/v1/conversations/{cid}/reply", headers=admin, json={"text": "hola"})).status_code == 403

    news = (await client.get(f"/v1/conversations/{cid}/updates", headers=agent, params={"after": last})).json()
    assert [m["author"] for m in news["messages"]] == ["human"] and news["state"] == "with_human" and news["human"] and news["responder"] == "Andrea"

    customer = await send(client, agent, "Marta Lucía Prueba", cid)
    assert customer["replies"] == []

    assert (await client.post(f"/v1/conversations/{cid}/resolve", headers=agent)).status_code == 204
    closed = (await client.get(f"/v1/conversations/{cid}/updates", headers=agent, params={"after": reply.json()["id"]})).json()
    assert closed["state"] == "resolved" and closed["messages"][-1]["author"] == "system"
    assert (await client.post(f"/v1/conversations/{cid}/reply", headers=agent, json={"text": "otra"})).status_code == 409


async def test_handing_back_gives_the_ai_what_happened_meanwhile(client, agent, world):
    cid = await handed_off(client, agent)
    await client.post(f"/v1/conversations/{cid}/reply", headers=agent, json={"text": "Ya verifiqué tu identidad, te devuelvo con el asistente."})
    assert (await client.post(f"/v1/conversations/{cid}/return", headers=agent)).status_code == 204

    async with SessionLocal() as s:
        conversation = await s.get(Conversation, cid)
        assert conversation.state == "waiting_customer" and conversation.flags["security_strikes"] == 0

    seen = {}

    def answer(messages):
        seen["history"] = str(messages)
        return say("Claro, ¿qué necesitas revisar?")

    use(ScriptedLLM(answer))
    turn = await send(client, agent, "gracias, quería preguntar algo más", cid)
    assert turn["replies"][0]["text"].startswith("Claro") and "te devuelvo con el asistente" in seen["history"]


async def test_a_human_only_action_is_recorded_as_simulated(client, agent, world):
    use(
        ScriptedLLM(
            call("find_transactions", days_back=30),
            say("¿Es esa compra?"),
            call("propose_dispute", transaction_id=FRAUD_TX, reason="not_recognized"),
            say("¿La abro?"),
        )
    )
    cid = (await send(client, agent, "No reconozco una compra"))["conversationId"]
    await send(client, agent, "sí, esa", cid)
    await send(client, agent, "sí", cid)

    assert (await client.post(f"/v1/conversations/{cid}/human-actions/block_card", headers=agent)).status_code == 204
    assert (await client.post(f"/v1/conversations/{cid}/human-actions/wire_money", headers=agent)).status_code == 404
    async with SessionLocal() as s:
        handoff = await s.scalar(select(Handoff).where(Handoff.conversation_id == cid))
        audit = await s.scalar(select(AuditLog).where(AuditLog.target == cid, AuditLog.action.like("%(simulated)")))
    assert handoff.actions[-1]["description"].endswith("(simulado)") and audit is not None
