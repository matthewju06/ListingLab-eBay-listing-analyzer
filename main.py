import requests, os
import statistics

# No need to load_dotenv() on Vercel; it's handled by the platform
# load_dotenv()

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

if not CLIENT_ID or not CLIENT_SECRET:
    raise RuntimeError("Missing CLIENT_ID / CLIENT_SECRET")

# Change these from .sandbox. to the live endpoints
TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"
SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"

def get_access_token(): # -> str
    # Basic Auth header: base64(client_id:client_secret)
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
        #"sort": "newlyListed",
        "limit": "200"
    }

    resp = requests.get(SEARCH_URL, headers=headers, params=params)
    resp.raise_for_status()

    #now we should return a json of the list of just specific items
    resp_dct = resp.json() 
    raw_items = resp_dct.get('itemSummaries', []) 
    items = remove_price_outliers(raw_items)
     
    return items

def remove_price_outliers(items):
    if not items or len(items) < 4:
        return items
        
    # Safer extraction that checks for price existence
    prices = []
    for i in items:
        try:
            val = i.get('price', {}).get('value')
            if val:
                prices.append(float(val))
        except (ValueError, TypeError):
            continue

    if len(prices) < 4:
        return items

    prices.sort()
    
    # Calculate quartiles
    q1 = statistics.quantiles(prices, n=4)[0]
    q3 = statistics.quantiles(prices, n=4)[2]
    iqr = q3 - q1
    
    upper_bound = q3 + (1.5 * iqr)
    lower_bound = q1 - (1.5 * iqr)

    # Return filtered items based on price
    def is_valid(item):
        try:
            p = float(item.get('price', {}).get('value', 0))
            return lower_bound <= p <= upper_bound
        except:
            return False

    return [i for i in items if is_valid(i)]

# when you run this file, it will test and print in console
# if __name__ == "__main__":
#     #item_name = input("Search Item: ")
#     #print(filter_print_response(search_item(item_name)))
#     print(search_item(input("Item name:")))