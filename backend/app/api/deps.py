import hmac
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext, Role, pick_locale
from app.core.db import get_session
from app.core.security import decode_access_token, hash_api_key, verify_customer_assertion
from app.models import ApiKey
from app.models.base import utcnow

Session = Annotated[AsyncSession, Depends(get_session)]


def _locale(x_chatquiry_locale: str | None, accept_language: str | None):
    return pick_locale(x_chatquiry_locale, accept_language)


async def staff_context(
    authorization: Annotated[str | None, Header()] = None,
    x_chatquiry_locale: Annotated[str | None, Header()] = None,
    accept_language: Annotated[str | None, Header()] = None,
) -> RequestContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing_token")
    try:
        claims = decode_access_token(authorization.split(" ", 1)[1])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "session_expired") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_token") from None
    return RequestContext(
        org_id=claims["org"],
        workspace_id=claims["ws"],
        user_id=claims["sub"],
        role=claims["role"],
        locale=_locale(x_chatquiry_locale, accept_language),
    )


Staff = Annotated[RequestContext, Depends(staff_context)]


def require_role(*roles: Role):
    async def check(ctx: Staff) -> RequestContext:
        if ctx.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "forbidden")
        return ctx

    return Depends(check)


Admin = Annotated[RequestContext, require_role("admin")]
Agent = Annotated[RequestContext, require_role("agent")]


async def channel_context(
    session: Session,
    authorization: Annotated[str | None, Header()] = None,
    x_customer_assertion: Annotated[str | None, Header()] = None,
    x_chatquiry_locale: Annotated[str | None, Header()] = None,
    accept_language: Annotated[str | None, Header()] = None,
) -> RequestContext:
    """A bank's system: its API key picks the workspace, its signed assertion names the customer."""
    key_text = authorization.split(" ", 1)[1].strip() if authorization and authorization.lower().startswith("bearer ") else ""
    prefix = "_".join(key_text.split("_")[:3])
    key = await session.scalar(select(ApiKey).where(ApiKey.prefix == prefix, ApiKey.active)) if key_text.startswith("cq_") else None
    if not key or not hmac.compare_digest(key.key_hash, hash_api_key(key_text)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_api_key")
    if "conversations:write" not in key.scopes:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "missing_scope")
    try:
        customer_id = verify_customer_assertion(x_customer_assertion or "")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_customer_assertion") from None
    key.last_used_at = utcnow()
    return RequestContext(
        org_id=key.org_id,
        workspace_id=key.workspace_id,
        locale=_locale(x_chatquiry_locale, accept_language),
        customer_id=customer_id,
    )


BankChannel = Annotated[RequestContext, Depends(channel_context)]
