from datetime import datetime
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="CQ_", extra="ignore")

    env: str = "dev"
    database_url: str = "postgresql+asyncpg://chatquiry:chatquiry@127.0.0.1:5433/chatquiry"

    jwt_secret: str = Field(default="dev-only-change-me-to-a-long-random-value", min_length=32)
    jwt_ttl_minutes: int = 15
    # Public key (PEM) of the bank that signs customer assertions for the channel API.
    customer_assertion_public_key: str | None = None

    aws_region: str = "us-east-1"
    bedrock_model: str = "anthropic.claude-sonnet-5"
    bedrock_fallback_model: str = "anthropic.claude-haiku-4-5"
    guardrail_id: str | None = None
    guardrail_version: str = "DRAFT"
    llm_effort: str = "low"
    llm_timeout_seconds: float = 30.0
    # Bedrock list prices per million tokens, used for the cost shown in traces.
    llm_price_input_per_mtok: float = 2.0
    llm_price_output_per_mtok: float = 10.0

    # Times shown to people; stored timestamps stay in UTC.
    display_timezone: str = "America/Bogota"

    # The dataset ends here, so the service treats it as "now" for deadlines and relative dates.
    data_as_of: datetime = datetime(2026, 6, 18, 5, 59, 41)

    # Browser origins allowed to call the API directly. The Next.js server calls it server side and needs no entry.
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Written by the evaluation harness; the operations page reads it when present.
    eval_results: Path = Path(__file__).resolve().parents[3] / "eval" / "results" / "latest.json"

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_prod and settings.jwt_secret.startswith("dev-only"):
        raise RuntimeError("CQ_JWT_SECRET must be set in production")
    return settings
