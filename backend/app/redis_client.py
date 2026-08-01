"""Upstash Redis helpers for serverless (HTTP REST, not TCP).

Graceful degrade: if env credentials are missing, all helpers no-op / return None
so local dev still works with process-local token cache only.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

_redis: Any | None = None
_redis_checked = False


def redis_enabled() -> bool:
    return bool(settings.redis_rest_url and settings.redis_rest_token)


async def get_redis():
    """Return a shared async Upstash client, or None if not configured."""
    global _redis, _redis_checked
    if _redis_checked:
        return _redis
    _redis_checked = True
    if not redis_enabled():
        logger.info("Redis not configured; search cache / shared token / rate limit disabled")
        _redis = None
        return None
    try:
        from upstash_redis.asyncio import Redis

        _redis = Redis(url=settings.redis_rest_url, token=settings.redis_rest_token)
        return _redis
    except Exception:
        logger.exception("Failed to init Upstash Redis client")
        _redis = None
        return None


def search_cache_key(
    query: str,
    min_price: str,
    max_price: str,
    category: str | None,
    condition: str | None,
    filter_strength: int,
) -> str:
    payload = "|".join(
        [
            query.strip().lower(),
            min_price or "",
            max_price or "",
            category or "",
            condition or "",
            str(filter_strength),
        ]
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]
    return f"listinglab:search:{digest}"


async def cache_get_json(key: str) -> dict[str, Any] | None:
    client = await get_redis()
    if client is None:
        return None
    try:
        raw = await client.get(key)
        if raw is None:
            return None
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            return json.loads(raw)
        return None
    except Exception:
        logger.exception("Redis GET failed for key=%s", key)
        return None


async def cache_set_json(key: str, value: dict[str, Any], ttl_seconds: int) -> None:
    client = await get_redis()
    if client is None:
        return
    try:
        await client.set(key, json.dumps(value), ex=ttl_seconds)
    except Exception:
        logger.exception("Redis SET failed for key=%s", key)


async def rate_limit_allow(bucket_key: str, limit: int, window_seconds: int) -> bool:
    """Fixed-window counter. Returns False when the caller should be rejected."""
    client = await get_redis()
    if client is None:
        return True
    try:
        count = await client.incr(bucket_key)
        if count == 1:
            await client.expire(bucket_key, window_seconds)
        return int(count) <= limit
    except Exception:
        logger.exception("Redis rate limit failed for key=%s", bucket_key)
        return True
