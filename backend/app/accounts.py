import uuid

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group
from app.models.log_entry import LogEntry
from app.models.meal import Meal
from app.models.product import Product
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.user_goal import UserGoal
from app.models.user_profile import UserProfile
from app.models.user_settings import UserSettings


async def purge_user(db: AsyncSession, uid: uuid.UUID) -> None:
    """Hard-delete a user and all their data. Does not commit.

    Scoped exception to the "soft deletes only" rule (see backend/CLAUDE.md)
    -- an account deletion is a full purge, unlike the per-resource
    DELETE /products/:id and DELETE /meals/:id endpoints, which stay
    soft-delete. Deleted in dependency order: most user_id FKs in this
    schema have no ON DELETE behavior (Postgres default RESTRICT), only
    user_hidden_groups cascades from users. Deleting these parents lets
    each table's own CASCADE/SET NULL FKs (meal_ingredients, meal_portions,
    product_groups, product_unit_conversions, log_entry_meal_ingredients)
    clean up their children automatically. Custom groups only -- system
    groups (user_id is NULL) are shared across all users and must survive.
    """
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
