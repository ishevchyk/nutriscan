import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.sanitize import sanitize_rich_text
from app.schemas.group import GroupOut


class ProductCreate(BaseModel):
    name: str
    brand: str | None = None
    barcode: str | None = None
    calories: float | None = None
    protein: float | None = None
    carbs: float | None = None
    fat: float | None = None
    fiber: float | None = None
    sugar: float | None = None
    salt: float | None = None
    serving_size: float | None = None
    serving_unit: str | None = None
    notes: str | None = None
    source: str | None = None

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, v: str | None) -> str | None:
        return sanitize_rich_text(v)


class ProductUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    barcode: str | None = None
    calories: float | None = None
    protein: float | None = None
    carbs: float | None = None
    fat: float | None = None
    fiber: float | None = None
    sugar: float | None = None
    salt: float | None = None
    serving_size: float | None = None
    serving_unit: str | None = None
    notes: str | None = None
    source: str | None = None
    # Not nullable in the DB -- an explicit null is rejected rather than
    # silently ignored (see the validator below).
    is_favorite: bool | None = None

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, v: str | None) -> str | None:
        return sanitize_rich_text(v)

    @field_validator("is_favorite")
    @classmethod
    def is_favorite_not_null(cls, v: bool | None) -> bool | None:
        if v is None:
            raise ValueError("is_favorite cannot be null")
        return v


class ProductOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    brand: str | None
    barcode: str | None
    calories: float | None
    protein: float | None
    carbs: float | None
    fat: float | None
    fiber: float | None
    sugar: float | None
    salt: float | None
    serving_size: float | None
    serving_unit: str | None
    notes: str | None
    source: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    is_favorite: bool = False
    groups: list[GroupOut] = []
    # Derived from the user's log, not stored on the row -- see
    # app/routers/products.py's _attach_log_stats. Counts log entries that
    # reference the product directly (source_type='product') or as an
    # ingredient of a logged meal.
    last_logged_at: datetime | None = None
    log_count: int = 0

    model_config = {"from_attributes": True}
