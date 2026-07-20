from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status")
async def ai_status(current_user: User = Depends(get_current_user)):
    # TODO: implement AI endpoints using Anthropic SDK
    return {"status": "ok"}
