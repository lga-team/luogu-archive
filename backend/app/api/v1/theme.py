"""主题导入只接受指定 ID；读取缓存不会触发洛谷请求。"""
from datetime import timezone
from uuid import uuid4

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from sqlalchemy.dialects.mysql import insert

from app.api.deps import get_client_ip
from app.core.db import db_session
from app.core.exceptions import NotFoundError, RateLimitError
from app.core.ratelimit import SlidingWindowLimiter, ratelimit_key
from app.core.redis_client import get_redis
from app.models._common import utcnow
from app.models.theme import LuoguTheme

router = APIRouter(prefix="/themes", tags=["themes"])


class ImportTheme(BaseModel):
    id: int = Field(gt=0, le=2**53 - 1)
    refresh: bool = False


def serialize(row):
    requested = row.requested_at.replace(tzinfo=timezone.utc)
    expired = row.status == "pending" and (utcnow() - requested).total_seconds() > 900
    return {"id": row.id, "name": row.name, "author_name": row.author_name,
            "config": row.config, "status": "error" if expired else row.status,
            "error": "等待超时，请重试导入" if expired else row.error,
            "fetched_at": row.fetched_at}


async def limit(request, count):
    allowed, _ = await SlidingWindowLimiter(get_redis()).acquire(
        ratelimit_key(f"theme_{count}", get_client_ip(request)), window_sec=60, limit=count)
    if not allowed:
        raise RateLimitError("主题请求过于频繁，请稍后再试", retry_after_sec=60)


@router.get("/{theme_id}")
async def get_theme(theme_id: int, request: Request):
    await limit(request, 120)
    async with db_session() as session:
        row = await session.get(LuoguTheme, theme_id)
        if row is None:
            raise NotFoundError("主题尚未导入")
        return serialize(row)


@router.post("/import")
async def import_theme(body: ImportTheme, request: Request):
    await limit(request, 20)
    # 行锁使同一 ID 的首次导入、强制刷新合并为一个任务。
    token = uuid4().hex
    async with db_session() as session:
        await session.execute(insert(LuoguTheme).values(
            id=body.id, name="", author_name="", status="error", job_token=token,
            requested_at=utcnow()).on_duplicate_key_update(id=body.id))
        row = await session.get(LuoguTheme, body.id, with_for_update=True, populate_existing=True)
        current = serialize(row)
        if current["status"] == "pending" or (row.config is not None and not body.refresh and row.status == "ready"):
            await session.commit()
            return current
        row.status, row.error, row.job_token, row.requested_at = "pending", None, token, utcnow()
        await session.commit()
        try:
            from app.tasks.actors.crawl import crawl_theme
            # worker 在获取行锁前等待提交；不把账号或 Cookie 放进消息。
            crawl_theme.send(body.id, token)
        except Exception:
            row = await session.get(LuoguTheme, body.id, with_for_update=True, populate_existing=True)
            if row.job_token == token:
                row.status, row.error = "error", "任务派发失败，请重试"
                await session.commit()
            raise
        return serialize(row)
