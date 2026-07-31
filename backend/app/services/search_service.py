import logging
import statistics
from dataclasses import dataclass
import asyncio

from app.clients.ebay_client import EbayClient
from app.models.search import ItemSummary
from app.services.price_analysis import (
    EXCLUDE_KEYWORDS,
    apply_iqr,
    extract_prices,
    suggest_price_cluster,
)

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    items: list[ItemSummary]
    applied_min_price: float | None
    applied_max_price: float | None
    suggested_min_price: float | None = None
    suggested_max_price: float | None = None
    suggested_coverage: float | None = None


class SearchService:
    def __init__(self, ebay_client: EbayClient | None = None) -> None:
        self._ebay_client = ebay_client or EbayClient()

    async def process_search(
        self,
        query: str,
        min_price: str,
        max_price: str,
        category: str | None,
        condition: str | None,
        filter_strength: int,
    ) -> SearchResult:
        refined = max_price not in ("", None)
        applied_min: float | None = None
        applied_max: float | None = None

        if refined:
            if min_price == "":
                min_price = "0"
            try:
                applied_min = float(min_price) if min_price not in ("", None) else 0.0
            except ValueError:
                applied_min = 0.0
            try:
                applied_max = float(max_price)
            except ValueError:
                applied_max = None
                refined = False
                min_price, max_price = "", ""
        else:
            # Open search: Best Match, no price clamp.
            min_price, max_price = "", ""

        page_size = 200
        page_tasks = [self._get_listings(query, min_price, max_price, category, condition, page=1, limit=page_size),
                        self._get_listings(query, min_price, max_price, category, condition, page=2, limit=page_size)]
        pages: list[list[dict]] = await asyncio.gather(*page_tasks)

        final_items = self._dedupe_listings(
            [item for page_items in pages if page_items for item in page_items]
        )
        final_items = self._apply_shipping_totals(final_items)
        items = self._filter_by_quality(final_items)

        suggested_min: float | None = None
        suggested_max: float | None = None
        suggested_coverage: float | None = None
        if not refined:
            sample = apply_iqr([{"price": item.price} for item in items])
            prices = extract_prices(sample)
            suggestion = suggest_price_cluster(prices, filter_strength)
            if suggestion is not None:
                suggested_min, suggested_max, suggested_coverage = suggestion
                logger.info(
                    "Suggested price cluster for %r: (%s, %s) coverage=%.0f%% from %d prices",
                    query,
                    suggested_min,
                    suggested_max,
                    suggested_coverage * 100,
                    len(prices),
                )

        return SearchResult(
            items=items,
            applied_min_price=applied_min,
            applied_max_price=applied_max,
            suggested_min_price=suggested_min,
            suggested_max_price=suggested_max,
            suggested_coverage=suggested_coverage,
        )

    async def _get_listings(
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
        raw_items = await self._ebay_client.fetch_listings(params)
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
        filter_parts: list[str] = []

        # Only clamp price when the user explicitly refined.
        # Note: eBay's price filter is item price only; our comps use item+shipping.
        if max_price not in ("", None):
            filter_parts.append(f"price:[{min_price or '0'}..{max_price}]")
            filter_parts.append("priceCurrency:USD")

        if condition == "new":
            filter_parts.append("conditionIds:{1000|1500}")
        elif condition == "used":
            filter_parts.append("conditionIds:{2750|2990|3000|4000|5000|6000}")

        params: dict[str, str] = {
            "q": str(query),
            "auto_correct": "KEYWORD",
            "limit": str(limit),
            "offset": str(limit * (page - 1)),
        }
        if filter_parts:
            params["filter"] = ",".join(filter_parts)

        if category:
            params["category_ids"] = category

        return params

    @staticmethod
    def _extract_shipping(item: dict) -> float | None:
        options = item.get("shippingOptions") or []
        if not options:
            return None
        cost = (options[0] or {}).get("shippingCost") or {}
        value = cost.get("value")
        if value is None or value == "":
            return None
        try:
            return max(0.0, float(value))
        except (TypeError, ValueError):
            return None

    @classmethod
    def _format_listings(cls, items: list[dict]) -> list[dict]:
        formatted: list[dict] = []
        for item in items:
            categories = item.get("categories") or []
            raw_price = item.get("price", {}).get("value", "0")
            try:
                item_price = float(raw_price)
            except (TypeError, ValueError):
                item_price = 0.0
            shipping = cls._extract_shipping(item)
            formatted.append(
                {
                    "itemId": item.get("itemId"),
                    "title": item.get("title"),
                    "itemPrice": f"{item_price:.2f}",
                    "shippingCost": shipping,
                    "shippingEstimated": False,
                    # Filled in _apply_shipping_totals
                    "price": f"{item_price:.2f}",
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
    def _apply_shipping_totals(items: list[dict]) -> list[dict]:
        """Set price = item + shipping; impute missing shipping from cohort median."""
        known = [
            float(item["shippingCost"])
            for item in items
            if item.get("shippingCost") is not None
        ]
        median_ship = float(statistics.median(known)) if known else 0.0

        for item in items:
            try:
                item_price = float(item.get("itemPrice") or 0)
            except (TypeError, ValueError):
                item_price = 0.0

            if item.get("shippingCost") is not None:
                shipping = float(item["shippingCost"])
                estimated = False
            else:
                shipping = median_ship
                estimated = True

            item["shippingCost"] = round(shipping, 2)
            item["shippingEstimated"] = estimated
            item["price"] = f"{(item_price + shipping):.2f}"

        if known:
            logger.info(
                "Shipping totals: %d known, %d imputed (median $%.2f)",
                len(known),
                len(items) - len(known),
                median_ship,
            )
        return items

    @staticmethod
    def _dedupe_listings(items: list[dict]) -> list[dict]:
        seen: set[str] = set()
        unique: list[dict] = []
        for item in items:
            key = (
                item.get("itemId")
                or item.get("itemWebUrl")
                or f"{item.get('title')}|{item.get('price')}|{item.get('username')}"
            )
            if not key or key in seen:
                continue
            seen.add(key)
            cleaned = {k: v for k, v in item.items() if k != "itemId"}
            unique.append(cleaned)
        return unique

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
