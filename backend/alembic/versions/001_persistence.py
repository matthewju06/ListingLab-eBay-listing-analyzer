"""create saved_searches and tracked_listings

Revision ID: 001_persistence
Revises:
Create Date: 2026-07-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_persistence"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_searches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("query", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=True),
        sa.Column("condition", sa.String(length=16), nullable=True),
        sa.Column("min_price", sa.String(length=32), nullable=True),
        sa.Column("max_price", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saved_searches_user_id", "saved_searches", ["user_id"])

    op.create_table(
        "tracked_listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("item_web_url", sa.String(length=1000), nullable=False),
        sa.Column("image_url", sa.String(length=1000), nullable=True),
        sa.Column("condition", sa.String(length=64), nullable=True),
        sa.Column("seller_username", sa.String(length=128), nullable=True),
        sa.Column("last_seen_price", sa.Float(), nullable=True),
        sa.Column("target_min_price", sa.Float(), nullable=True),
        sa.Column("target_max_price", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tracked_listings_user_id", "tracked_listings", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_tracked_listings_user_id", table_name="tracked_listings")
    op.drop_table("tracked_listings")
    op.drop_index("ix_saved_searches_user_id", table_name="saved_searches")
    op.drop_table("saved_searches")
