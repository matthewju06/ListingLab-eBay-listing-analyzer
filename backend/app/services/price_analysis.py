import logging
import math
import statistics

logger = logging.getLogger(__name__)

EXCLUDE_KEYWORDS = {"broken"}


def extract_prices(items: list[dict]) -> list[float]:
    prices: list[float] = []
    for item in items:
        try:
            val = item["price"]
            if val:
                p = float(val)
                if p > 0:
                    prices.append(p)
        except (ValueError, TypeError, KeyError):
            continue
    return prices


def apply_iqr(items: list[dict]) -> list[dict]:
    prices = extract_prices(items)
    if not prices or len(prices) < 15:
        return items

    prices = sorted(prices)
    q1, _, q3 = statistics.quantiles(prices, n=4, method="inclusive")
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    def is_valid(item: dict) -> bool:
        try:
            price = float(item["price"])
            return lower <= price <= upper
        except (ValueError, TypeError):
            return False

    return [item for item in items if is_valid(item)]


def find_segments(prices: list[float], alpha: float) -> list[tuple[int, int]]:
    prices = sorted(p for p in prices if p > 0)
    n = len(prices)
    if n < 5:
        return [(0, n - 1)]

    log_prices = [math.log(p) for p in prices]
    gaps = [log_prices[i + 1] - log_prices[i] for i in range(n - 1)]
    if not gaps:
        return [(0, n - 1)]

    gap_scale = statistics.median(gaps)
    gap_threshold = gap_scale * alpha
    breaks = [i + 1 for i, g in enumerate(gaps) if g > gap_threshold]
    edges = [0] + breaks + [n]

    segments: list[tuple[int, int]] = []
    for i in range(len(edges) - 1):
        s = edges[i]
        e = edges[i + 1] - 1
        if e >= s:
            segments.append((s, e))
    return segments


def pick_best_segment(prices: list[float], segments: list[tuple[int, int]]) -> tuple[int, int]:
    n = len(prices)
    global_med = statistics.median(prices)
    best = (0, n - 1)
    best_score = float("-inf")

    for s, e in segments:
        size = e - s + 1
        if size < 5:
            continue

        width = prices[e] - prices[s]
        seg_med = statistics.median(prices[s : e + 1])
        score = (
            math.log(size + 1)
            - 0.6 * math.log(width + 2)
            - 0.01 * abs(seg_med - global_med)
        )

        if score > best_score:
            best_score = score
            best = (s, e)

    return best


def compute_price_range(prices: list[float], alpha: float) -> tuple[float, float]:
    """Legacy helper: always returns a band (used by older auto-clamp path)."""
    suggestion = suggest_price_cluster(prices, alpha)
    if suggestion is None:
        return (0.0, 0.0)
    return suggestion[0], suggestion[1]


def suggest_price_cluster(
    prices: list[float],
    alpha: float,
) -> tuple[float, float, float] | None:
    """Return the densest log-gap cluster as a padded band plus coverage share.

    Returns ``(lo, hi, coverage)`` where ``coverage`` is in ``[0, 1]`` (fraction of
    listings in the chosen cluster). Returns None when there aren't enough prices.
    """
    prices = sorted(p for p in prices if p > 0)
    n = len(prices)
    if n < 5:
        return None

    segments = find_segments(prices, alpha)
    s, e = pick_best_segment(prices, segments)
    coverage = (e - s + 1) / n

    lo, hi = prices[s], prices[e]
    width = hi - lo
    pad = max(3.0, 0.1 * width)
    return max(0.0, lo - pad), hi + pad, coverage
