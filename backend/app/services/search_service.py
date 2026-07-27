import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from app.clients.ebay_client import EbayClient
from app.models.search import ItemSummary
from app.services.price_analysis import (
    EXCLUDE_KEYWORDS,
    apply_iqr,
    compute_price_range,
    extract_prices,
)

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    items: list[ItemSummary]
    applied_min_price: float | None
    applied_max_price: float | None


class SearchService:
    def __init__(self, ebay_client: EbayClient | None = None) -> None:
        self._ebay_client = ebay_client or EbayClient()

    def process_search(
        self,
        query: str,
        min_price: str,
        max_price: str,
        category: str | None,
        condition: str | None,
        filter_strength: int,
    ) -> SearchResult:
        if min_price == "":
            min_price = "0"

        applied_min: float | None = None
        applied_max: float | None = None

        if max_price == "":
            sample = self._get_listings(query, min_price, max_price, category, condition, limit=100)
            logger.info("Auto price range: sampled %d items", len(sample))
            sample = apply_iqr(sample)
            prices = extract_prices(sample)
            lo, hi = compute_price_range(prices, filter_strength)
            logger.info("Computed price range: (%s, %s)", lo, hi)
            applied_min, applied_max = lo, hi
            min_price, max_price = str(lo), str(hi)
        else:
            try:
                applied_min = float(min_price) if min_price not in ("", None) else 0.0
            except ValueError:
                applied_min = 0.0
            try:
                applied_max = float(max_price)
            except ValueError:
                applied_max = None

        final_items: list[dict] = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            pages_results = list(
                executor.map(
                    lambda p: self._get_listings(query, min_price, max_price, category, condition, page=p),
                    [1, 2],
                )
            )

        for page_items in pages_results:
            if page_items:
                final_items.extend(page_items)

        return SearchResult(
            items=self._filter_by_quality(final_items),
            applied_min_price=applied_min,
            applied_max_price=applied_max,
        )

    def _get_listings(
        self,
        query: str,
        min_price: str,
        max_price: str,
        category: str | None,
        condition: str | None,
        page: int = 1,
        limit: int = 200,
    ) -> list[dict]:
        params = self._build_search_params(query, min_price, max_price, category, condition, page, limit)
        raw_items = self._ebay_client.fetch_listings(params)
        return self._format_listings(raw_items)

    def _build_search_params(
        self,
        query: str,
        min_price: str,
        max_price: str,
        category: str | None,
        condition: str | None,
        page: int,
        limit: int,
    ) -> dict[str, str]:
        filter_str = f"price:[{min_price}..{max_price}],priceCurrency:USD"

        if condition == "new":
            filter_str += ",conditionIds:{1000|1500}"
        elif condition == "used":
            filter_str += ",conditionIds:{2750|2990|3000|4000|5000|6000}"

        params: dict[str, str] = {
            "q": str(query),
            "auto_correct": "KEYWORD",
            "filter": filter_str,
            "limit": str(limit),
            "offset": str(200 * (page - 1)),
        }

        if category:
            params["category_ids"] = category

        return params

    @staticmethod
    def _format_listings(items: list[dict]) -> list[dict]:
        formatted: list[dict] = []
        for item in items:
            categories = item.get("categories") or []
            formatted.append(
                {
                    "title": item.get("title"),
                    "price": item.get("price", {}).get("value", "0"),
                    "condition": item.get("condition"),
                    "itemWebUrl": item.get("itemWebUrl"),
                    "username": item.get("seller", {}).get("username"),
                    "feedbackPercentage": item.get("seller", {}).get("feedbackPercentage"),
                    "categoryName": categories[0].get("categoryName") if categories else None,
                    "imageUrl": item.get("image", {}).get("imageUrl"),
                    "itemCreationDate": item.get("itemCreationDate"),
                }
            )
        return formatted

    @staticmethod
    def _filter_by_quality(items: list[dict]) -> list[ItemSummary]:
        if not items:
            return []

        def is_valid(item: dict) -> bool:
            try:
                score = float(item["feedbackPercentage"])
                title_words = item.get("title", "").split()
                contains_keyword = any(word.lower() in EXCLUDE_KEYWORDS for word in title_words)
                return score > 95 and not contains_keyword
            except (ValueError, TypeError, KeyError):
                return False

        filtered = [item for item in items if is_valid(item)]
        filtered.sort(key=lambda i: float(i.get("price", 0) or 0))

        return [ItemSummary.model_validate(item) for item in filtered]
