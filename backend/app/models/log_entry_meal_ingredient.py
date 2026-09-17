import uuid

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LogEntryMealIngredient(Base):
    """A snapshot taken once at log time, only populated when
    log_entries.source_type = 'meal' -- editing grams here (e.g. an
    ingredient override) never touches the meal's own meal_ingredients
    (README §6). product_id is ondelete="SET NULL" for the same eventual-purge
    reason as log_entries.product_id; the macro calc treats a null product_id
    as contributing zero macros.
    """

    __tablename__ = "log_entry_meal_ingredients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    log_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("log_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    grams: Mapped[float] = mapped_column(Numeric, nullable=False)
