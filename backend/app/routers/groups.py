from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.group import Group
from app.models.product import Product
from app.models.product_group import ProductGroup
from app.models.user import User
from app.models.user_hidden_group import UserHiddenGroup
from app.routers.products import _attach_groups
from app.schemas.group import GroupAssignRequest, GroupCreate, GroupOut, GroupUpdate

router = APIRouter(tags=["groups"])


@router.get("/groups", response_model=list[GroupOut])
async def list_groups(
    include_hidden: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Group).where(Group.is_system.is_(True) | (Group.user_id == current_user.id))
    if not include_hidden:
        hidden_result = await db.execute(
            select(UserHiddenGroup.group_id).where(UserHiddenGroup.user_id == current_user.id)
        )
        hidden_ids = {row[0] for row in hidden_result.all()}
        if hidden_ids:
            query = query.where(Group.id.notin_(hidden_ids))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/groups/hidden", response_model=list[UUID])
async def list_hidden_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserHiddenGroup.group_id).where(UserHiddenGroup.user_id == current_user.id)
    )
    return [row[0] for row in result.all()]


@router.post("/groups/{group_id}/hide", status_code=status.HTTP_204_NO_CONTENT)
async def hide_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if not group.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only system groups can be hidden")

    existing = await db.execute(
        select(UserHiddenGroup).where(
            UserHiddenGroup.user_id == current_user.id, UserHiddenGroup.group_id == group_id
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(UserHiddenGroup(user_id=current_user.id, group_id=group_id))
        await db.commit()


@router.delete("/groups/{group_id}/hide", status_code=status.HTTP_204_NO_CONTENT)
async def unhide_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        delete(UserHiddenGroup).where(
            UserHiddenGroup.user_id == current_user.id, UserHiddenGroup.group_id == group_id
        )
    )
    await db.commit()


@router.post("/groups", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(Group).where(
            Group.user_id == current_user.id,
            func.lower(Group.name) == body.name.lower(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Group name already exists")
    group = Group(name=body.name, user_id=current_user.id, is_system=False)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.patch("/groups/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: UUID,
    body: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group or (not group.is_system and group.user_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if group.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System groups cannot be renamed")

    dup = await db.execute(
        select(Group).where(
            Group.user_id == current_user.id,
            Group.id != group_id,
            func.lower(Group.name) == body.name.lower(),
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Group name already exists")

    group.name = body.name
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group or (not group.is_system and group.user_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if group.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System groups cannot be deleted")

    await db.delete(group)
    await db.commit()


@router.post("/products/{product_id}/groups", response_model=list[GroupOut])
async def assign_product_groups(
    product_id: UUID,
    body: GroupAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assign a product to one or more groups.

    Upsert semantics: groups the product is already assigned to are silently
    skipped, not an error. An empty `group_ids: []` is treated as a no-op
    (200 with the product's current group list unchanged) rather than a 400,
    for consistency with the "already-assigned is a no-op" rule above and so
    callers can invoke this uniformly even when nothing new was selected.
    """
    product_result = await db.execute(
        select(Product).where(
            Product.id == product_id, Product.user_id == current_user.id, Product.deleted_at.is_(None)
        )
    )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if not body.group_ids:
        await _attach_groups(db, [product])
        return product.groups

    unique_ids = set(body.group_ids)
    groups_result = await db.execute(
        select(Group).where(
            Group.id.in_(unique_ids),
            Group.is_system.is_(True) | (Group.user_id == current_user.id),
        )
    )
    valid_groups = groups_result.scalars().all()
    if len(valid_groups) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more group_ids are invalid")

    existing_result = await db.execute(
        select(ProductGroup.group_id).where(ProductGroup.product_id == product_id)
    )
    already_assigned = {row[0] for row in existing_result.all()}

    for group in valid_groups:
        if group.id not in already_assigned:
            db.add(ProductGroup(product_id=product_id, group_id=group.id))
    await db.commit()

    await _attach_groups(db, [product])
    return product.groups


@router.delete("/products/{product_id}/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_product_group(
    product_id: UUID,
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product_result = await db.execute(
        select(Product).where(
            Product.id == product_id, Product.user_id == current_user.id, Product.deleted_at.is_(None)
        )
    )
    if not product_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    await db.execute(
        delete(ProductGroup).where(
            ProductGroup.product_id == product_id, ProductGroup.group_id == group_id
        )
    )
    await db.commit()
