"""Plays each scenario as the bank would: API key, a signed customer assertion, one message at a time."""

import time
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import httpx
import jwt

from chatquiry_eval.config import Settings
from chatquiry_eval.scenarios import Scenario, render


@dataclass
class Turn:
    sent: str
    replies: list[dict]
    ms: int


@dataclass
class Run:
    scenario: str
    attempt: int
    conversation_id: str = ""
    turns: list[Turn] = field(default_factory=list)
    state: str = ""
    handed_off: bool = False
    department: str | None = None
    trace: dict = field(default_factory=dict)
    error: str | None = None

    @property
    def ai_replies(self) -> list[str]:
        return [r["text"] for t in self.turns for r in t.replies if r["author"] == "ai"]


class Runner:
    def __init__(self, settings: Settings, known: dict[str, dict]) -> None:
        self.settings = settings
        self.known = known
        self.private_key = settings.private_key.read_text()
        self.client = httpx.AsyncClient(base_url=settings.base_url, timeout=90)
        self.staff_token = ""

    async def __aenter__(self) -> "Runner":
        res = await self.client.post("/v1/auth/login", json={"email": self.settings.staff_email, "password": self.settings.staff_password})
        res.raise_for_status()
        self.staff_token = res.json()["token"]
        return self

    async def __aexit__(self, *_) -> None:
        await self.client.aclose()

    def _headers(self, customer_id: str, language: str) -> dict[str, str]:
        now = datetime.now(UTC)
        assertion = jwt.encode({"sub": customer_id, "aud": "chatquiry", "iat": now, "exp": now + timedelta(minutes=5)}, self.private_key, algorithm="RS256")
        return {"Authorization": f"Bearer {self.settings.api_key}", "X-Customer-Assertion": assertion, "X-Chatquiry-Locale": language}

    async def play(self, scenario: Scenario, attempt: int) -> Run:
        run = Run(scenario.id, attempt)
        own = self.known[scenario.customer]
        try:
            started = await self.client.post("/v1/conversations", json={"channel": "api"}, headers=self._headers(own["customer_id"], scenario.language))
            started.raise_for_status()
            run.conversation_id = started.json()["conversationId"]
            for text in scenario.messages:
                message = render(text, own, self.known)
                t0 = time.perf_counter()
                res = await self.client.post(
                    f"/v1/conversations/{run.conversation_id}/messages", json={"text": message}, headers=self._headers(own["customer_id"], scenario.language)
                )
                res.raise_for_status()
                run.turns.append(Turn(message, res.json()["replies"], int((time.perf_counter() - t0) * 1000)))
            staff = {"Authorization": f"Bearer {self.staff_token}"}
            conversation = (await self.client.get(f"/v1/conversations/{run.conversation_id}", headers=staff)).json()
            run.state = conversation["state"]
            run.handed_off = conversation.get("handoff") is not None
            run.department = conversation.get("departmentId")
            run.trace = (await self.client.get(f"/v1/traces/{run.conversation_id}", headers=staff)).json()
        except httpx.HTTPError as e:
            run.error = f"{type(e).__name__}: {e}"
        return run
