import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.barcodes import gtin_check_digit_ok, is_valid_barcode, normalize_barcode
from app.catalog.errors import CatalogError, api_error, unavailable
from app.catalog.mapping import map_hit, map_product
from app.catalog.off_client import OffClient, get_off_client
from app.catalog.rate_limit import UserLimiter
from app.catalog.service import lookup_product, search_products
from app.dependencies import get_current_user, get_db
from app.models.group import Group
from app.models.nutrient import Nutrient
from app.models.product import Product
from app.models.product_group import ProductGroup
from app.models.product_portion import ProductPortion
from app.models.user import User
from app.routers.products import _apply_nutrients, _hydrate
from app.schemas.catalog import (
    AlreadyInLibrary,
    CatalogImportRequest,
    CatalogProductDraft,
    CatalogSearchOut,
)
from app.schemas.product import ProductOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/catalog", tags=["catalog"])

# One user must not drain the shared OFF budget (per-process, like the OFF limiter).
user_limiter = UserLimiter(per_minute=20)
MIN_QUERY_LENGTH = 3
MAX_QUERY_LENGTH = 100
MAX_PAGE = 50


def _limit_per_user(current_user: User = Depends(get_current_user)) -> User:
    wait = user_limiter.check(current_user.id)
    if wait is not None:
        raise api_error(status.HTTP_429_TOO_MANY_REQUESTS, "rate_limited", retry_after=wait)
    return current_user


def _stripped(code: str) -> str:
    return code.lstrip("0")


async def _find_in_library(db: AsyncSession, user: User, code: str) -> AlreadyInLibrary | None:
    """The user's product with this barcode, matched ignoring leading zeros so
    rows saved before barcode normalization still count. Live rows win over
    soft-deleted ones."""
    rows = (
        await db.execute(
            select(Product.id, Product.deleted_at)
            .where(Product.user_id == user.id, func.ltrim(Product.barcode, "0") == _stripped(code))
            .order_by(Product.deleted_at.is_(None).desc(), Product.created_at.desc())
        )
    ).all()
    if not rows:
        return None
    product_id, deleted_at = rows[0]
    return AlreadyInLibrary(product_id=product_id, deleted=deleted_at is not None)


@router.get("/barcode/{code}", response_model=CatalogProductDraft)
async def lookup_barcode(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_limit_per_user),
    client: OffClient = Depends(get_off_client),
):
    normalized = normalize_barcode(code)
    if not normalized or not is_valid_barcode(normalized):
        raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_barcode")
    if not gtin_check_digit_ok(normalized):
        logger.warning("Barcode %s has an invalid GTIN check digit; looking it up anyway", normalized)
    try:
        raw = await lookup_product(db, client, normalized)
    except CatalogError as exc:
        raise unavailable(exc)
    if raw is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "catalog_not_found")

    units = {row.code: row.unit for row in (await db.execute(select(Nutrient.code, Nutrient.unit))).all()}
    group_ids = {
        row.name: row.id for row in (await db.execute(select(Group.id, Group.name).where(Group.is_system.is_(True)))).all()
    }
    draft = map_product(raw, units, group_ids, code=normalized)
    draft.already_in_library = await _find_in_library(db, current_user, normalized)
    return draft


@router.get("/search", response_model=CatalogSearchOut)
async def search_catalog(
    q: str = "",
    page: int = 1,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_limit_per_user),
    client: OffClient = Depends(get_off_client),
):
    q = " ".join(q.split())
    if len(q) < MIN_QUERY_LENGTH or len(q) > MAX_QUERY_LENGTH:
        raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_query", min_length=MIN_QUERY_LENGTH)
    if page < 1 or page > MAX_PAGE:
        raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_page")
    try:
        result = await search_products(db, client, q, page)
    except CatalogError as exc:
        raise unavailable(exc)
    items, seen = [], set()
    for raw in result["hits"]:
        hit = map_hit(raw)
        if hit is not None and hit.code not in seen:
            seen.add(hit.code)
            items.append(hit)
    return CatalogSearchOut(items=items, page=result["page"], has_more=result["has_more"])


@router.post("/import", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def import_product(
    body: CatalogImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Copy a (possibly edited) catalog draft into the user's library: product,
    portions, extended nutrients and group assignment in one transaction."""
    if not is_valid_barcode(body.barcode):
        raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_barcode")
    existing = await _find_in_library(db, current_user, body.barcode)
    if existing is not None and not existing.deleted:
        raise api_error(status.HTTP_409_CONFLICT, "already_in_library", product_id=str(existing.product_id))

    data = body.model_dump(exclude={"nutrients", "portions", "group_ids", "source"})
    product = Product(**data, source="catalog", user_id=current_user.id)
    db.add(product)
    await db.flush()
    await _apply_nutrients(db, product.id, body.nutrients or {})

    default_taken = False
    for portion in body.portions:
        is_default = portion.is_default and not default_taken  # partial unique index: one default
        default_taken = default_taken or is_default
        db.add(ProductPortion(product_id=product.id, name=portion.name[:100], grams=portion.grams, is_default=is_default))

    group_ids = set(body.group_ids)
    if group_ids:
        valid = (
            await db.execute(
                select(Group.id).where(Group.id.in_(group_ids), Group.is_system.is_(True) | (Group.user_id == current_user.id))
            )
        ).scalars().all()
        if len(valid) != len(group_ids):
            raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_group_ids")
        for group_id in valid:
            db.add(ProductGroup(product_id=product.id, group_id=group_id))

    await db.commit()
    await db.refresh(product)
    await _hydrate(db, [product])
    return product
