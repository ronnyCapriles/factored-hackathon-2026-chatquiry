from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.main import app
from app.orchestrator.classifier import get_classifier
from app.orchestrator.intake import RulesClassifier


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    # Tests never reach AWS or TypeSafe: the guardrail is faked where needed and Jev is tested against a fake server.
    monkeypatch.setattr(get_settings(), "guardrail_id", None)
    app.dependency_overrides[get_classifier] = RulesClassifier
    yield
    app.dependency_overrides.pop(get_classifier, None)


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


# Demo customers and transactions for orchestrator tests, shared by every test module.
from tests.test_orchestrator import world  # noqa: E402, F401
