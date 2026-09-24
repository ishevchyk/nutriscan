"""create user_settings, user_hidden_groups tables

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_settings is keyed directly on user_id (no separate id column) --
    # every column has a DB default, so there's no meaningful "unset" state
    # to model, unlike user_goals' nullable fields.
    op.create_table(
        "user_settings",
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True
        ),
        sa.Column("units", sa.Text(), nullable=False, server_default="metric"),
        sa.Column("timezone", sa.Text(), nullable=False, server_default="UTC"),
        sa.Column(
            "notifications_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )

    # user_hidden_groups only ever references system groups (is_system = true,
    # enforced at the router level, not by a DB constraint) -- lets a user hide
    # a system group from their own view without touching the group itself.
    # ondelete="CASCADE" on both FKs: hiding is per-user metadata with no
    # recovery need, unlike products/meals' soft-delete + 30-day window.
    op.create_table(
        "user_hidden_groups",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("ix_user_hidden_groups_group_id", "user_hidden_groups", ["group_id"])


def downgrade() -> None:
    op.drop_index("ix_user_hidden_groups_group_id", table_name="user_hidden_groups")
    op.drop_table("user_hidden_groups")
    op.drop_table("user_settings")
