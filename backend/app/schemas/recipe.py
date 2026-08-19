import uuid
from datetime import datetime

from pydantic import BaseModel, computed_field, field_validator, model_validator

from app.schemas.recipe_portion import RecipePortionOut, _validate_positive_grams


class RecipeIngredientIn(BaseModel):
    """Two accepted shapes: {product_id, grams} to link a saved product (its
    current name/brand/macros are copied into the snapshot server-side, so any
    snapshot fields sent here are ignored), or {name, grams, ...macros} for a
    manual/unlinked ingredient with no product in the library."""

    product_id: uuid.UUID | None = None
    grams: float
    name: str | None = None
    brand: str | None = None
    calories: float | None = None
    protein: float | None = None
    fat: float | None = None
    carbs: float | None = None
    fiber: float | None = None
    sugar: float | None = None
    salt: float | None = None

    @field_validator("grams")
    @classmethod
    def _validate_grams(cls, v: float) -> float:
        return _validate_positive_grams(v)

    @model_validator(mode="after")
    def _require_name_when_unlinked(self):
        if self.product_id is None and not self.name:
            raise ValueError("name is required when product_id is not set")
        return self


class RecipeIngredientOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID | None
    name: str
    brand: str | None
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


class RecipeIngredientPatch(BaseModel):
    """For PATCH /recipes/:id/ingredients/:ingredient_id. Every field is optional;
    presence in the request (via model_dump(exclude_unset=True) in the route), not
    value, drives relink/unlink/edit branching."""

    product_id: uuid.UUID | None = None
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

    @field_validator("grams")
    @classmethod
    def _validate_grams(cls, v: float | None) -> float | None:
        return v if v is None else _validate_positive_grams(v)


class RecipeCreate(BaseModel):
    name: str
    description: str | None = None
    photo_url: str | None = None
    ingredients: list[RecipeIngredientIn] = []


class RecipeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    photo_url: str | None = None
    ingredients: list[RecipeIngredientIn] | None = None  # None = untouched; [] = clear all


class NutritionOut(BaseModel):
    calories: float
    protein: float
    fat: float
    carbs: float
    fiber: float
    sugar: float
    salt: float


class RecipeNutritionOut(BaseModel):
    per_meal: NutritionOut
    per_100g: NutritionOut


class RecipeListItemOut(BaseModel):
    id: uuid.UUID
    name: str
    photo_url: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecipePortionDetailOut(RecipePortionOut):
    nutrition: NutritionOut


class RecipeDetailOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    photo_url: str | None
    created_at: datetime
    updated_at: datetime
    ingredients: list[RecipeIngredientOut]
    nutrition: RecipeNutritionOut
    portions: list[RecipePortionDetailOut]

    model_config = {"from_attributes": True}
