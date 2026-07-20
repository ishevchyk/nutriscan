"""add product fields and refresh_tokens table

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("brand", sa.String(255), nullable=True))
    op.add_column("products", sa.Column("fiber", sa.Float(), nullable=True))
    op.add_column("products", sa.Column("sugar", sa.Float(), nullable=True))
    op.add_column("products", sa.Column("salt", sa.Float(), nullable=True))
    op.add_column(
        "products",
        sa.Column("source", sa.String(20), nullable=True, server_default=sa.text("'manual'")),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_column("products", "source")
    op.drop_column("products", "salt")
    op.drop_column("products", "sugar")
    op.drop_column("products", "fiber")
    op.drop_column("products", "brand")
