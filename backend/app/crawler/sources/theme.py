"""按需抓取一份主题配置，不保存登录用户和页面脚本。"""
import time

from app.core.db import db_session
from app.core.logging import get_logger
from app.core.redis_client import get_redis
from app.crawler.cookies import lease_account
from app.crawler.http import fetch_authed
from app.crawler.sources.base import record_task_done, record_task_start
from app.models._common import CrawlTaskStatus, CrawlTrigger, utcnow
from app.models.theme import LuoguTheme
from app.services.theme_config import normalize_config

log = get_logger(__name__)


async def crawl_one(theme_id: int, token: str):
    async with db_session() as session:
        row = await session.get(LuoguTheme, theme_id)
        if row is None or row.job_token != token or row.status != "pending":
            return
    task_id = None
    start = time.monotonic()
    try:
        async with lease_account(cn=True) as account:
            if account is None:
                raise RuntimeError("账号池暂不可用")
            task_id = await record_task_start("theme", f"/theme/design/{theme_id}", trigger=CrawlTrigger.manual, account_id=account.account_id)
            result = await fetch_authed(
                f"https://www.luogu.com.cn/theme/design/{theme_id}", redis=get_redis(),
                cookies=account.as_cookie_dict(), account_id=account.account_id,
                accept_json=False, parse="html")
            context = result.data or {}
            theme = (context.get("data") or {}).get("theme") or {}
            if context.get("status") != 200 or theme.get("id") != theme_id:
                raise RuntimeError("未取得有效主题")
            config = normalize_config(theme.get("config"))
            async with db_session() as session:
                row = await session.get(LuoguTheme, theme_id, with_for_update=True)
                # 旧任务不能覆盖用户后来触发的刷新结果。
                if row is not None and row.job_token == token:
                    row.config, row.name = config, str(theme.get("name") or "")[:200]
                    row.author_name = str((theme.get("author") or {}).get("name") or "")[:100]
                    row.status, row.error, row.fetched_at = "ready", None, utcnow()
                    await session.commit()
            await record_task_done(task_id, status=CrawlTaskStatus.success, http_status=result.status, duration_ms=int((time.monotonic()-start)*1000))
    except Exception as error:
        # 公共接口只给出固定错误，避免向访问者泄露账号、内网和响应正文。
        message = "主题导入失败：页面不可访问、账号不可用或配置不受支持，请稍后重试"
        log.warning("theme.import_failed", theme_id=theme_id, error_type=type(error).__name__)
        async with db_session() as session:
            row = await session.get(LuoguTheme, theme_id, with_for_update=True)
            if row is not None and row.job_token == token:
                row.status, row.error = "error", message
                await session.commit()
        if task_id is not None:
            await record_task_done(task_id, status=CrawlTaskStatus.failed, error_msg=message, duration_ms=int((time.monotonic()-start)*1000))
