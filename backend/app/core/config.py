from functools import lru_cache

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

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3100"]

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_prod and settings.jwt_secret.startswith("dev-only"):
        raise RuntimeError("CQ_JWT_SECRET must be set in production")
    return settings
