"""create user_profiles table, add theme to user_settings

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-02
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_profiles is keyed directly on user_id (no separate id column),
    # same singleton-per-user pattern as user_settings. Unlike user_settings,
    # every field here is genuinely optional ("All fields are optional" per
    # the Edit Profile screen) -- no server defaults, nullable throughout.
    op.create_table(
        "user_profiles",
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True
        ),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("sex", sa.Text(), nullable=True),
        sa.Column("height_cm", sa.Numeric(), nullable=True),
        sa.Column("weight_kg", sa.Numeric(), nullable=True),
        sa.Column("activity_level", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )

    # Nullable with no server default, unlike user_settings' other columns:
    # None means "no override -- follow the device's own light/dark setting"
    # and must stay distinct from an explicit 'light'. Collapsing the two
    # into a non-nullable column would make "never chosen a theme" and
    # "chose light mode" indistinguishable, and the device default would be
    # unrecoverable once a value is written.
    op.add_column("user_settings", sa.Column("theme", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_settings", "theme")
    op.drop_table("user_profiles")
