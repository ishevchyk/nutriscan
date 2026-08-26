import uuid

from sqlalchemy import ForeignKey, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProductUnitConversion(Base):
    __tablename__ = "product_unit_conversions"
    __table_args__ = (UniqueConstraint("product_id", "unit", name="ux_product_unit_conversions_product_id_unit"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    unit: Mapped[str] = mapped_column(Text, nullable=False)
    grams_per_unit: Mapped[float] = mapped_column(Numeric, nullable=False)
