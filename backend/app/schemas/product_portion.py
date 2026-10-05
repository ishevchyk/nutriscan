import uuid

from pydantic import BaseModel, field_validator

from app.schemas.meal_portion import _validate_positive_grams


class ProductPortionCreate(BaseModel):
    name: str
    grams: float
    is_default: bool = False

    @field_validator("grams")
    @classmethod
    def _validate_grams(cls, v: float) -> float:
        return _validate_positive_grams(v)


class ProductPortionUpdate(BaseModel):
    name: str | None = None
    grams: float | None = None
    is_default: bool | None = None

    @field_validator("grams")
    @classmethod
    def _validate_grams(cls, v: float | None) -> float | None:
        return v if v is None else _validate_positive_grams(v)


class ProductPortionOut(BaseModel):
    id: uuid.UUID
    name: str
    grams: float
    is_default: bool

    model_config = {"from_attributes": True}
