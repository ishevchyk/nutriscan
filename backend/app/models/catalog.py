from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CatalogProduct(Base):
    """Shared (not per-user) cache of Open Food Facts product lookups, keyed by
    the normalized barcode. found=False is a negative cache entry."""

    __tablename__ = "catalog_products"

    code: Mapped[str] = mapped_column(String(20), primary_key=True)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    found: Mapped[bool] = mapped_column(Boolean, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CatalogSearchCache(Base):
    """Shared cache of OFF search responses; key is a hash of query + langs + page."""

    __tablename__ = "catalog_search_cache"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
