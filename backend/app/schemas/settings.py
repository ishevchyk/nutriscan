import uuid
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, field_validator

Units = Literal["metric", "imperial"]


def _validate_timezone(v: str) -> str:
    try:
        ZoneInfo(v)
    except ZoneInfoNotFoundError:
        raise ValueError(f"'{v}' is not a valid IANA timezone name")
    return v


class SettingsUpdate(BaseModel):
    """PATCH /settings body. All fields optional -- exclude_unset in the
    router drives partial-update semantics, mirroring PATCH /goals."""

    units: Units | None = None
    timezone: str | None = None
    notifications_enabled: bool | None = None

    @field_validator("timezone")
    @classmethod
    def _validate_timezone_field(cls, v: str | None) -> str | None:
        return _validate_timezone(v) if v is not None else v


class SettingsOut(BaseModel):
    user_id: uuid.UUID
    units: Units
    timezone: str
    notifications_enabled: bool
    updated_at: datetime | None

    model_config = {"from_attributes": True}
