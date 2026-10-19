"""增加用户指定主题的持久缓存。"""
import sqlalchemy as sa
from alembic import op

revision = "20261016_0017"
down_revision = "20260912_0016"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "luogu_themes",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("author_name", sa.String(100), nullable=False),
        sa.Column("config", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("job_token", sa.String(32), nullable=False),
        sa.Column("error", sa.String(200), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table("luogu_themes")
