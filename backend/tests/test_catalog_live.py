"""Opt-in smoke test against OFF staging: `pytest -m live_off`. Never runs in CI."""
import pytest

from app.catalog.mapping import map_product
from app.nutrient_catalog import NUTRIENT_SEED
from app.catalog.off_client import OffClient
from app.config import settings

pytestmark = [pytest.mark.live_off, pytest.mark.asyncio(loop_scope="session")]


async def test_live_staging_nutella():
    client = OffClient(cfg=settings.model_copy(update={"off_use_staging": True, "off_enabled": True}))
    try:
        raw = await client.fetch_product("3017620422003")
    finally:
        await client.aclose()
    assert raw is not None
    draft = map_product(raw, {row[0]: row[2] for row in NUTRIENT_SEED})
    assert draft.name and draft.calories is not None
