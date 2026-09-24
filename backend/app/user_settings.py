from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_settings import UserSettings

UTC = ZoneInfo("UTC")


async def get_user_timezone(db: AsyncSession, user_id: UUID) -> ZoneInfo:
    """Looks up user_settings.timezone, defaulting to UTC if no row exists
    yet -- mirrors GET /settings' own default-when-absent behavior (README §6,
    "settings" and the Phase 5 note on /log's day boundaries)."""
    result = await db.execute(select(UserSettings.timezone).where(UserSettings.user_id == user_id))
    tz_name = result.scalar_one_or_none()
    if tz_name is None:
        return UTC
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        return UTC
