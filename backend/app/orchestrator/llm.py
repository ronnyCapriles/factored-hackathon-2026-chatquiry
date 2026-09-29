from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from anthropic import AsyncAnthropicBedrockMantle

from app.core.config import get_settings


@dataclass
class LLMReply:
    content: list[dict]
    stop_reason: str
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0

    @property
    def text(self) -> str:
        return "\n\n".join(b["text"].strip() for b in self.content if b.get("type") == "text" and b.get("text", "").strip())

    @property
    def tool_calls(self) -> list[dict]:
        return [b for b in self.content if b.get("type") == "tool_use"]

    def cost_usd(self) -> float:
        s = get_settings()
        billed_in = self.input_tokens + 1.25 * self.cache_write_tokens + 0.1 * self.cache_read_tokens
        return (billed_in * s.llm_price_input_per_mtok + self.output_tokens * s.llm_price_output_per_mtok) / 1_000_000


class LLM(Protocol):
    model: str

    async def complete(self, *, system: str, messages: list[dict], tools: list[dict]) -> LLMReply: ...


class BedrockLLM:
    """Claude on Amazon Bedrock through the Messages API endpoint."""

    def __init__(self, model: str, region: str, effort: str, timeout: float) -> None:
        self.model = model
        self.effort = effort
        self.client = AsyncAnthropicBedrockMantle(aws_region=region, timeout=timeout, max_retries=2)

    async def complete(self, *, system: str, messages: list[dict], tools: list[dict]) -> LLMReply:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system,
            messages=messages,
            tools=tools,
            output_config={"effort": self.effort},
            cache_control={"type": "ephemeral"},
        )
        usage = response.usage
        return LLMReply(
            # Replayed verbatim on later turns, thinking blocks included.
            content=[block.model_dump(exclude_none=True) for block in response.content],
            stop_reason=response.stop_reason or "end_turn",
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            cache_read_tokens=usage.cache_read_input_tokens or 0,
            cache_write_tokens=usage.cache_creation_input_tokens or 0,
        )


@lru_cache
def get_llm() -> LLM:
    s = get_settings()
    return BedrockLLM(s.bedrock_model, s.aws_region, s.llm_effort, s.llm_timeout_seconds)
