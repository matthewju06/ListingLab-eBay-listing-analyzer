import math, statistics
from .ebay_client import fetch_listings #services -> clients
from concurrent.futures import ThreadPoolExecutor


# We are going to do this

# 1. Initial KW filtering
# 2. IQR to remove low and high price
# 3. Sliding window to find best price range

# Abstracttion:
# 1. Get listings (search ebay, reformat to simple, dont sort yet)
    # a. this is not sorted yet because when searching up the final time we will sort again anyways
# 2. IQR Filter (get items sorted, calc IQR, remove and return new list)
# 3. Calcuate Range (take those items (sorted already) and use sliding window to calcuate the best segment (density))


# Called by Flask app
# Highest level of abstraction
def process_search(query, minPrice, maxPrice, category, condition, filterStrength):
    if minPrice == '':
        minPrice = '0'

    # If user did not put a maxPrice and (minPrice was not set too or is 0)
    if minPrice == '0' and maxPrice == '':
        sample = get_listings(query, minPrice, maxPrice, category, condition, limit = 100)
        print(f"limit = 100, found {len(sample)} items")
        sample = apply_IQR(sample)
        print(f"applied IQR, now {len(sample)} items")
        prices = extract_prices(sample)
        minPrice, maxPrice = compute_price_range(prices, filterStrength)
        print(f"price range is ({minPrice},{maxPrice})")

    # Pagination
    final_items = []
    pages_to_fetch = [1,2]

    import time
    print(f"using price range ({minPrice},{maxPrice})")
    with ThreadPoolExecutor(max_workers=5) as executor:
        results_generator = executor.map(
            lambda p: (get_listings(query, minPrice, maxPrice, category, condition, page=p)), 
            pages_to_fetch
        )

        # 2. Convert generator to list immediately to catch the data
        pages_results = list(results_generator)
        

    for page_items in pages_results:
        if page_items and isinstance(page_items, list):
            final_items.extend(page_items)

    return filter_by_quality(final_items)


def apply_IQR(items):
    prices = extract_prices(items)
    if not prices:
        return items

    print(f"pre IQR: {min(prices)}, {max(prices)}")

    if len(prices) < 15:
        return items  # not enough signal

    prices = sorted(prices)

    q1, _, q3 = statistics.quantiles(prices, n=4, method="inclusive")
    iqr = q3 - q1

    lower = q1 - 1.0 * iqr
    upper = q3 + 1.5 * iqr

    def is_valid(item):
        try:
            price = float(item["price"])
            return lower <= price <= upper
        except (ValueError, TypeError):
            return False

    return [item for item in items if is_valid(item)]

# Builds params and searches ebay then formats, sorts, and filters the listings
def get_listings(query, minPrice, maxPrice, category, condition = None, page = 1, limit = 200):
    params = build_search_params(query, minPrice, maxPrice, category, condition, page, limit)
    raw_items = fetch_listings(params)
    items = format_listings(raw_items)
    return items


# Currently used as last step before sending all data to user
# Removes items with negative keywords and low seller score, then sorts
def filter_by_quality(items):
    if not items:
        return items
    
    EXCLUDE_KEYWORDS = {
        "broken",
    }

    def is_valid(item):
        try:
            score = float(item['feedbackPercentage'])
            contains_nkw = False

            for word in item['title'].split():
                if word.lower() in EXCLUDE_KEYWORDS:
                    contains_nkw = True
                    break

            return score > 95 and not contains_nkw
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


# def calculate_range(sample, filterStrength):
#     prices = extract_prices(sample)
#     segment = get_segment(prices, filterStrength)

#     if not prices or segment[1] >= len(prices):
#         return (0.0, 0.0)

#     price_range = (prices[segment[0]], prices[segment[1]])
#     return price_range


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


def extract_prices(items):
    if not items:
        return items
    
    # Safer extraction that checks for price existence
    prices = []
    for item in items:
        try:
            val = item['price']
            if val:
                p = float(val)
                if p > 0: prices.append(p)
        except (ValueError, TypeError):
            continue
    
    return prices


