import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.group import Group
from app.models.log_entry import LogEntry
from app.models.meal import Meal
from app.models.product import Product
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.user_goal import UserGoal
from app.models.user_profile import UserProfile
from app.models.user_settings import UserSettings
from app.schemas.user import (
    ChangePasswordRequest,
    RefreshRequest,
    TokenOut,
    UserCreate,
    UserLogin,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_ACCESS_TOKEN_EXPIRE_MINUTES = 15
_REFRESH_TOKEN_EXPIRE_DAYS = 30


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.secret_key, algorithm=settings.algorithm)


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def _create_refresh_token(user_id: uuid.UUID, db: AsyncSession) -> str:
    raw = str(uuid.uuid4())
    token = RefreshToken(
        user_id=user_id,
        token_hash=_hash_token(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(days=_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(token)
    await db.flush()
    return raw


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=body.email, password_hash=_hash_password(body.password))
    db.add(user)
    await db.flush()
    refresh_raw = await _create_refresh_token(user.id, db)
    await db.commit()
    return TokenOut(access_token=_create_access_token(str(user.id)), refresh_token=refresh_raw)


@router.post("/login", response_model=TokenOut)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    refresh_raw = await _create_refresh_token(user.id, db)
    await db.commit()
    return TokenOut(access_token=_create_access_token(str(user.id)), refresh_token=refresh_raw)


@router.post("/refresh", response_model=TokenOut)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = _hash_token(body.refresh_token)
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
    )
    stored = result.scalar_one_or_none()
    if not stored:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    stored.revoked_at = now
    new_refresh_raw = await _create_refresh_token(stored.user_id, db)
    await db.commit()
    return TokenOut(
        access_token=_create_access_token(str(stored.user_id)),
        refresh_token=new_refresh_raw,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = _hash_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    stored = result.scalar_one_or_none()
    if stored:
        stored.revoked_at = datetime.now(timezone.utc)
        await db.commit()


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    current_user.password_hash = _hash_password(body.new_password)
    await db.commit()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Scoped exception to the "soft deletes only" rule (see backend/CLAUDE.md)
    # -- an account deletion is a full purge, unlike the per-resource
    # DELETE /products/:id and DELETE /meals/:id endpoints, which stay
    # soft-delete. Deleted in dependency order: most user_id FKs in this
    # schema have no ON DELETE behavior (Postgres default RESTRICT), only
    # user_hidden_groups cascades from users. Deleting these parents lets
    # each table's own CASCADE/SET NULL FKs (meal_ingredients, meal_portions,
    # product_groups, product_unit_conversions, log_entry_meal_ingredients)
    # clean up their children automatically. Custom groups only -- system
    # groups (user_id is NULL) are shared across all users and must survive.
    uid = current_user.id
    await db.execute(delete(LogEntry).where(LogEntry.user_id == uid))
    await db.execute(delete(Meal).where(Meal.user_id == uid))
    await db.execute(delete(Product).where(Product.user_id == uid))
    await db.execute(delete(Group).where(Group.user_id == uid, Group.is_system.is_(False)))
    await db.execute(delete(UserGoal).where(UserGoal.user_id == uid))
    await db.execute(delete(UserSettings).where(UserSettings.user_id == uid))
    await db.execute(delete(UserProfile).where(UserProfile.user_id == uid))
    # Deleting every refresh token is the revoke step: a stored refresh
    # token 401s on POST /auth/refresh afterward, and the short-lived access
    # token stops resolving once get_current_user finds no User row.
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == uid))
    await db.execute(delete(User).where(User.id == uid))
    await db.commit()
