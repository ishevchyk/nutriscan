import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.goal import GoalOut
from app.schemas.profile import ProfileOut
from app.schemas.settings import SettingsOut


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    is_active: bool
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)



class MeOut(BaseModel):
    user: UserOut
    profile: ProfileOut
    settings: SettingsOut
    goals: GoalOut | None
