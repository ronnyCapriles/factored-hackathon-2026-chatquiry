from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Tenant, Timestamps


class Organization(Base, Timestamps):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))


class Workspace(Base, Timestamps):
    __tablename__ = "workspaces"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(32), ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))


class StaffUser(Base, Tenant, Timestamps):
    __tablename__ = "staff_users"
    __table_args__ = (UniqueConstraint("org_id", "email"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    email: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(120))
    display_name: Mapped[str] = mapped_column(String(40))
    initials: Mapped[str] = mapped_column(String(4))
    team: Mapped[str] = mapped_column(String(120))
    specialty: Mapped[str | None] = mapped_column(String(60))
    languages: Mapped[list[str]] = mapped_column(JSON, default=list)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    shift: Mapped[str] = mapped_column(String(60), default="")
    timezone: Mapped[str] = mapped_column(String(60), default="America/Bogota")
    max_concurrent_chats: Mapped[int] = mapped_column(Integer, default=0)
    availability: Mapped[str] = mapped_column(String(16), default="available")
    greeting: Mapped[str] = mapped_column(String(280), default="")
    phone_extension: Mapped[str] = mapped_column(String(10), default="")
    notifications: Mapped[dict] = mapped_column(JSON, default=dict)
    locale: Mapped[str] = mapped_column(String(2), default="es")
    theme: Mapped[str] = mapped_column(String(8), default="system")
    avatar_url: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ApiKey(Base, Tenant, Timestamps):
    __tablename__ = "api_keys"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    prefix: Mapped[str] = mapped_column(String(40), unique=True)
    key_hash: Mapped[str] = mapped_column(String(64))
    environment: Mapped[str] = mapped_column(String(8))
    scopes: Mapped[list[str]] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
