import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserGoal(Base):
    """Single active row per user -- no history table (README §6, Open
    Question #7 still pending on versioning it). PATCH /goals overwrites
    this row rather than creating a new one. The unique constraint both
    enforces that and gives PATCH /goals a race-safe upsert target."""

    __tablename__ = "user_goals"
    __table_args__ = (UniqueConstraint("user_id", name="ux_user_goals_user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    calories_goal: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    protein_goal: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    fat_goal: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    carbs_goal: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
