from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.settings import SettingsOut, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    row = result.scalar_one_or_none()
    if row is None:
        # Every column has a DB default (README §6) -- there's no meaningful
        # "unset" state, so return the defaults instead of 404ing before the
        # first PATCH, unlike GET /goals.
        return SettingsOut(
            user_id=current_user.id,
            units="metric",
            timezone="UTC",
            notifications_enabled=True,
            updated_at=None,
        )
    return row


@router.patch("", response_model=SettingsOut)
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    row = result.scalar_one_or_none()
    updates = body.model_dump(exclude_unset=True)

    if row is None:
        row = UserSettings(user_id=current_user.id, **updates)
        db.add(row)
    else:
        for field, value in updates.items():
            setattr(row, field, value)

    await db.commit()
    await db.refresh(row)
    return row
