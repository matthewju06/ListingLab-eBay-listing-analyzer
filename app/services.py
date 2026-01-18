import statistics
from .clients import search_item #services -> clients

def filter_items(items):
    if not items:
        return items
    
    # Gives back a float version of the given item
    def price_int(item):
        try:
            return float(item.get('price', {}).get('value', 0))
        except:
            return 0.0

    # First we will sort items since best match comes unsorted
    items = sorted(items, key = price_int)
    
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

    
    # Calculate quartiles
    q1 = statistics.quantiles(prices, n=4)[0]
    q3 = statistics.quantiles(prices, n=4)[2]
    iqr = q3 - q1
    
    upper_bound = q3 + (1.2 * iqr)
    lower_bound = q1 - (1.2 * iqr)

    # Return filtered items based on price and if seller score is realistic (above 75%)
    def is_valid(item):
        try:
            price = float(item.get('price', {}).get('value', 0))
            score = float(item.get('seller', {}).get('feedbackPercentage', 0))
            return lower_bound <= price <= upper_bound and score > 0.0
        except:
            return False


    return [item for item in items if is_valid(item)]


def get_items(query, minPrice, maxPrice, category=None, condition=None):
    page = 1
    curr_page_items = search_item(query, minPrice, maxPrice, page, category, condition)
    
    final_items_list = []

    while (len(curr_page_items) > 0 and page <= 5):
        final_items_list.extend(curr_page_items)

        if (len(curr_page_items) < 200):
            break

        page += 1
        curr_page_items = search_item(query, minPrice, maxPrice, page, category, condition)

    return filter_items(final_items_list)