from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import delete

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Conversation, Customer, Organization, Workspace

ADMIN_ONLY = ["/v1/operations", "/v1/audit", "/v1/audit/actors", "/v1/integrations", "/v1/role-permissions"]


async def test_login_does_not_reveal_which_part_failed(client):
    unknown = await client.post("/v1/auth/login", json={"email": "nobody@chatquiry.demo", "password": "x"})
    wrong = await client.post("/v1/auth/login", json={"email": "andrea.rios@chatquiry.demo", "password": "wrong"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json() == {"detail": "invalid_credentials"}


async def test_token_required(client):
    assert (await client.get("/v1/me/profile")).status_code == 401
    assert (await client.get("/v1/me/profile", headers={"Authorization": "Bearer nope"})).json()["detail"] == "invalid_token"


async def test_expired_token_is_rejected(client):
    expired = jwt.encode(
        {"sub": "USR-AR", "org": "ORG-LATAM", "ws": "WS-DEFAULT", "role": "agent", "exp": datetime.now(UTC) - timedelta(seconds=1)},
        get_settings().jwt_secret,
        algorithm="HS256",
    )
    res = await client.get("/v1/me/profile", headers={"Authorization": f"Bearer {expired}"})
    assert res.status_code == 401 and res.json()["detail"] == "session_expired"


async def test_agent_cannot_open_admin_endpoints(client, agent, admin):
    for path in ADMIN_ONLY:
        assert (await client.get(path, headers=agent)).status_code == 403, path
        assert (await client.get(path, headers=admin)).status_code == 200, path


async def test_profile_update_is_validated_and_persisted(client, agent):
    bad = await client.patch("/v1/me/profile", headers=agent, json={"avatarUrl": "https://evil.example/x.png"})
    assert bad.status_code == 422
    ok = await client.patch("/v1/me/profile", headers=agent, json={"availability": "paused", "locale": "pt"})
    assert ok.status_code == 200 and ok.json()["availability"] == "paused" and ok.json()["locale"] == "pt"
    await client.patch("/v1/me/profile", headers=agent, json={"availability": "available", "locale": "es"})


async def test_config_is_localized(client, admin):
    es = (await client.get("/v1/config", headers={**admin, "X-Chatquiry-Locale": "es"})).json()
    en = (await client.get("/v1/config", headers={**admin, "X-Chatquiry-Locale": "en"})).json()
    assert es["departments"][1]["name"] == "Consultas de transacciones"
    assert en["departments"][1]["name"] == "Transaction inquiries"


async def test_audit_is_paginated(client, admin):
    page = (await client.get("/v1/audit", headers=admin, params={"pageSize": 2})).json()
    assert page["pageSize"] == 2 and len(page["items"]) <= 2 and page["total"] >= len(page["items"])


async def test_other_workspace_is_invisible(client, agent):
    """A record in another workspace must not be reachable even by its id."""
    async with SessionLocal() as s:
        s.add(Organization(id="ORG-OTHER", name="Other bank"))
        s.add(Workspace(id="WS-OTHER", org_id="ORG-OTHER", name="Other"))
        await s.flush()
        s.add(
            Customer(
                customer_id="CLI-OTHER",
                org_id="ORG-OTHER",
                workspace_id="WS-OTHER",
                document_type="CC",
                document_number="999",
                first_name="Otro",
                last_name="Cliente",
                city="X",
                country="Colombia",
                segment="Basic",
                customer_status="Active",
                registration_date=datetime(2024, 1, 1),
            )
        )
        await s.flush()
        s.add(
            Conversation(
                id="CNV-OTHER", org_id="ORG-OTHER", workspace_id="WS-OTHER", customer_id="CLI-OTHER", channel="api", language="es", state="needs_human"
            )
        )
        await s.commit()
    try:
        assert (await client.get("/v1/conversations/CNV-OTHER", headers=agent)).status_code == 404
        assert (await client.get("/v1/customers/CLI-OTHER", headers=agent)).status_code == 404
        assert (await client.get("/v1/traces/CNV-OTHER", headers=agent)).status_code == 404
        ids = [c["id"] for c in (await client.get("/v1/conversations", headers=agent)).json()]
        assert "CNV-OTHER" not in ids
    finally:
        async with SessionLocal() as s:
            await s.execute(delete(Conversation).where(Conversation.workspace_id == "WS-OTHER"))
            await s.execute(delete(Customer).where(Customer.workspace_id == "WS-OTHER"))
            await s.execute(delete(Workspace).where(Workspace.id == "WS-OTHER"))
            await s.execute(delete(Organization).where(Organization.id == "ORG-OTHER"))
            await s.commit()


async def test_refresh_slides_the_session_but_keeps_the_sign_in_time(client):
    login = (await client.post("/v1/auth/login", json={"email": "diego.paz@chatquiry.demo", "password": "demo-demo"})).json()
    renewed = await client.post("/v1/auth/refresh", headers={"Authorization": f"Bearer {login['token']}"})
    assert renewed.status_code == 200 and renewed.json()["expiresAt"] >= login["expiresAt"]
    first = jwt.decode(login["token"], get_settings().jwt_secret, algorithms=["HS256"])
    second = jwt.decode(renewed.json()["token"], get_settings().jwt_secret, algorithms=["HS256"])
    assert first["auth_time"] == second["auth_time"]

    stale = jwt.encode(
        {**first, "auth_time": int((datetime.now(UTC) - timedelta(hours=13)).timestamp()), "exp": datetime.now(UTC) + timedelta(minutes=5)},
        get_settings().jwt_secret,
        algorithm="HS256",
    )
    assert (await client.post("/v1/auth/refresh", headers={"Authorization": f"Bearer {stale}"})).status_code == 401
