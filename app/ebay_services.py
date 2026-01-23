import math, statistics
from .ebay_client import fetch_listings #services -> clients
from concurrent.futures import ThreadPoolExecutor

def format_listings(items):
    new_items = []
    for item in items:
        new_item = dict()
        new_item['title'] = item.get('title', None)
        new_item['price'] = item.get('price', {}).get('value', '0')
        new_item['condition'] = item.get('condition', None)
        new_item['itemWebUrl'] = item.get('itemWebUrl', None)
        new_item['username'] = item.get('seller', {}).get('username', None)
        new_item['feedbackPercentage'] = item.get('seller', {}).get('feedbackPercentage', None)
        new_item['categoryName'] = item.get('categories', [])[0].get('categoryName', None)
        new_item['imageUrl'] = item.get('image', {}).get('imageUrl', None)
        new_item['itemCreationDate'] = item.get('itemCreationDate', None)

        new_items.append(new_item)
    
    return new_items


def filter_by_quality(items):
    if not items:
        return items
    
    def is_valid(item):
        try:
            score = float(item['feedbackPercentage'])
            return score > 95
        except:
            return False

    items = [item for item in items if is_valid(item)]

    # Gives back a float version of the given item
    def get_price(item):
        try:
            return float(item['price'])
        except (ValueError, TypeError):
            return 0.0
    
    items = sorted(items, key = get_price)
    return items


def extract_prices(items):
    if not items:
        return items
    
    # Safer extraction that checks for price existence
    prices = []
    for i in items:
        try:
            val = i['price']
            if val:
                prices.append(float(val))
        except (ValueError, TypeError):
            continue
    
    return prices


# Adjusting Sliding Window Method
def get_segment(prices, ALPHA):
    # Log the prices to make larger gaps more unique
    log_prices = [math.log(price) for price in prices]
    gaps = [log_prices[i+1] - log_prices[i] for i in range(len(log_prices) - 1)]

    # Finds an appropriate gap threshold
    gap_scale = statistics.median(gaps)
    gap_threshold = gap_scale * ALPHA

    # Record idx in gaps that are greater than gap threshold
    breaks = [idx for idx, g in enumerate(gaps) if g > gap_threshold]
    edges = [0] + breaks + [len(prices)-1]
    
    # Find the largest segment
    largest_segment = (0, 0)
    max_size = -1
    for i in range(len(edges)-1):
        start = edges[i]+1
        end = edges[i+1]
        if (end - start) > max_size:
            largest_segment = (start, end)
            max_size = end - start

    return largest_segment


def calculate_range(prices, segment):
    if not prices or segment[1] >= len(prices):
        return (0.0, 0.0)

    price_range = (prices[segment[0]], prices[segment[1]])
    return price_range



# CreateHeader()
def build_search_params(query, minPrice, maxPrice, category, condition = None, page = 1, limit = 200, sort = False):
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

    if sort:
        params['sort'] = 'price'
    
    return params

# Called by Flask app
def process_search(query, minPrice, maxPrice, category, condition, filterStrength):
#   fetch_listings(query, minPrice, maxPrice, category, condition = None, page = 1, limit = 200)
    if minPrice == '':
        minPrice = '0'

    sort = False

    if minPrice == '0' and maxPrice == '':
        sort = True
        sampleParams = build_search_params(query, minPrice, maxPrice, category, condition, limit = 50)
        sample = filter_by_quality(format_listings(fetch_listings(sampleParams)))
        prices = extract_prices(sample)
        if prices:
            segment = get_segment(prices, filterStrength)
            if (segment[1] - segment[0]) / len(prices) < 0.6:
                sampleParams = build_search_params(query, minPrice, maxPrice, category, condition, limit = 100)
                sample = filter_by_quality(format_listings(fetch_listings(sampleParams)))
                prices = extract_prices(sample)
                segment = get_segment(prices, filterStrength)

            minPrice, maxPrice = calculate_range(prices, segment)

    # Pagination
    final_items = []
    pages_to_fetch = [1,2]

    import time

    with ThreadPoolExecutor(max_workers=5) as executor:
        results_generator = executor.map(
            lambda p: format_listings(fetch_listings(
                build_search_params(query, minPrice, maxPrice, category, condition, page=p, sort=sort)
            )), 
            pages_to_fetch
        )

        # 2. Convert generator to list immediately to catch the data
        pages_results = list(results_generator)
        

    for page_items in pages_results:
        if page_items and isinstance(page_items, list):
            final_items.extend(page_items)

    return filter_by_quality(final_items)