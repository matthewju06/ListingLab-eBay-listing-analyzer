import asyncio
import logging
import random
import time
from urllib.parse import quote

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential_jitter

from app.config import settings
from app.redis_client import get_redis

logger = logging.getLogger(__name__)

TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"
SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"
# eBay access tokens last ~2h; refresh early so callers never see an expired token.
TOKEN_TTL_SECONDS = 6000
TOKEN_REDIS_KEY = "listinglab:ebay:oauth_token"
TOKEN_LOCK_KEY = "listinglab:ebay:oauth_lock"
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
        # L1: process-local (helps warm Vercel instances; lost on cold start).
        self._token: str | None = None
        self._token_time: float | None = None
        self._token_ttl: float = TOKEN_TTL_SECONDS

    async def _get_token(self) -> tuple[str, int]:
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
        payload = resp.json()
        token = payload["access_token"]
        expires_in = int(payload.get("expires_in") or 7200)
        # Refresh a bit early so shared cache never serves a nearly-dead token.
        ttl = max(60, expires_in - 600)
        return token, ttl

    def _memory_token_valid(self) -> bool:
        return bool(
            self._token
            and self._token_time
            and time.perf_counter() - self._token_time < self._token_ttl
        )

    def _store_memory_token(self, token: str, ttl: int) -> None:
        self._token = token
        self._token_time = time.perf_counter()
        self._token_ttl = float(ttl)

    async def _ensure_token(self) -> str:
        if self._memory_token_valid():
            return self._token  # type: ignore[return-value]

        redis = await get_redis()
        if redis is not None:
            try:
                cached = await redis.get(TOKEN_REDIS_KEY)
                if cached:
                    token = str(cached)
                    self._store_memory_token(token, TOKEN_TTL_SECONDS)
                    return token
            except Exception:
                logger.exception("Redis OAuth GET failed")

            got_lock = False
            try:
                got_lock = bool(await redis.set(TOKEN_LOCK_KEY, "1", nx=True, ex=20))
            except Exception:
                logger.exception("Redis OAuth lock failed")

            if got_lock:
                try:
                    cached = await redis.get(TOKEN_REDIS_KEY)
                    if cached:
                        token = str(cached)
                        self._store_memory_token(token, TOKEN_TTL_SECONDS)
                        return token

                    logger.info("Refreshing eBay OAuth token (shared)")
                    token, ttl = await self._get_token()
                    self._store_memory_token(token, ttl)
                    try:
                        await redis.set(TOKEN_REDIS_KEY, token, ex=ttl)
                    except Exception:
                        logger.exception("Redis OAuth SET failed")
                    return token
                finally:
                    try:
                        await redis.delete(TOKEN_LOCK_KEY)
                    except Exception:
                        logger.exception("Redis OAuth unlock failed")
            else:
                # Another instance is refreshing; wait briefly for the shared token.
                for _ in range(15):
                    await asyncio.sleep(0.2)
                    try:
                        cached = await redis.get(TOKEN_REDIS_KEY)
                        if cached:
                            token = str(cached)
                            self._store_memory_token(token, TOKEN_TTL_SECONDS)
                            return token
                    except Exception:
                        logger.exception("Redis OAuth wait GET failed")
                        break

        logger.info("Refreshing eBay OAuth token (local)")
        token, ttl = await self._get_token()
        self._store_memory_token(token, ttl)
        return token

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
