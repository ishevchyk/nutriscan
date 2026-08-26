import uuid

from pydantic import BaseModel, field_validator


class ProductUnitConversionCreate(BaseModel):
    unit: str
    grams_per_unit: float

    @field_validator("unit")
    @classmethod
    def _normalize_unit(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("unit must not be empty")
        return v

    @field_validator("grams_per_unit")
    @classmethod
    def _validate_grams_per_unit(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("grams_per_unit must be greater than 0")
        return v


class ProductUnitConversionOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    unit: str
    grams_per_unit: float

    model_config = {"from_attributes": True}
