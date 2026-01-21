import math, statistics
from .clients import search_item #services -> clients

# def IQR_filter(items):
#     # First we will sort items since best match comes unsorted
#     sort_items(items)
    
#     # Safer extraction that checks for price existence
#     prices = get_prices(items)

#     # Calculate quartiles
#     q1 = statistics.quantiles(prices, n=4)[0]
#     q3 = statistics.quantiles(prices, n=4)[2]
#     iqr = q3 - q1
    
#     upper_bound = q3 + (1 * iqr)
#     lower_bound = q1 - (0.7 * iqr)

#     # Return filtered items based on price and if seller score is realistic (above 75%)
#     def is_valid(item):
#         try:
#             price = float(item.get('price', {}).get('value', 0))
#             score = float(item.get('seller', {}).get('feedbackPercentage', 0))
#             return lower_bound <= price <= upper_bound and score > 95
#         except:
#             return False


#     return [item for item in items if is_valid(item)]

def filter_items(items):
    if not items:
        return items
    
    def is_valid(item):
        try:
            score = float(item.get('seller', {}).get('feedbackPercentage', 0))
            return score > 95
        except:
            return False

    items = [item for item in items if is_valid(item)]

    # Gives back a float version of the given item
    def get_price(item):
        try:
            return float(item.get('price', {}).get('value', 0))
        except (ValueError, TypeError):
            return 0.0
    
    items = sorted(items, key = get_price)
    return items


def get_prices(items):
    if not items:
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


# Called by Flask app
def get_items(query, minPrice, maxPrice, category, condition, filterStrength):
#   search_item(query, minPrice, maxPrice, category, condition = None, page = 1, limit = 200)
    if minPrice == '':
        minPrice = '0'

    if minPrice == '0' and maxPrice == '':
        sample = filter_items(search_item(query, minPrice, maxPrice, category, condition, limit = 50))
        prices = get_prices(sample)
        if prices:
            segment = get_segment(prices, filterStrength)
            if (segment[1] - segment[0]) / len(prices) < 0.6:
                sample = filter_items(search_item(query, minPrice, maxPrice, category, condition, limit=100))
                prices = get_prices(sample)
                segment = get_segment(prices, filterStrength)

            minPrice, maxPrice = calculate_range(prices, segment)

    # Pagination
    final_items = []
    page = 1
    while page <= 3:
        page_items = search_item(query, minPrice, maxPrice, category, condition, page)
        if not page_items:
            break
        final_items.extend(page_items)
        if len(page_items) < 200:
            break
        page += 1

    return filter_items(final_items)