import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

Sex = Literal["male", "female", "other", "prefer_not_to_say"]
ActivityLevel = Literal["sedentary", "light", "moderate", "active", "very_active"]


class ProfileUpdate(BaseModel):
    """PATCH /profile body. All fields optional -- exclude_unset in the
    router drives partial-update semantics, mirroring PATCH /settings and
    PATCH /goals."""

    display_name: str | None = None
    date_of_birth: date | None = None
    sex: Sex | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    activity_level: ActivityLevel | None = None


class ProfileOut(BaseModel):
    # email comes from User, not UserProfile -- the router builds this by
    # hand rather than relying solely on from_attributes, same style GET
    # /settings already uses for its no-row fallback.
    user_id: uuid.UUID
    email: str
    display_name: str | None
    date_of_birth: date | None
    sex: Sex | None
    height_cm: float | None
    weight_kg: float | None
    activity_level: ActivityLevel | None
    updated_at: datetime | None
