"""保存文章与剪贴板的源站发布时间。"""
import sqlalchemy as sa
from alembic import op

revision = "20261016_0018"
down_revision = "20261016_0017"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("articles", sa.Column("source_time", sa.DateTime(timezone=True), nullable=True))
    op.add_column("pastes", sa.Column("source_time", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("pastes", "source_time")
    op.drop_column("articles", "source_time")
