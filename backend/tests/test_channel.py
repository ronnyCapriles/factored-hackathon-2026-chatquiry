"""The bank-facing API: an API key picks the workspace and a signed assertion names the customer."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import delete

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import new_api_key
from app.models import ApiKey
from tests.test_orchestrator import ScriptedLLM, say, use, world  # noqa: F401
from tests.test_test_chat import TENANT

PRIVATE = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PUBLIC_PEM = PRIVATE.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()


def assertion(customer_id: str, lifetime: timedelta = timedelta(minutes=5), key=PRIVATE) -> str:
    now = datetime.now(UTC)
    return jwt.encode({"sub": customer_id, "aud": "chatquiry", "iat": now, "exp": now + lifetime}, key, algorithm="RS256")


@pytest.fixture
async def bank(monkeypatch, world):  # noqa: F811
    monkeypatch.setattr(get_settings(), "customer_assertion_public_key", PUBLIC_PEM)
    keys = {}
    async with SessionLocal() as s:
        for key_id, scopes in (("KEY-T-WRITE", ["conversations:write"]), ("KEY-T-READ", ["conversations:read"])):
            full, prefix, key_hash = new_api_key("test")
            s.add(ApiKey(id=key_id, name=key_id, prefix=prefix, key_hash=key_hash, environment="test", scopes=scopes, **TENANT))
            keys[key_id] = full
        await s.commit()
    yield keys
    async with SessionLocal() as s:
        await s.execute(delete(ApiKey).where(ApiKey.id.in_(list(keys))))
        await s.commit()


def headers(key: str, token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}", "X-Customer-Assertion": token}


async def test_bank_starts_a_conversation_and_talks_as_its_customer(client, bank):
    use(ScriptedLLM(say("Claro, cuéntame qué transferencia es.")))
    auth = headers(bank["KEY-T-WRITE"], assertion("CLI-T-ORCH"))
    started = await client.post("/v1/conversations", headers=auth, json={"channel": "whatsapp"})
    assert started.status_code == 201, started.text
    cid = started.json()["conversationId"]
    assert started.json()["replies"][0]["author"] == "ai"

    turn = await client.post(f"/v1/conversations/{cid}/messages", headers=auth, json={"text": "Hice una transferencia y no llega"})
    assert turn.status_code == 200, turn.text
    assert turn.json()["replies"][0]["text"].startswith("Claro") and "inspection" not in turn.json()


async def test_another_customer_cannot_use_the_conversation(client, bank):
    started = await client.post("/v1/conversations", headers=headers(bank["KEY-T-WRITE"], assertion("CLI-T-ORCH")), json={})
    cid = started.json()["conversationId"]
    other = headers(bank["KEY-T-WRITE"], assertion("CLI-T-NEIGHBOR"))
    assert (await client.post(f"/v1/conversations/{cid}/messages", headers=other, json={"text": "hola"})).status_code == 404


async def test_keys_and_assertions_are_checked(client, bank):
    good = assertion("CLI-T-ORCH")
    forged = assertion("CLI-T-ORCH", key=rsa.generate_private_key(public_exponent=65537, key_size=2048))
    cases = [
        (headers("cq_test_nothere_x", good), 401),
        (headers(bank["KEY-T-WRITE"] + "x", good), 401),
        (headers(bank["KEY-T-READ"], good), 403),
        (headers(bank["KEY-T-WRITE"], forged), 401),
        (headers(bank["KEY-T-WRITE"], assertion("CLI-T-ORCH", lifetime=timedelta(hours=2))), 401),
        (headers(bank["KEY-T-WRITE"], assertion("CLI-T-ORCH", lifetime=timedelta(seconds=-5))), 401),
        ({"Authorization": f"Bearer {bank['KEY-T-WRITE']}"}, 401),
    ]
    for auth, expected in cases:
        assert (await client.post("/v1/conversations", headers=auth, json={})).status_code == expected, auth
