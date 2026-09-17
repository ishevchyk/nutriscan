import uuid
from datetime import date, datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field, field_validator

MealSlot = Literal["breakfast", "lunch", "dinner", "snack"]

MEAL_SLOTS: tuple[MealSlot, ...] = ("breakfast", "lunch", "dinner", "snack")


class IngredientOverride(BaseModel):
    product_id: uuid.UUID
    grams: float

    @field_validator("grams")
    @classmethod
    def _validate_grams(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("grams must be greater than 0")
        return v


class LogEntryProductCreate(BaseModel):
    """extra='forbid' rejects a request that mixes in meal/manual-only fields
    (e.g. manual_calories on a source_type='product' body) with a 422,
    per CLAUDE.md's "reject mixed/incomplete payloads" instruction."""

    model_config = {"extra": "forbid"}

    source_type: Literal["product"]
    product_id: uuid.UUID
    quantity_grams: float
    meal_slot: MealSlot
    logged_at: datetime

    @field_validator("quantity_grams")
    @classmethod
    def _validate_quantity_grams(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity_grams must be greater than 0")
        return v


class LogEntryMealCreate(BaseModel):
    model_config = {"extra": "forbid"}

    source_type: Literal["meal"]
    meal_id: uuid.UUID
    portion_id: uuid.UUID | None = None
    ingredient_overrides: list[IngredientOverride] | None = None
    meal_slot: MealSlot
    logged_at: datetime
    # The weight of the dish actually logged (in cooked-weight terms when the
    # meal has a cooked_weight_grams) -- distinct from meal_ingredients' grams,
    # which are a raw-ingredient-equivalent used only to compute macros. When
    # omitted, the router derives it (portion.grams for a portion, otherwise
    # the meal's reference weight) -- see log.py::_build_meal_snapshot.
    quantity_grams: float | None = None

    @field_validator("quantity_grams")
    @classmethod
    def _validate_quantity_grams(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("quantity_grams must be greater than 0")
        return v


class LogEntryManualCreate(BaseModel):
    model_config = {"extra": "forbid"}

    source_type: Literal["manual"]
    manual_calories: float
    manual_protein: float
    manual_fat: float
    manual_carbs: float
    meal_slot: MealSlot
    logged_at: datetime


LogEntryCreate = Annotated[
    Union[LogEntryProductCreate, LogEntryMealCreate, LogEntryManualCreate],
    Field(discriminator="source_type"),
]


class LogEntryUpdate(BaseModel):
    """PATCH /log/:id body. source_type is intentionally not editable (README
    §6/§7). The router validates that only the field(s) matching the entry's
    existing source_type are present -- e.g. ingredient_overrides on a
    'product' entry is a 422, not silently ignored."""

    model_config = {"extra": "forbid"}

    quantity_grams: float | None = None
    manual_calories: float | None = None
    manual_protein: float | None = None
    manual_fat: float | None = None
    manual_carbs: float | None = None
    ingredient_overrides: list[IngredientOverride] | None = None

    @field_validator("quantity_grams")
    @classmethod
    def _validate_quantity_grams(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("quantity_grams must be greater than 0")
        return v


class LogMacrosOut(BaseModel):
    calories: float
    protein: float
    fat: float
    carbs: float


class LogEntryMealIngredientOut(BaseModel):
    product_id: uuid.UUID | None
    grams: float

    model_config = {"from_attributes": True}


class LogEntryOut(BaseModel):
    id: uuid.UUID
    logged_at: datetime
    meal_slot: str
    source_type: str
    product_id: uuid.UUID | None
    quantity_grams: float | None
    meal_id: uuid.UUID | None
    portion_id: uuid.UUID | None
    manual_calories: float | None
    manual_protein: float | None
    manual_fat: float | None
    manual_carbs: float | None
    created_at: datetime
    macros: LogMacrosOut
    meal_ingredients: list[LogEntryMealIngredientOut] | None = None

    model_config = {"from_attributes": True}


class LoggedDaysOut(BaseModel):
    """Which days of a given month have at least one log entry, for the
    tracker calendar view -- days not in this list still navigate normally,
    they just render lighter/unhighlighted on the client, rather than the
    client fetching a full day of entries just to check for emptiness."""

    days: list[int]


class LogSummaryOut(BaseModel):
    """`totals` and `goals` deliberately share the same key shape (calories/
    protein/fat/carbs) so the frontend can pair them up directly for progress
    bars (e.g. totals.calories / goals.calories) without a remapping step.
    `goals` is null when the user hasn't called PATCH /goals yet."""

    date: date
    totals: LogMacrosOut
    goals: LogMacrosOut | None
