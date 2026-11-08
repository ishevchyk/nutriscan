import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class AdminUserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    created_at: datetime
    disabled_at: datetime | None
    sign_in_methods: list[str]


class AdminUserList(BaseModel):
    items: list[AdminUserOut]
    total: int


class AdminUserUpdate(BaseModel):
    role: Literal["user", "admin"] | None = None
    disabled: bool | None = None


class AdminStats(BaseModel):
    users_total: int
    users_active: int
    users_disabled: int
    admins: int
    signups_last_7_days: int
    signups_last_30_days: int
    products_total: int
    meals_total: int
    log_entries_total: int
