from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext, Role, pick_locale
from app.core.db import get_session
from app.core.security import decode_access_token

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
