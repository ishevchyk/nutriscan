import uuid
from datetime import datetime

from pydantic import BaseModel


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

    model_config = {"from_attributes": True}
