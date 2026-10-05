import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MealIngredient(Base):
    """A meal ingredient either follows a product or keeps its own values.

    `uses_own_values = false` (a linked, unedited ingredient): name/brand and
    all nutrition are read from the product at calculation time (see
    app/meal_ingredients.py), so fixing a product fixes every meal using it.
    The value columns below are ignored in that state.

    `uses_own_values = true` (unlinked, or a linked ingredient the user edited):
    the value columns below are the source of truth. Relinking to the product
    switches back to following it.

    Before a followed product is hard-purged, app/jobs.py copies its values
    into the row and flips this to true, so a purge never zeroes a meal;
    `product_id` is then set to NULL (ondelete="SET NULL")."""

    __tablename__ = "meal_ingredients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(255), nullable=True)
    calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    protein: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat: Mapped[float | None] = mapped_column(Float, nullable=True)
    fiber: Mapped[float | None] = mapped_column(Float, nullable=True)
    sugar: Mapped[float | None] = mapped_column(Float, nullable=True)
    salt: Mapped[float | None] = mapped_column(Float, nullable=True)
    saturated_fat: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Extended nutrients {code: amount per 100 g}; see app/nutrient_catalog.py
    nutrients: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    uses_own_values: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    grams: Mapped[float] = mapped_column(Float, nullable=False)
    input_amount: Mapped[float] = mapped_column(Numeric, nullable=False)
    input_unit: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'g'"))
