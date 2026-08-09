from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.group import Group
from app.models.product import Product
from app.models.product_group import ProductGroup
from app.models.user import User
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


async def _attach_groups(db: AsyncSession, products: list[Product]) -> None:
    """Batch-load groups for a list of products and attach them as `.groups`.

    Product<->Group has no ORM relationship (see app/models/product_group.py);
    this is queried explicitly here instead to avoid async lazy-loading.
    """
    if not products:
        return
    product_ids = [p.id for p in products]
    result = await db.execute(
        select(ProductGroup.product_id, Group)
        .join(Group, Group.id == ProductGroup.group_id)
        .where(ProductGroup.product_id.in_(product_ids))
    )
    by_product: dict[UUID, list[Group]] = {pid: [] for pid in product_ids}
    for product_id, group in result.all():
        by_product[product_id].append(group)
    for product in products:
        product.groups = by_product.get(product.id, [])


@router.get("", response_model=list[ProductOut])
async def list_products(
    group_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Product).where(Product.user_id == current_user.id, Product.deleted_at.is_(None))
    if group_id is not None:
        query = query.join(ProductGroup, ProductGroup.product_id == Product.id).where(
            ProductGroup.group_id == group_id
        )
    result = await db.execute(query)
    products = result.scalars().all()
    await _attach_groups(db, products)
    return products


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    body: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = Product(**body.model_dump(), user_id=current_user.id)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    await _attach_groups(db, [product])
    return product


@router.get("/deleted", response_model=list[ProductOut])
async def list_deleted_products(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Product).where(Product.user_id == current_user.id, Product.deleted_at.is_not(None))
    )
    products = result.scalars().all()
    await _attach_groups(db, products)
    return products


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Product).where(
            Product.id == product_id, Product.user_id == current_user.id, Product.deleted_at.is_(None)
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    await _attach_groups(db, [product])
    return product


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: UUID,
    body: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Product).where(
            Product.id == product_id, Product.user_id == current_user.id, Product.deleted_at.is_(None)
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    await _attach_groups(db, [product])
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Product).where(
            Product.id == product_id, Product.user_id == current_user.id, Product.deleted_at.is_(None)
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    product.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{product_id}/restore", response_model=ProductOut)
async def restore_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Product).where(
            Product.id == product_id, Product.user_id == current_user.id, Product.deleted_at.is_not(None)
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found in recently deleted")
    product.deleted_at = None
    await db.commit()
    await db.refresh(product)
    await _attach_groups(db, [product])
    return product
