from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("")
async def list_recipes(current_user: User = Depends(get_current_user)):
    # TODO: implement
    return []
