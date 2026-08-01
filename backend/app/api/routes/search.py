import logging

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from app.config import settings
from app.models.search import SearchResponse
from app.redis_client import (
    cache_get_json,
    cache_set_json,
    rate_limit_allow,
    search_cache_key,
)
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["search"])

_search_service = SearchService()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@router.get("/search", response_model=SearchResponse)
async def search(
    request: Request,
    query: str = Query(..., min_length=1, max_length=80),
    min_price: str = Query(default="", alias="minPrice"),
    max_price: str = Query(default="", alias="maxPrice"),
    category: str | None = Query(default=None),
    condition: str | None = Query(default=None),
    filter_strength: int = Query(default=6, alias="filterStrength", ge=1, le=20),
) -> SearchResponse:
    cleaned = query.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Missing query")

    ip = _client_ip(request)
    allowed = await rate_limit_allow(
        f"listinglab:ratelimit:search:{ip}",
        limit=settings.search_rate_limit,
        window_seconds=settings.search_rate_window_seconds,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many searches. Please wait a minute and try again.",
        )

    cache_key = search_cache_key(
        cleaned, min_price, max_price, category, condition, filter_strength
    )
    cached = await cache_get_json(cache_key)
    if cached is not None:
        try:
            logger.info("Search cache hit for query=%r", cleaned)
            return SearchResponse.model_validate(cached)
        except Exception:
            logger.exception("Invalid search cache payload for key=%s", cache_key)

    try:
        result = await _search_service.process_search(
            query=cleaned,
            min_price=min_price,
            max_price=max_price,
            category=category,
            condition=condition,
            filter_strength=filter_strength,
        )
        response = SearchResponse(
            itemSummaries=result.items,
            appliedMinPrice=result.applied_min_price,
            appliedMaxPrice=result.applied_max_price,
            suggestedMinPrice=result.suggested_min_price,
            suggestedMaxPrice=result.suggested_max_price,
            suggestedCoverage=result.suggested_coverage,
        )
        await cache_set_json(
            cache_key,
            response.model_dump(by_alias=True, mode="json"),
            ttl_seconds=settings.search_cache_ttl_seconds,
        )
        return response
    except httpx.HTTPError:
        logger.exception("Upstream eBay failure for query=%r", cleaned)
        raise HTTPException(
            status_code=502,
            detail="Search upstream failed. Please try again.",
        ) from None
    except HTTPException:
        raise
    except Exception:
        logger.exception("Search failed for query=%r", cleaned)
        raise HTTPException(
            status_code=500,
            detail="Search failed. Please try again.",
        ) from None
