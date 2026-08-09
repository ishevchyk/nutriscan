"""create groups and product_groups tables, seed system groups

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-08
"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SYSTEM_GROUPS = [
    "Dairy",
    "Fruits",
    "Vegetables",
    "Breakfast",
    "Snacks",
    "Meat & Fish",
    "Grains",
    "Beverages",
    "Sweets",
    "Condiments",
]


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_groups_user_id", "groups", ["user_id"])
    op.create_index(
        "ux_groups_user_id_lower_name",
        "groups",
        ["user_id", sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )

    op.create_table(
        "product_groups",
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("ix_product_groups_group_id", "product_groups", ["group_id"])

    conn = op.get_bind()
    for name in _SYSTEM_GROUPS:
        conn.execute(
            sa.text(
                """
                INSERT INTO groups (id, user_id, name, is_system, created_at)
                SELECT :id, NULL, CAST(:name AS TEXT), true, now()
                WHERE NOT EXISTS (
                    SELECT 1 FROM groups WHERE is_system = true AND lower(name) = lower(CAST(:name AS TEXT))
                )
                """
            ),
            {"id": str(uuid.uuid4()), "name": name},
        )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM groups WHERE is_system = true"))
    op.drop_index("ix_product_groups_group_id", table_name="product_groups")
    op.drop_table("product_groups")
    op.drop_index("ux_groups_user_id_lower_name", table_name="groups")
    op.drop_index("ix_groups_user_id", table_name="groups")
    op.drop_table("groups")
