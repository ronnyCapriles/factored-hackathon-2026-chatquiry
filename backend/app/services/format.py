from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.context import Locale


def mask_tail(value: str | None, keep: int = 4) -> str:
    if not value:
        return "—"
    return "••••" + value[-keep:]


def mask_email(value: str | None) -> str:
    if not value or "@" not in value:
        return "—"
    user, domain = value.split("@", 1)
    return f"{user[0]}•••@{domain}"


def mask_phone(value: str | None) -> str:
    if not value:
        return "—"
    digits = "".join(c for c in value if c.isdigit())
    return f"+{digits[:2]} ••• ••• {digits[-4:]}" if len(digits) > 6 else "••••"


def hhmm(value: datetime | None) -> str:
    if not value:
        return ""
    if value.tzinfo:
        value = value.astimezone(ZoneInfo(get_settings().display_timezone))
    return value.strftime("%H:%M")


_MONTHS = {
    "es": ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "pt": ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
}


def month_year(value: datetime, locale: Locale) -> str:
    return f"{_MONTHS[locale][value.month - 1]} {value.year}"


def initials(first: str, last: str) -> str:
    return (first[:1] + last[:1]).upper()
