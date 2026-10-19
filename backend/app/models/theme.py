"""用户明确指定的洛谷主题缓存，不参与定时发现或刷新。"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models._common import utcnow


class LuoguTheme(Base):
    __tablename__ = "luogu_themes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    author_name: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    job_token: Mapped[str] = mapped_column(String(32), nullable=False)
    error: Mapped[str | None] = mapped_column(String(200), nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
