from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.user_goal import UserGoal
from app.schemas.goal import GoalOut, GoalUpdate

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=GoalOut)
async def get_goals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(UserGoal).where(UserGoal.user_id == current_user.id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No goals set yet")
    return goal


@router.patch("", response_model=GoalOut)
async def update_goals(
    body: GoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(UserGoal).where(UserGoal.user_id == current_user.id))
    goal = result.scalar_one_or_none()
    updates = body.model_dump(exclude_unset=True)

    if goal is None:
        goal = UserGoal(user_id=current_user.id, **body.model_dump())
        db.add(goal)
    else:
        for field, value in updates.items():
            setattr(goal, field, value)

    await db.commit()
    await db.refresh(goal)
    return goal
