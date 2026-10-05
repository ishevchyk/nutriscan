import uuid

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Nutrient(Base):
    """Seeded reference table (see app/nutrient_catalog.py). Not user-owned."""

    __tablename__ = "nutrients"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(10), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    parent_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    nrv: Mapped[float | None] = mapped_column(Float, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)


class ProductNutrient(Base):
    """One row per (product, extended nutrient); amount per 100 g in the
    nutrient's own unit. Hard-deleted with the product (ON DELETE CASCADE);
    a missing row means unknown, not zero."""

    __tablename__ = "product_nutrients"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    nutrient_code: Mapped[str] = mapped_column(String(50), ForeignKey("nutrients.code"), primary_key=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
