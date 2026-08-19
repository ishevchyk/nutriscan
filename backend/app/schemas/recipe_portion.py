import uuid

from pydantic import BaseModel, field_validator


def _validate_positive_grams(v: float) -> float:
    if v <= 0:
        raise ValueError("grams must be greater than 0")
    return v


class RecipePortionCreate(BaseModel):
    name: str
    grams: float
    is_default: bool = False

    @field_validator("grams")
    @classmethod
    def _validate_grams(cls, v: float) -> float:
        return _validate_positive_grams(v)


class RecipePortionUpdate(BaseModel):
    name: str | None = None
    grams: float | None = None
    is_default: bool | None = None

    @field_validator("grams")
    @classmethod
    def _validate_grams(cls, v: float | None) -> float | None:
        return v if v is None else _validate_positive_grams(v)


class RecipePortionOut(BaseModel):
    id: uuid.UUID
    name: str
    grams: float
    is_default: bool

    model_config = {"from_attributes": True}
