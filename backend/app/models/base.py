from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, MetaData, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column

NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=utcnow)


class Tenant:
    """Every business row belongs to one workspace; queries always filter by it."""

    @declared_attr
    def org_id(cls) -> Mapped[str]:
        return mapped_column(String(32), ForeignKey("organizations.id"), index=True)

    @declared_attr
    def workspace_id(cls) -> Mapped[str]:
        return mapped_column(String(32), ForeignKey("workspaces.id"), index=True)
