import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserSettings(Base):
    """Keyed directly on user_id (no separate id column, README §6) -- every
    column has a DB default, so there's no meaningful "unset" state the way
    user_goals' nullable fields have. GET /settings relies on this: it
    returns defaults instead of 404 when no row exists yet."""

    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    units: Mapped[str] = mapped_column(Text, nullable=False, server_default="metric")
    timezone: Mapped[str] = mapped_column(Text, nullable=False, server_default="UTC")
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
