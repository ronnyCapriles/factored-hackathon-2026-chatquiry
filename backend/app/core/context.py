from dataclasses import dataclass
from typing import Literal

Locale = Literal["es", "en", "pt"]
Role = Literal["agent", "admin"]
LOCALES: tuple[Locale, ...] = ("es", "en", "pt")


@dataclass(frozen=True)
class RequestContext:
    """Who is calling and in which workspace. Every query is scoped with it."""

    org_id: str
    workspace_id: str
    locale: Locale
    user_id: str | None = None
    role: Role | None = None
    # Set only for channel calls, from a verified customer assertion.
    customer_id: str | None = None


def pick_locale(header: str | None, accept_language: str | None = None) -> Locale:
    for raw in (header, *(accept_language or "").split(",")):
        code = (raw or "").split(";")[0].strip()[:2].lower()
        if code in LOCALES:
            return code  # type: ignore[return-value]
    return "es"


def localized(text: dict[str, str] | str | None, locale: Locale) -> str:
    """Config text is stored per language; fall back to Spanish, the source."""
    if text is None:
        return ""
    if isinstance(text, str):
        return text
    return text.get(locale) or text.get("es") or next(iter(text.values()), "")
