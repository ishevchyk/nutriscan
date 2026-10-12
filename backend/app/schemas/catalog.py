import uuid
from typing import Literal

from pydantic import BaseModel

from app.schemas.product import ProductCreate
from app.schemas.product_portion import ProductPortionCreate

Completeness = Literal["complete", "partial", "no_nutrition"]


class DraftPortion(BaseModel):
    name: str
    grams: float
    is_default: bool = True


class AlreadyInLibrary(BaseModel):
    product_id: uuid.UUID
    deleted: bool


class CatalogProductDraft(BaseModel):
    """ProductCreate-shaped prefill built from an OFF product. Missing values
    are null (unknown), never 0."""

    name: str
    brand: str | None = None
    barcode: str
    calories: float | None = None
    protein: float | None = None
    carbs: float | None = None
    fat: float | None = None
    fiber: float | None = None
    sugar: float | None = None
    salt: float | None = None
    saturated_fat: float | None = None
    nutrients: dict[str, float] = {}
    notes: str | None = None
    portions: list[DraftPortion] = []
    suggested_group: str | None = None
    suggested_group_id: uuid.UUID | None = None
    completeness: Completeness
    image_url: str | None = None  # display only, never stored
    off_url: str
    already_in_library: AlreadyInLibrary | None = None


class CatalogHit(BaseModel):
    code: str
    name: str
    brand: str | None = None
    quantity: str | None = None
    image_url: str | None = None
    kcal_100g: float | None = None


class CatalogSearchOut(BaseModel):
    items: list[CatalogHit]
    page: int
    has_more: bool


class CatalogImportRequest(ProductCreate):
    """ProductCreate-shaped body (the user may have edited the draft) plus the
    barcode, portions and group ids to attach in the same transaction."""

    barcode: str
    portions: list[ProductPortionCreate] = []
    group_ids: list[uuid.UUID] = []