# # Adjusting Sliding Window Method
# def get_segment(prices, ALPHA):
#     prices = sorted(p for p in prices if p > 0)
#     n = len(prices)
#     if n < 5:
#         return (0, n - 1)

#     log_prices = [math.log(p) for p in prices]
#     gaps = [log_prices[i+1] - log_prices[i] for i in range(n - 1)]

#     gap_scale = statistics.median(gaps)  # gaps non-empty because n>=5
#     gap_threshold = gap_scale * ALPHA

#     breaks = [i + 1 for i, g in enumerate(gaps) if g > gap_threshold]
#     edges = [0] + breaks + [n]  # slice boundaries

#     best = (0, n - 1)
#     best_size = 0

#     for i in range(len(edges) - 1):
#         start = edges[i]
#         end = edges[i + 1] - 1  # inclusive
#         size = end - start + 1
#         if size > best_size:
#             best = (start, end)
#             best_size = size

#     return best


# CreateHeader()
def build_search_params(query, minPrice, maxPrice, category, condition, page, limit):
    # Base filter
    filter_str = f'price:[{minPrice}..{maxPrice}],priceCurrency:USD'

    # Add condition filter
    if condition:
        if condition == 'new':
            filter_str += ',conditionIds:{1000|1500}' # New, New other
        elif condition == 'used':
            filter_str += ',conditionIds:{2750|2990|3000|4000|5000|6000}' # Used, Very Good, Good, Acceptable

    params = {
        "q": str(query),
        "auto_correct": "KEYWORD",
        "filter" : filter_str,
        "limit": str(limit),
        "offset": f'{200*(page-1)}' #for pagination
    }

    if category:
        params['category_ids'] = category

    return params

def find_segments(prices, ALPHA):
    prices = sorted(p for p in prices if p > 0)
    n = len(prices)
    if n < 5:
        return [(0, n-1)]

    log_prices = [math.log(p) for p in prices]
    gaps = [log_prices[i+1] - log_prices[i] for i in range(n-1)]
    if not gaps:
        return [(0, n-1)]

    gap_scale = statistics.median(gaps)
    gap_threshold = gap_scale * ALPHA

    # gap index -> price boundary (i+1)
    breaks = [i + 1 for i, g in enumerate(gaps) if g > gap_threshold]
    edges = [0] + breaks + [n]

    segments = []
    for i in range(len(edges)-1):
        s = edges[i]
        e = edges[i+1] - 1
        if e >= s:
            segments.append((s, e))
    return segments

def pick_best_segment(prices, segments):
    n = len(prices)
    global_med = statistics.median(prices)

    best = (0, n-1)
    best_score = float("-inf")

    for s, e in segments:
        size = e - s + 1
        if size < 5:
            continue

        width = prices[e] - prices[s]
        seg_med = statistics.median(prices[s:e+1])

        # score: prefer size, avoid razor-thin, avoid far-from-median
        score = (
            math.log(size + 1)
            - 0.6 * math.log(width + 2)
            - 0.01 * abs(seg_med - global_med)
        )

        if score > best_score:
            best_score = score
            best = (s, e)

    return best


def compute_price_range(prices, ALPHA):
    prices = sorted(p for p in prices if p > 0)
    n = len(prices)
    if n < 5:
        return (0.0, 0.0)

    segments = find_segments(prices, ALPHA)
    s, e = pick_best_segment(prices, segments)

    # Coverage gate: if segment too small, fallback to quantiles
    coverage = (e - s + 1) / n
    if coverage < 0.65:
        lo = prices[int(0.2 * (n-1))]
        hi = prices[int(0.8 * (n-1))]
    else:
        lo, hi = prices[s], prices[e]

    # Pad the range so it’s not tiny
    width = hi - lo
    pad = max(3.0, 0.1 * width)   # $3 or 10%
    return max(0.0, lo - pad), hi + pad