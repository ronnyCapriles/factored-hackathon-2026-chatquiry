from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.main import app


@pytest.fixture(autouse=True)
def no_cloud_guardrail(monkeypatch):
    # Tests never reach AWS; the guardrail path is covered by faking check_guardrail.
    monkeypatch.setattr(get_settings(), "guardrail_id", None)


@pytest.fixture(scope="session")
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def login(client: AsyncClient, email: str, password: str = "demo-demo") -> dict[str, str]:
    res = await client.post("/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


@pytest.fixture(scope="session")
async def agent(client: AsyncClient) -> dict[str, str]:
    return await login(client, "andrea.rios@chatquiry.demo")


@pytest.fixture(scope="session")
async def admin(client: AsyncClient) -> dict[str, str]:
    return await login(client, "marco.vidal@chatquiry.demo")
