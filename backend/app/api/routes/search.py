import logging

from fastapi import APIRouter, HTTPException, Query

from app.models.search import SearchResponse
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["search"])

_search_service = SearchService()


@router.get("/search", response_model=SearchResponse)
def search(
    query: str = Query(..., min_length=1, max_length=80),
    min_price: str = Query(default="", alias="minPrice"),
    max_price: str = Query(default="", alias="maxPrice"),
    category: str | None = Query(default=None),
    condition: str | None = Query(default=None),
    filter_strength: int = Query(default=4, alias="filterStrength"),
) -> SearchResponse:
    cleaned = query.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Missing query")

    try:
        result = _search_service.process_search(
            query=cleaned,
            min_price=min_price,
            max_price=max_price,
            category=category,
            condition=condition,
            filter_strength=filter_strength,
        )
        return SearchResponse(
            itemSummaries=result.items,
            appliedMinPrice=result.applied_min_price,
            appliedMaxPrice=result.applied_max_price,
        )
    except Exception as exc:
        logger.exception("Search failed for query=%r", cleaned)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
