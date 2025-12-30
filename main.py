import requests, os
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
        "sort": "price",
        "limit": "200"

        #in the future use taxonomy api to retrieve proper categoryid
        # get /category_tree/{category_tree_id}/get_category_suggestions
        # category_tree_id = getDefaultCategoryTreeId
        # get_category_suggestions:
        # param :
        #   * q
    }

    resp = requests.get(SEARCH_URL, headers=headers, params=params)
    resp.raise_for_status()

    #format of ebay json:
    #['itemSummaries'] -> list of items
    # for each item:
    # itemId, title, leafCategoryIds, categories [{...}], image {}
    # ... price {value, currency}, itemHref, 
    # ... seller {username, feedbackPercentage, feedbackScore},
    # ... condition, conditionId, thumbnailImages {[...]},
    # ... shippingOptions [{...}], buyingOptions [...], itemWebUrl,
    # ... itemLocation, additionalImages [{}], ...

    #now we should return a json of the list of just specific items
    resp_dct = resp.json() #convert the json response from eBay to a dict
    items = resp_dct.get('itemSummaries', [])
     
    return items

# for testing in console
def filter_print_response(response):
    items = response['itemSummaries']
    i = 1
    for item in items:
        print(f"{i}. {item['title']}: {item['price']['value']} {item['price']['currency']}")
        i+=1

# when you run this file, it will test and print in console
# if __name__ == "__main__":
#     #item_name = input("Search Item: ")
#     #print(filter_print_response(search_item(item_name)))
#     print(search_item(input("Item name:")))