from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.nutrient import Nutrient
from app.models.user import User
from app.schemas.nutrient import NutrientOut

router = APIRouter(prefix="/nutrients", tags=["nutrients"])


@router.get("", response_model=list[NutrientOut])
async def list_nutrients(
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Seeded reference table (labels, units, NRVs) so clients can render
    extended nutrients. Static data, so safe to cache."""
    response.headers["Cache-Control"] = "private, max-age=86400"
    result = await db.execute(select(Nutrient).order_by(Nutrient.sort_order))
    return result.scalars().all()
