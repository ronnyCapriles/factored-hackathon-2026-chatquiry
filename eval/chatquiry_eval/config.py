"""Where the harness runs and with which credentials. The repository's .env is read so local runs need no exports."""

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVAL = ROOT / "eval"


def _dotenv() -> dict[str, str]:
    path = ROOT / ".env"
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values


@dataclass(frozen=True)
class Settings:
    base_url: str
    api_key: str
    staff_email: str
    staff_password: str
    private_key: Path
    meta: Path


def load() -> Settings:
    env = {**_dotenv(), **os.environ}
    return Settings(
        base_url=env.get("EVAL_BASE_URL", "http://127.0.0.1:8010").rstrip("/"),
        api_key=env.get("EVAL_API_KEY", ""),
        # Read-only staff account, used to fetch traces for grading.
        staff_email=env.get("EVAL_STAFF_EMAIL", "marco.vidal@chatquiry.demo"),
        staff_password=env.get("EVAL_STAFF_PASSWORD", "demo-demo"),
        private_key=Path(env.get("EVAL_PRIVATE_KEY", EVAL / ".secrets" / "bank_private.pem")),
        meta=Path(env.get("EVAL_META", ROOT / "data" / "gold" / "meta.json")),
    )
