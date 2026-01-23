import requests, os
import time

# No need to load_dotenv() on Vercel; it's handled by the platform
from dotenv import load_dotenv
load_dotenv()

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")


if not CLIENT_ID or not CLIENT_SECRET:
    raise RuntimeError("Missing CLIENT_ID / CLIENT_SECRET")

# Change these from .sandbox. to the live endpoints
TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"
SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"

token_time = None
token = None

def get_ebay_token(): # -> str
    auth = (CLIENT_ID, CLIENT_SECRET)

    body = {
        "grant_type": "client_credentials",
        "scope": "https://api.ebay.com/oauth/api_scope"
    }

    resp = requests.post(TOKEN_URL, data=body, auth=auth)
    resp.raise_for_status()

    token_info = resp.json()
    return token_info["access_token"]


def fetch_listings(params): #str -> list(dict)
    global token_time, token
    
    # If past token does not exist yet or token age is over 100 minutes
    if not token_time or time.perf_counter() - token_time > 6000:
        token_time = time.perf_counter()
        token = get_ebay_token()

    oauth = {
        "Authorization": f"Bearer {token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    }

    resp = requests.get(SEARCH_URL, headers=oauth, params=params)
    resp.raise_for_status()

    #now we should return a json of the list of just specific items
    resp_dct = resp.json() 
    items = resp_dct.get('itemSummaries', [])

    return items # -> List[Dict]