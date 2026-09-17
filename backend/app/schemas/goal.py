import uuid
from datetime import datetime

from pydantic import BaseModel


class GoalUpdate(BaseModel):
    """PATCH /goals body. All fields optional -- exclude_unset in the router
    drives partial-update semantics on an existing row, and whatever is sent
    on the very first call becomes the initial row (unsent fields default to
    null, same as user_goals' nullable columns)."""

    calories_goal: float | None = None
    protein_goal: float | None = None
    fat_goal: float | None = None
    carbs_goal: float | None = None


class GoalOut(BaseModel):
    id: uuid.UUID
    calories_goal: float | None
    protein_goal: float | None
    fat_goal: float | None
    carbs_goal: float | None
    updated_at: datetime

    model_config = {"from_attributes": True}
