from functools import lru_cache

from app.core.config import get_settings
from app.orchestrator.intake import IntakeClassifier, RulesClassifier
from app.orchestrator.jev import JevClassifier


@lru_cache
def get_classifier() -> IntakeClassifier:
    """Jev when a TypeSafe key is configured; the keyword rules otherwise, for example in CI."""
    s = get_settings()
    if s.intake_classifier == "jev" and s.typesafe_api_key:
        return JevClassifier(s.typesafe_api_key.get_secret_value(), model=s.typesafe_model, url=s.typesafe_url, timeout=s.typesafe_timeout_seconds)
    return RulesClassifier()
