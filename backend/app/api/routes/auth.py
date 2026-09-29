from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from sqlalchemy import func, select

from app.api.deps import Session, Staff
from app.core.config import get_settings
from app.core.context import RequestContext
from app.core.security import create_access_token, decode_access_token, verify_password
from app.models import StaffUser
from app.models.base import utcnow
from app.schemas.api import LoginRequest, LoginResponse, Notifications, ProfileUpdate, StaffProfileOut, StaffUserOut
from app.services.audit import record

router = APIRouter(prefix="/v1", tags=["auth"])


def profile_out(u: StaffUser) -> StaffProfileOut:
    return StaffProfileOut(
        id=u.id,
        name=u.name,
        initials=u.initials,
        email=u.email,
        role=u.role,  # type: ignore[arg-type]
        specialty=u.specialty,
        display_name=u.display_name,
        avatar_url=u.avatar_url,
        team=u.team,
        languages=u.languages,
        skills=u.skills,
        shift=u.shift,
        timezone=u.timezone,
        max_concurrent_chats=u.max_concurrent_chats,
        availability=u.availability,  # type: ignore[arg-type]
        greeting=u.greeting,
        phone_extension=u.phone_extension,
        notifications=Notifications(**u.notifications),
        locale=u.locale,  # type: ignore[arg-type]
        theme=u.theme,  # type: ignore[arg-type]
        last_login=u.last_login_at.strftime("%Y-%m-%d %H:%M") if u.last_login_at else "",
    )


@router.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest, session: Session) -> LoginResponse:
    user = await session.scalar(select(StaffUser).where(func.lower(StaffUser.email) == body.email.strip().lower(), StaffUser.active))
    ok = verify_password(body.password, user.password_hash if user else None)
    if not user or not ok:
        if user:
            ctx = RequestContext(org_id=user.org_id, workspace_id=user.workspace_id, locale="es")
            await record(session, ctx, actor=user.name, actor_kind="human", action="Failed sign-in", target=user.id, outcome="denied")
            await session.commit()
        # One answer for unknown user and wrong password.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_credentials")

    token, expires = create_access_token(user.id, {"org": user.org_id, "ws": user.workspace_id, "role": user.role, "auth_time": int(utcnow().timestamp())})
    user.last_login_at = utcnow()
    ctx = RequestContext(org_id=user.org_id, workspace_id=user.workspace_id, locale="es")
    await record(session, ctx, actor=user.name, actor_kind="human", action="Signed in", target=user.id, outcome="allowed")
    await session.commit()
    return LoginResponse(
        user=StaffUserOut(id=user.id, name=user.name, initials=user.initials, email=user.email, role=user.role, specialty=user.specialty),  # type: ignore[arg-type]
        token=token,
        expires_at=expires.isoformat(),
    )


@router.post("/auth/refresh", response_model=LoginResponse)
async def refresh(ctx: Staff, session: Session, authorization: Annotated[str, Header()]) -> LoginResponse:
    """Renews a still-valid token; the sign-in time travels along so the absolute cap holds."""
    user = await _me(session, ctx)
    auth_time = int(decode_access_token(authorization.split(" ", 1)[1]).get("auth_time", 0))
    if utcnow().timestamp() - auth_time > get_settings().session_max_hours * 3600:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "session_expired")
    token, expires = create_access_token(user.id, {"org": user.org_id, "ws": user.workspace_id, "role": user.role, "auth_time": auth_time})
    return LoginResponse(
        user=StaffUserOut(id=user.id, name=user.name, initials=user.initials, email=user.email, role=user.role, specialty=user.specialty),  # type: ignore[arg-type]
        token=token,
        expires_at=expires.isoformat(),
    )


async def _me(session: Session, ctx: RequestContext) -> StaffUser:
    user = await session.scalar(select(StaffUser).where(StaffUser.id == ctx.user_id, StaffUser.workspace_id == ctx.workspace_id, StaffUser.active))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_token")
    return user


@router.get("/me/profile", response_model=StaffProfileOut)
async def get_profile(ctx: Staff, session: Session) -> StaffProfileOut:
    return profile_out(await _me(session, ctx))


@router.patch("/me/profile", response_model=StaffProfileOut)
async def update_profile(body: ProfileUpdate, ctx: Staff, session: Session) -> StaffProfileOut:
    user = await _me(session, ctx)
    data = body.model_dump(exclude_unset=True)
    if (
        "avatar_url" in data
        and data["avatar_url"]
        and not data["avatar_url"].startswith(("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,"))
    ):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_avatar")
    for field, value in data.items():
        if field == "avatar_url":
            value = value or None
        setattr(user, field, value)
    await record(
        session, ctx, actor=user.name, actor_kind="human", action="Updated own profile", target=user.id, outcome="allowed", data={"fields": sorted(data)}
    )
    await session.commit()
    return profile_out(user)
