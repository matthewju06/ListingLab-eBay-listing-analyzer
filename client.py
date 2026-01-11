import requests, os
from service import filter_items

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


def search_item(item): #str -> list(dict)
    token = get_access_token() 

    headers = {
        "Authorization": f"Bearer {token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    }

    q = str(item)

    params = {
        "q": q,
        "auto_correct": "KEYWORD",
        #"sort": "", default is bestMatch
        "limit": "200"
    }

    resp = requests.get(SEARCH_URL, headers=headers, params=params)
    resp.raise_for_status()

    #now we should return a json of the list of just specific items
    resp_dct = resp.json() 
    raw_items = resp_dct.get('itemSummaries', []) 

    items = filter_items(raw_items)
     
    return items
