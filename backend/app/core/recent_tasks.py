"""Bounded Redis list for the site overview's most recent crawl tasks."""
from __future__ import annotations

import json
from datetime import timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.redis_client import get_redis
from app.models.task import CrawlTask

log = get_logger(__name__)
RECENT_TASKS_KEY = "site:recent_crawl_tasks:v1"
RECENT_TASKS_CAPACITY = 10

# Merge atomically so concurrent workers cannot lose entries or revive old states.
_MERGE = """
local entries = {}
for _, raw in ipairs(redis.call('LRANGE', KEYS[1], 0, 9)) do
    local item = cjson.decode(raw)
    entries[tostring(item.id)] = item
end
for _, item in ipairs(cjson.decode(ARGV[1])) do
    local key = tostring(item.id)
    local old = entries[key]
    if not old or (ARGV[2] ~= 'seed' and
        not (item.status == 'running' and old.status ~= 'running')) then
        entries[key] = item
    end
end
local ordered = {}
for _, item in pairs(entries) do table.insert(ordered, item) end
table.sort(ordered, function(a, b)
    if a.sort_time == b.sort_time then return a.id > b.id end
    return a.sort_time > b.sort_time
end)
redis.call('DEL', KEYS[1])
for i = 1, math.min(10, #ordered) do
    redis.call('RPUSH', KEYS[1], cjson.encode(ordered[i]))
end
return redis.call('LRANGE', KEYS[1], 0, 9)
"""


def _serialize(task: CrawlTask) -> dict:
    started_at = task.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    return {
        "id": task.id,
        "task_type": task.task_type,
        "url": task.url,
        "trigger": task.triggered_by.value,
        "status": task.status.value,
        "started_at": started_at.isoformat(),
        "sort_time": started_at.timestamp(),
    }


async def cache_recent_task(task: CrawlTask) -> None:
    try:
        await get_redis().eval(
            _MERGE, 1, RECENT_TASKS_KEY, json.dumps([_serialize(task)]), "update"
        )
    except Exception:
        log.warning("recent_task_cache_update_failed", task_id=task.id, exc_info=True)


async def get_recent_tasks(session: AsyncSession, limit: int = 5) -> list[dict]:
    limit = min(limit, RECENT_TASKS_CAPACITY)
    try:
        cached = await get_redis().lrange(RECENT_TASKS_KEY, 0, limit - 1)
        if cached:
            return [json.loads(raw) for raw in cached]
    except Exception:
        log.warning("recent_task_cache_read_failed", exc_info=True)
        rows = (await session.execute(
            select(CrawlTask)
            .order_by(desc(CrawlTask.started_at), desc(CrawlTask.id))
            .limit(limit)
        )).scalars().all()
        return [_serialize(row) for row in rows]

    rows = (await session.execute(
        select(CrawlTask)
        .order_by(desc(CrawlTask.started_at), desc(CrawlTask.id))
        .limit(RECENT_TASKS_CAPACITY)
    )).scalars().all()
    items = [_serialize(row) for row in rows]
    try:
        cached = await get_redis().eval(
            _MERGE, 1, RECENT_TASKS_KEY, json.dumps(items), "seed"
        )
        return [json.loads(raw) for raw in cached[:limit]]
    except Exception:
        log.warning("recent_task_cache_seed_failed", exc_info=True)
        return items[:limit]
