import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


def _validate_name(v: str) -> str:
    v = v.strip()
    if not (1 <= len(v) <= 50):
        raise ValueError("name must be between 1 and 50 characters")
    return v


class GroupCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _validate_name_field(cls, v: str) -> str:
        return _validate_name(v)


class GroupUpdate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _validate_name_field(cls, v: str) -> str:
        return _validate_name(v)


class GroupOut(BaseModel):
    id: uuid.UUID
    name: str
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class GroupAssignRequest(BaseModel):
    group_ids: list[uuid.UUID]
