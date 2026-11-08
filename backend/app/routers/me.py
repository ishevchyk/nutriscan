from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.user_goal import UserGoal
from app.models.user_profile import UserProfile
from app.models.user_settings import UserSettings
from app.routers.profile import _build_out as build_profile_out
from app.routers.settings import _build_out as build_settings_out
from app.schemas.goal import GoalOut
from app.schemas.profile import ProfileOut
from app.schemas.settings import SettingsOut
from app.schemas.user import MeOut, UserOut

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeOut)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))).scalar_one_or_none()
    settings_row = (
        await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    ).scalar_one_or_none()
    goals = (await db.execute(select(UserGoal).where(UserGoal.user_id == current_user.id))).scalar_one_or_none()
    return MeOut(
        user=UserOut.model_validate(current_user),
        profile=ProfileOut.model_validate(build_profile_out(current_user, profile)),
        settings=SettingsOut.model_validate(build_settings_out(current_user, settings_row), from_attributes=True),
        goals=GoalOut.model_validate(goals) if goals else None,
    )
