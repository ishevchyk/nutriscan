from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.profile import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


def _build_out(current_user: User, row: UserProfile | None) -> ProfileOut:
    if row is None:
        # Every field is optional (README: "All fields are optional") --
        # there's no meaningful "unset" state, so return an all-null object
        # instead of 404ing before the first PATCH, same as GET /settings.
        return ProfileOut(
            user_id=current_user.id,
            email=current_user.email,
            display_name=None,
            date_of_birth=None,
            sex=None,
            height_cm=None,
            weight_kg=None,
            activity_level=None,
            updated_at=None,
        )
    return ProfileOut(
        user_id=current_user.id,
        email=current_user.email,
        display_name=row.display_name,
        date_of_birth=row.date_of_birth,
        sex=row.sex,
        height_cm=row.height_cm,
        weight_kg=row.weight_kg,
        activity_level=row.activity_level,
        updated_at=row.updated_at,
    )


@router.get("", response_model=ProfileOut)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    return _build_out(current_user, result.scalar_one_or_none())


@router.patch("", response_model=ProfileOut)
async def update_profile(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    row = result.scalar_one_or_none()
    updates = body.model_dump(exclude_unset=True)

    if row is None:
        row = UserProfile(user_id=current_user.id, **updates)
        db.add(row)
    else:
        for field, value in updates.items():
            setattr(row, field, value)

    await db.commit()
    await db.refresh(row)
    return _build_out(current_user, row)
