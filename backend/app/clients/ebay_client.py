import logging
import time

import requests

from app.config import settings

logger = logging.getLogger(__name__)

TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"
SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"
TOKEN_TTL_SECONDS = 6000


class EbayClient:
    def __init__(self) -> None:
        self._token: str | None = None
        self._token_time: float | None = None

    def _get_token(self) -> str:
        settings.require_ebay_credentials()
        body = {
            "grant_type": "client_credentials",
            "scope": "https://api.ebay.com/oauth/api_scope",
        }
        resp = requests.post(
            TOKEN_URL,
            data=body,
            auth=(settings.client_id, settings.client_secret),
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

    def _ensure_token(self) -> str:
        if not self._token or not self._token_time or time.perf_counter() - self._token_time > TOKEN_TTL_SECONDS:
            logger.info("Refreshing eBay OAuth token")
            self._token = self._get_token()
            self._token_time = time.perf_counter()
        return self._token

    def fetch_listings(self, params: dict[str, str]) -> list[dict]:
        token = self._ensure_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        }
        resp = requests.get(SEARCH_URL, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json().get("itemSummaries", [])
