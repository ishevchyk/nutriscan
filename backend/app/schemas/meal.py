import uuid
from datetime import datetime

from pydantic import BaseModel, Field, computed_field, field_validator, model_validator

from app.sanitize import sanitize_rich_text
from app.schemas.meal_portion import MealPortionOut, _validate_positive_grams


class MealIngredientIn(BaseModel):
    """Two accepted shapes: {product_id, input_amount, input_unit} to link a saved
    product (its current name/brand/macros are copied into the snapshot
    server-side, so any snapshot fields sent here are ignored), or {name,
    input_amount, input_unit, ...macros} for a manual/unlinked ingredient with no
    product in the library. `grams` is normally derived server-side from
    input_amount/input_unit (see _resolve_ingredient_grams in the router) and
    should only be sent directly for an unlinked ingredient using a non-gram
    unit, where there's no product to key a saved conversion off of."""

    product_id: uuid.UUID | None = None
    input_amount: float
    input_unit: str = "g"
    grams: float | None = None
    name: str | None = None
    brand: str | None = None
    calories: float | None = None
    protein: float | None = None
    fat: float | None = None
    carbs: float | None = None
    fiber: float | None = None
    sugar: float | None = None
    salt: float | None = None

    @field_validator("input_amount")
    @classmethod
    def _validate_input_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("input_amount must be greater than 0")
        return v

    @field_validator("grams")
    @classmethod
    def _validate_grams(cls, v: float | None) -> float | None:
        return v if v is None else _validate_positive_grams(v)

    @model_validator(mode="after")
    def _require_name_when_unlinked(self):
        if self.product_id is None and not self.name:
            raise ValueError("name is required when product_id is not set")
        return self


class MealIngredientOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID | None
    name: str
    brand: str | None
    input_amount: float
    input_unit: str
    grams: float
    calories: float | None
    protein: float | None
    fat: float | None
    carbs: float | None
    fiber: float | None
    sugar: float | None
    salt: float | None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def is_linked(self) -> bool:
        return self.product_id is not None


class MealIngredientPatch(BaseModel):
    """For PATCH /meals/:id/ingredients/:ingredient_id. Every field is optional;
    presence in the request (via model_dump(exclude_unset=True) in the route), not
    value, drives relink/unlink/edit branching. `grams` stays directly editable
    for a manual snapshot tweak that leaves input_amount/input_unit alone;
    sending input_amount and/or input_unit instead re-derives grams server-side
    (see _resolve_ingredient_grams in the router)."""

    product_id: uuid.UUID | None = None
    input_amount: float | None = None
    input_unit: str | None = None
    grams: float | None = None
    name: str | None = None
    brand: str | None = None
    calories: float | None = None
    protein: float | None = None
    fat: float | None = None
    carbs: float | None = None
    fiber: float | None = None
    sugar: float | None = None
    salt: float | None = None

    @field_validator("input_amount")
    @classmethod
    def _validate_input_amount(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("input_amount must be greater than 0")
        return v

    @field_validator("grams")
    @classmethod
    def _validate_grams(cls, v: float | None) -> float | None:
        return v if v is None else _validate_positive_grams(v)


class MealCreate(BaseModel):
    name: str
    description: str | None = None
    photo_url: str | None = None
    servings: int = Field(default=1, ge=1)
    ingredients: list[MealIngredientIn] = []

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, v: str | None) -> str | None:
        return sanitize_rich_text(v)


class MealUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    photo_url: str | None = None
    servings: int | None = Field(default=None, ge=1)
    ingredients: list[MealIngredientIn] | None = None  # None = untouched; [] = clear all

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, v: str | None) -> str | None:
        return sanitize_rich_text(v)


class NutritionOut(BaseModel):
    calories: float
    protein: float
    fat: float
    carbs: float
    fiber: float
    sugar: float
    salt: float


class MealNutritionOut(BaseModel):
    per_meal: NutritionOut
    per_100g: NutritionOut


class MealListItemOut(BaseModel):
    id: uuid.UUID
    name: str
    photo_url: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class MealPortionDetailOut(MealPortionOut):
    nutrition: NutritionOut


class MealDetailOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    photo_url: str | None
    servings: int
    created_at: datetime
    updated_at: datetime
    ingredients: list[MealIngredientOut]
    nutrition: MealNutritionOut
    portions: list[MealPortionDetailOut]

    model_config = {"from_attributes": True}
