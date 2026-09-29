"""Every figure and reference in a reply must already exist in what the tools returned or the customer said."""

import re
from decimal import Decimal, InvalidOperation

NUMBER = re.compile(r"\d[\d.,]*\d|\d")
REFERENCE = re.compile(r"\b[A-Z]{2,4}-[A-Z0-9]{4,}\b")
# Day numbers, hours and small counts are too common to demand a source for.
FREE_BELOW = Decimal(32)
TOLERANCE = Decimal("0.005")


def _candidates(token: str) -> set[Decimal]:
    """Reads 4.650,87 and 4,650.87 alike; an ambiguous 4.650 yields both readings."""
    token = token.strip(".,")
    if not token:
        return set()
    try:
        if "." in token and "," in token:
            decimal_sep = "." if token.rfind(".") > token.rfind(",") else ","
            group_sep = "," if decimal_sep == "." else "."
            return {Decimal(token.replace(group_sep, "").replace(decimal_sep, "."))}
        for sep in (".", ","):
            if sep in token:
                parts = token.split(sep)
                grouped = Decimal("".join(parts))
                if len(parts) > 2:
                    return {grouped}
                as_decimal = Decimal(token.replace(sep, "."))
                return {grouped, as_decimal} if len(parts[1]) == 3 else {as_decimal}
        return {Decimal(token)}
    except InvalidOperation:
        return set()


def numbers(text: str) -> set[Decimal]:
    found: set[Decimal] = set()
    for token in NUMBER.findall(text):
        found |= _candidates(token)
    return found


def ungrounded(reply: str, sources: list[str]) -> list[str]:
    corpus = "\n".join(sources)
    known = numbers(corpus)
    problems = [ref for ref in REFERENCE.findall(reply) if ref not in corpus]
    for token in NUMBER.findall(reply):
        values = _candidates(token)
        if not values or all(v < FREE_BELOW for v in values):
            continue
        if not any(abs(v - k) <= max(Decimal("0.01"), k * TOLERANCE) for v in values for k in known):
            problems.append(token)
    return problems
