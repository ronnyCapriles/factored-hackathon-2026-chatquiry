"""Model access. The orchestrator keeps its own message format; each adapter translates at the edge."""

import asyncio
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

import anthropic
import boto3
from anthropic import AsyncAnthropicBedrock
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import get_settings

log = logging.getLogger(__name__)


class LLMUnavailable(Exception):
    """The model could not answer; the orchestrator falls back to a person."""


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


STOP_REASONS = {
    "tool_use": "tool_use",
    "end_turn": "end_turn",
    "stop_sequence": "end_turn",
    "max_tokens": "max_tokens",
    "guardrail_intervened": "refusal",
    "content_filtered": "refusal",
}


def to_converse(messages: list[dict]) -> list[dict]:
    """Converse wants strictly alternating roles and no empty blocks, so same-role turns are merged."""
    out: list[dict] = []
    for message in messages:
        content = message["content"] if isinstance(message["content"], list) else [{"type": "text", "text": message["content"]}]
        blocks: list[dict] = []
        for block in content:
            kind = block.get("type")
            if kind == "text" and block.get("text", "").strip():
                blocks.append({"text": block["text"]})
            elif kind == "tool_use":
                blocks.append({"toolUse": {"toolUseId": block["id"], "name": block["name"], "input": block.get("input") or {}}})
            elif kind == "tool_result":
                result = block["content"] if isinstance(block["content"], str) else str(block["content"])
                status = "error" if block.get("is_error") else "success"
                blocks.append({"toolResult": {"toolUseId": block["tool_use_id"], "content": [{"text": result}], "status": status}})
        if not blocks:
            continue
        if out and out[-1]["role"] == message["role"]:
            out[-1]["content"].extend(blocks)
        else:
            out.append({"role": message["role"], "content": blocks})
    return out


def from_converse(blocks: list[dict]) -> list[dict]:
    out: list[dict] = []
    for block in blocks:
        if block.get("text"):
            out.append({"type": "text", "text": block["text"]})
        elif "toolUse" in block:
            call = block["toolUse"]
            out.append({"type": "tool_use", "id": call["toolUseId"], "name": call["name"], "input": call.get("input") or {}})
    return out


class ConverseLLM:
    """Any chat model on Amazon Bedrock through the Converse API."""

    def __init__(self, model: str, region: str, timeout: float, temperature: float) -> None:
        self.model = model
        self.temperature = temperature
        self.client = boto3.client(
            "bedrock-runtime",
            region_name=region,
            config=Config(connect_timeout=5, read_timeout=timeout, retries={"max_attempts": 3, "mode": "standard"}),
        )

    async def complete(self, *, system: str, messages: list[dict], tools: list[dict]) -> LLMReply:
        request: dict = {
            "modelId": self.model,
            "system": [{"text": system}],
            "messages": to_converse(messages),
            "inferenceConfig": {"maxTokens": 2048, "temperature": self.temperature},
        }
        if tools:
            request["toolConfig"] = {
                "tools": [{"toolSpec": {"name": t["name"], "description": t["description"], "inputSchema": {"json": t["input_schema"]}}} for t in tools]
            }
        try:
            response = await asyncio.to_thread(self.client.converse, **request)
        except ClientError as e:
            log.warning("bedrock converse failed: %s", e)
            raise LLMUnavailable(e.response["Error"]["Code"]) from e
        except BotoCoreError as e:
            log.warning("bedrock converse failed: %s", e)
            raise LLMUnavailable(type(e).__name__) from e
        usage = response.get("usage", {})
        return LLMReply(
            content=from_converse(response["output"]["message"]["content"]),
            stop_reason=STOP_REASONS.get(response["stopReason"], "end_turn"),
            input_tokens=usage.get("inputTokens", 0),
            output_tokens=usage.get("outputTokens", 0),
            cache_read_tokens=usage.get("cacheReadInputTokens", 0),
            cache_write_tokens=usage.get("cacheWriteInputTokens", 0),
        )


class AnthropicBedrockLLM:
    """Claude on Amazon Bedrock through InvokeModel, for accounts in regions where Anthropic serves it."""

    def __init__(self, model: str, region: str, effort: str, timeout: float) -> None:
        self.model = model
        self.effort = effort
        self.client = AsyncAnthropicBedrock(aws_region=region, timeout=timeout, max_retries=2)

    async def complete(self, *, system: str, messages: list[dict], tools: list[dict]) -> LLMReply:
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                # The breakpoint on the system prompt caches tools and system together; both are stable across turns.
                system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
                messages=messages,
                tools=tools,
                output_config={"effort": self.effort},
            )
        except anthropic.APIError as e:
            log.warning("anthropic on bedrock failed: %s", e)
            raise LLMUnavailable(type(e).__name__) from e
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
    if s.llm_provider == "anthropic":
        return AnthropicBedrockLLM(s.bedrock_model, s.aws_region, s.llm_effort, s.llm_timeout_seconds)
    return ConverseLLM(s.bedrock_model, s.aws_region, s.llm_timeout_seconds, s.llm_temperature)
