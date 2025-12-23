import requests, os
from dotenv import load_dotenv
load_dotenv()

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

if not CLIENT_ID or not CLIENT_SECRET:
    raise RuntimeError("Missing CLIENT_ID / CLIENT_SECRET")

TOKEN_URL = "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
SEARCH_URL = "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search"

def get_access_token():
    # Basic Auth header: base64(client_id:client_secret)
    auth = (CLIENT_ID, CLIENT_SECRET)

    body = {
        "grant_type": "client_credentials",
        "scope": "https://api.ebay.com/oauth/api_scope"
    }

    resp = requests.post(TOKEN_URL, data=body, auth=auth)

    #import pdb; pdb.set_trace()

    resp.raise_for_status()  # will throw if something went wrong

    token_info = resp.json()
    return token_info["access_token"]


def search_item(item, limit):
    token = get_access_token() 

    headers = {
        "Authorization": f"Bearer {token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    }

    q = str(item)

    params = {
        "q": q,
        "limit": limit,
        "auto_correct": "KEYWORD",
        #"filter": "price:[0..100],priceCurrency:USD,buyingOptions:{FIXED_PRICE}",
        "sort": "price"

        #in the future use taxonomy api to retrieve proper categoryid
        # get /category_tree/{category_tree_id}/get_category_suggestions
        # category_tree_id = getDefaultCategoryTreeId
        # get_category_suggestions:
        # param :
        #   * q
    }

    resp = requests.get(SEARCH_URL, headers=headers, params=params)
    resp.raise_for_status()
     
    return resp.json()

def filter_print_response(response):
    items = response['itemSummaries']
    i = 1
    for item in items:
        print(f"{i}. {item['title']} is {item['price']['value']} {item['price']['currency']}")
        i+=1

if __name__ == "__main__":
    item_name = input("Search Item: ")
    qty = input("Num Items: ")
    print(filter_print_response(search_item(item_name, qty)))