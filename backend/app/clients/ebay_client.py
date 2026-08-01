import asyncio
import logging
import random
import time
from urllib.parse import quote

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential_jitter

from app.config import settings

logger = logging.getLogger(__name__)

TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"
SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"
TOKEN_TTL_SECONDS = 6000
RETRYABLE_STATUS_CODES = frozenset({429, 502, 503, 504})


def _should_retry(exception: BaseException) -> bool:
    """Retry transport failures and a small set of transient HTTP statuses."""
    if isinstance(exception, httpx.RequestError):
        return True
    if isinstance(exception, httpx.HTTPStatusError):
        return exception.response.status_code in RETRYABLE_STATUS_CODES
    return False


class EbayClient:
    client = httpx.AsyncClient(timeout=30.0)

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_time: float | None = None

    async def _get_token(self) -> str:
        settings.require_ebay_credentials()
        body = {
            "grant_type": "client_credentials",
            "scope": "https://api.ebay.com/oauth/api_scope",
        }
        try:
            resp = await self._request(
                "POST",
                TOKEN_URL,
                data=body,
                auth=(settings.client_id, settings.client_secret),
            )
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 401:
                raise RuntimeError(
                    "eBay OAuth rejected CLIENT_ID / CLIENT_SECRET (401). "
                    "Use the Production App ID and Cert ID from developer.ebay.com "
                    "(not Sandbox), set them on Vercel for Production, and redeploy."
                ) from exc
            raise
        return resp.json()["access_token"]

    async def _ensure_token(self) -> str:
        if (
            not self._token
            or not self._token_time
            or time.perf_counter() - self._token_time > TOKEN_TTL_SECONDS
        ):
            logger.info("Refreshing eBay OAuth token")
            self._token = await self._get_token()
            self._token_time = time.perf_counter()
        return self._token

    async def fetch_listings(self, params: dict[str, str]) -> list[dict]:
        token = await self._ensure_token()
        # contextualLocation improves shippingCost accuracy for CALCULATED rates.
        # Format must be URL-encoded: country=US,zip=60601
        location = f"country={settings.buyer_country},zip={settings.buyer_postal_code}"
        headers = {
            "Authorization": f"Bearer {token}",
            "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
            "X-EBAY-C-ENDUSERCTX": f"contextualLocation={quote(location)}",
        }
        resp = await self._request("GET", SEARCH_URL, headers=headers, params=params)
        return resp.json().get("itemSummaries", [])

    @retry(
        retry=retry_if_exception(_should_retry),
        wait=wait_exponential_jitter(initial=1, max=10),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def _request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        data: dict[str, str] | None = None,
        auth: tuple[str, str] | None = None,
    ) -> httpx.Response:
        """One HTTP attempt. Raises so Tenacity can retry transient failures."""
        resp = await self.client.request(
            method,
            url,
            headers=headers,
            params=params,
            data=data,
            auth=auth,
        )
        if resp.status_code == 429:
            await self._respect_retry_after(resp)
        # Raises httpx.HTTPStatusError for any 4xx/5xx. Predicate decides retry.
        resp.raise_for_status()
        return resp

    @staticmethod
    async def _respect_retry_after(resp: httpx.Response) -> None:
        """Sleep for Retry-After (+ small jitter) before the status error is raised."""
        raw = resp.headers.get("Retry-After")
        try:
            delay = float(raw) if raw is not None else 1.0
        except ValueError:
            delay = 1.0
        delay = max(0.0, delay) + random.uniform(0.0, 0.25)
        logger.warning("eBay rate limited (429); sleeping %.2fs before retry", delay)
        await asyncio.sleep(delay)
