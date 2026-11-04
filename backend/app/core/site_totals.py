"""Approximate live counters, reconciled against MySQL every hour."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import db_session
from app.core.locks import DistributedLock
from app.core.logging import get_logger
from app.core.redis_client import get_redis
from app.models.luogu_content import Article, Feed, Judgement, Paste
from app.models.task import CrawlTask

log = get_logger(__name__)
TOTALS_KEY = "site:totals:v1"
_MODELS = {
    "crawl_tasks": CrawlTask,
    "articles": Article,
    "pastes": Paste,
    "feeds": Feed,
    "judgements": Judgement,
}

_INCREMENT = """
for i = 1, #ARGV, 2 do
    if redis.call('HEXISTS', KEYS[1], ARGV[i]) == 0 then return 0 end
end
for i = 1, #ARGV, 2 do
    local value = redis.call('HINCRBY', KEYS[1], ARGV[i], ARGV[i + 1])
    if value < 0 then redis.call('HSET', KEYS[1], ARGV[i], 0) end
end
return 1
"""


async def _database_totals(session: AsyncSession) -> dict[str, int]:
    return {
        name: int(await session.scalar(select(func.count()).select_from(model)) or 0)
        for name, model in _MODELS.items()
    }


async def _cached_totals() -> dict[str, int] | None:
    values = await get_redis().hmget(TOTALS_KEY, list(_MODELS))
    if any(value is None for value in values):
        return None
    return {name: int(value) for name, value in zip(_MODELS, values)}


async def refresh_site_totals(*, force: bool = True) -> dict[str, int] | None:
    """Overwrite all counters atomically; small concurrent-write drift is acceptable."""
    try:
        redis = get_redis()
        async with DistributedLock(redis).guard(
            "lk:site_totals:refresh", ttl_sec=120, wait_sec=5
        ) as acquired:
            if not acquired:
                return await _cached_totals()
            if not force:
                cached = await _cached_totals()
                if cached is not None:
                    return cached
            async with db_session() as session:
                totals = await _database_totals(session)
            await redis.hset(TOTALS_KEY, mapping=totals)
            return totals
    except Exception:
        log.warning("site_totals_refresh_failed", exc_info=True)
        return None


async def get_site_totals(session: AsyncSession) -> dict[str, int]:
    try:
        cached = await _cached_totals()
        if cached is not None:
            return cached
        initialized = await refresh_site_totals(force=False)
        if initialized is not None:
            return initialized
    except Exception:
        log.warning("site_totals_cache_read_failed", exc_info=True)
    return await _database_totals(session)


async def increment_site_totals(**deltas: int) -> None:
    """Call only after a successful database commit; never fail the saved operation."""
    changes = {name: int(delta) for name, delta in deltas.items() if delta and name in _MODELS}
    if not changes:
        return
    try:
        # Missing counters are initialized from MySQL, never from a partial delta.
        await get_redis().eval(
            _INCREMENT, 1, TOTALS_KEY,
            *[value for pair in changes.items() for value in pair],
        )
    except Exception:
        log.warning("site_totals_increment_failed", deltas=changes, exc_info=True)
