import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LogEntry(Base):
    """log_entries is hard-deleted, unlike products/meals (see backend/CLAUDE.md's
    explicit soft-delete exception list) -- there is no deleted_at column here.

    product_id/meal_id/portion_id are ondelete="SET NULL": products and meals
    are eventually hard-purged by the retention job and meal_portions is
    hard-deleted on demand, but a log entry survives all of those as a
    historical record -- for source_type='meal' its macros come from the
    log_entry_meal_ingredients snapshot, not a live reference, so losing the
    back-link doesn't affect already-logged totals.
    """

    __tablename__ = "log_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # No index=True here: the composite (user_id, logged_at) index created in
    # the migration already serves user_id-only lookups as a left prefix.
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    meal_slot: Mapped[str] = mapped_column(String(20), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    quantity_grams: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    meal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meals.id", ondelete="SET NULL"), nullable=True
    )
    portion_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meal_portions.id", ondelete="SET NULL"), nullable=True
    )
    manual_calories: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    manual_protein: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    manual_fat: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    manual_carbs: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
