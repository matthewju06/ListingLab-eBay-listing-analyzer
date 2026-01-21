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
TREE_ID_URL = "https://api.ebay.com/commerce/taxonomy/v1/get_default_category_tree_id"

token_time = None
token = None

def get_access_token(): # -> str
    auth = (CLIENT_ID, CLIENT_SECRET)

    body = {
        "grant_type": "client_credentials",
        "scope": "https://api.ebay.com/oauth/api_scope"
    }

    resp = requests.post(TOKEN_URL, data=body, auth=auth)

    resp.raise_for_status()  # will throw if something went wrong

    token_info = resp.json()
    return token_info["access_token"]


def search_item(query, minPrice, maxPrice, category, condition = None, page = 1, limit = 200): #str -> list(dict)
    global token_time, token
    # If past token does not exist yet or token age is over 100 minutes
    if not token_time or time.perf_counter() - token_time > 6000:
        token_time = time.perf_counter()
        token = get_access_token() 

    oauth = {
        "Authorization": f"Bearer {token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    }

    # Base filter
    filter_str = f'price:[{minPrice}..{maxPrice}],priceCurrency:USD'

    # Add condition filter
    if condition:
        if condition == 'new':
            filter_str += ',conditionIds:{1000|1500}' # New, New other
        elif condition == 'used':
            filter_str += ',conditionIds:{3000|4000|5000|6000}' # Used, Very Good, Good, Acceptable

    params = {
        "q": str(query),
        "auto_correct": "KEYWORD",
        "filter" : filter_str,
        "limit": str(limit),
        "offset": f'{200*(page-1)}' #for pagination
    }

    if category:
        params['category_ids'] = category

    resp = requests.get(SEARCH_URL, headers=oauth, params=params)
    resp.raise_for_status()

    #now we should return a json of the list of just specific items
    resp_dct = resp.json() 
    items = resp_dct.get('itemSummaries', [])
     
    return items # -> List[Dict]