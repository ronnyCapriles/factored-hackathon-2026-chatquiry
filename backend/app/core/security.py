import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()
# Verified against when the user does not exist, so both paths cost the same.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_access_token(subject: str, claims: dict[str, Any]) -> tuple[str, datetime]:
    settings = get_settings()
    expires = datetime.now(UTC) + timedelta(minutes=settings.jwt_ttl_minutes)
    payload = {"sub": subject, "exp": expires, "iat": datetime.now(UTC), **claims}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256"), expires


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])


def new_api_key(environment: str) -> tuple[str, str, str]:
    """Returns (full key shown once, prefix for lookup, sha256 hash to store)."""
    prefix = f"cq_{environment}_{secrets.token_hex(4)}"
    key = f"{prefix}_{secrets.token_urlsafe(24)}"
    return key, prefix, hash_api_key(key)


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


ASSERTION_AUDIENCE = "chatquiry"
ASSERTION_MAX_LIFETIME_SECONDS = 600


def verify_customer_assertion(token: str) -> str:
    """The bank signs who the customer is (RS256); we only trust a short-lived assertion for our audience."""
    public_key = get_settings().customer_assertion_public_key
    if not public_key:
        raise jwt.InvalidTokenError("customer assertions are not configured")
    claims = jwt.decode(token, public_key, algorithms=["RS256"], audience=ASSERTION_AUDIENCE, options={"require": ["exp", "iat", "sub", "aud"]})
    if claims["exp"] - claims["iat"] > ASSERTION_MAX_LIFETIME_SECONDS:
        raise jwt.InvalidTokenError("assertion lives too long")
    return str(claims["sub"])
