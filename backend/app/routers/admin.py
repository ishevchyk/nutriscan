from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts import purge_user
from app.dependencies import get_db, require_admin
from app.models.group import Group
from app.models.log_entry import LogEntry
from app.models.meal import Meal
from app.models.product import Product
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.admin import AdminStats, AdminUserList, AdminUserOut, AdminUserUpdate
from app.schemas.group import GroupCreate, GroupOut, GroupUpdate

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _user_out(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
        disabled_at=user.disabled_at,
        # Password is the only method until social sign-in (Phase 5b) lands.
        sign_in_methods=["password"],
    )


async def _system_group_name_taken(db: AsyncSession, name: str, exclude_id: UUID | None = None) -> bool:
    query = select(Group.id).where(Group.is_system.is_(True), func.lower(Group.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Group.id != exclude_id)
    return (await db.execute(query)).first() is not None


@router.post("/groups", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_system_group(body: GroupCreate, db: AsyncSession = Depends(get_db)):
    if await _system_group_name_taken(db, body.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Group name already exists")
    group = Group(name=body.name, user_id=None, is_system=True)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.patch("/groups/{group_id}", response_model=GroupOut)
async def rename_system_group(group_id: UUID, body: GroupUpdate, db: AsyncSession = Depends(get_db)):
    group = (
        await db.execute(select(Group).where(Group.id == group_id, Group.is_system.is_(True)))
    ).scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System group not found")
    if await _system_group_name_taken(db, body.name, exclude_id=group.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Group name already exists")
    group.name = body.name
    await db.commit()
    await db.refresh(group)
    return group


@router.get("/users", response_model=AdminUserList)
async def list_users(
    q: str | None = Query(None, max_length=255),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)
    if q:
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(User.email.ilike(f"%{escaped}%", escape="\\"))
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    users = (
        (await db.execute(query.order_by(User.created_at.desc(), User.id).limit(limit).offset(offset)))
        .scalars()
        .all()
    )
    return AdminUserList(items=[_user_out(u) for u in users], total=total)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_user(
    user_id: UUID,
    body: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    # Lock the admin rows so two concurrent demotions can't both pass the
    # last-admin check below.
    await db.execute(select(User.id).where(User.role == "admin").with_for_update())
    user = (await db.execute(select(User).where(User.id == user_id).with_for_update())).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_role = body.role if body.role is not None else user.role
    disabling = body.disabled is True and user.disabled_at is None
    demoting = user.role == "admin" and new_role != "admin"

    if user.id == current_admin.id and (demoting or disabling):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't demote or disable yourself")

    if user.role == "admin" and user.disabled_at is None and (demoting or disabling):
        active_admins = (
            await db.execute(
                select(func.count()).select_from(User).where(
                    User.role == "admin", User.disabled_at.is_(None), User.is_active.is_(True)
                )
            )
        ).scalar_one()
        if active_admins <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can't remove the last active admin")

    user.role = new_role
    if disabling:
        now = datetime.now(timezone.utc)
        user.disabled_at = now
        # Live access tokens are rejected by get_current_user; revoking refresh
        # tokens stops the session from being renewed.
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
    elif body.disabled is False:
        user.disabled_at = None
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = (await db.execute(select(User).where(User.id == user_id).with_for_update())).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delete your own account from Profile")
    # Demoting first keeps deletion from ever removing an admin by accident
    # and makes the last-admin guard in PATCH the single place that enforces it.
    if user.role == "admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Remove admin access before deleting")
    await purge_user(db, user.id)
    await db.commit()


@router.get("/stats", response_model=AdminStats)
async def get_stats(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)

    async def count(model, *where) -> int:
        return (await db.execute(select(func.count()).select_from(model).where(*where))).scalar_one()

    users_total = await count(User)
    disabled = await count(User, User.disabled_at.is_not(None))
    return AdminStats(
        users_total=users_total,
        users_active=users_total - disabled,
        users_disabled=disabled,
        admins=await count(User, User.role == "admin"),
        signups_last_7_days=await count(User, User.created_at >= now - timedelta(days=7)),
        signups_last_30_days=await count(User, User.created_at >= now - timedelta(days=30)),
        products_total=await count(Product, Product.deleted_at.is_(None)),
        meals_total=await count(Meal, Meal.deleted_at.is_(None)),
        log_entries_total=await count(LogEntry),
    )
