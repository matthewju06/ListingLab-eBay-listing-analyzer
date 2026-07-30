import { ItemSummary, PriceMetrics } from '../models/search.models';

export function parsePrice(item: ItemSummary): number {
  const val = item.price;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? NaN : parsed;
}

export function formatPrice(price: string | null | undefined): string {
  if (!price) return 'N/A';
  return `$${price}`;
}

export function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function computeMetrics(items: ItemSummary[]): PriceMetrics | null {
  const prices = items.map(parsePrice).filter((p) => !isNaN(p));
  if (!prices.length) return null;

  const sorted = [...prices].sort((a, b) => a - b);
  const quantile = (p: number): number => {
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  // Adjusted Fisher-Pearson coefficient. Require enough observations for it to
  // be meaningful; a constant distribution has zero skew.
  let skewness = 0;
  if (prices.length >= 3) {
    const sumSquared = prices.reduce((sum, price) => sum + (price - avg) ** 2, 0);
    const sampleStdDev = Math.sqrt(sumSquared / (prices.length - 1));
    if (sampleStdDev > 0) {
      const n = prices.length;
      const standardizedCubeSum = prices.reduce(
        (sum, price) => sum + ((price - avg) / sampleStdDev) ** 3,
        0,
      );
      skewness = (n / ((n - 1) * (n - 2))) * standardizedCubeSum;
    }
  }

  return {
    total: items.length,
    avg,
    median,
    min: Math.min(...prices),
    max: Math.max(...prices),
    q1: quantile(0.25),
    q3: quantile(0.75),
    p10: quantile(0.1),
    p90: quantile(0.9),
    skewness,
  };
}

export function downloadCsv(items: ItemSummary[], query: string): void {
  if (!items.length) return;

  const headers = [
    '#',
    'Title',
    'Total (item+ship)',
    'Item Price',
    'Shipping',
    'Shipping Estimated',
    'Condition',
    'Link',
    'Seller',
    'Category',
  ];
  const rows = items.map((item, idx) => [
    idx + 1,
    item.title || 'N/A',
    formatPrice(item.price),
    formatPrice(item.itemPrice ?? item.price),
    item.shippingCost != null ? `$${Number(item.shippingCost).toFixed(2)}` : 'N/A',
    item.shippingEstimated ? 'yes' : 'no',
    item.condition || 'N/A',
    item.itemWebUrl || 'N/A',
    item.username ? `${item.username} (${item.feedbackPercentage}%)` : 'N/A',
    item.categoryName || 'N/A',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${query.replace(/[^a-z0-9]/gi, '_')}_results.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function createHistogramData(prices: number[]): { labels: string[]; data: number[] } {
  if (!prices.length) return { labels: [], data: [] };

  const min = Math.floor(Math.min(...prices));
  const max = Math.ceil(Math.max(...prices));
  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const n = prices.length;

  let binCount = 20;
  if (iqr > 0) {
    const binWidth = 2 * iqr * Math.pow(n, -1 / 3);
    binCount = Math.ceil((max - min) / binWidth);
  }
  binCount = Math.max(5, Math.min(15, binCount));

  const range = max - min || 1;
  const step = range / binCount;
  const bins = new Array(binCount).fill(0);
  const labels = bins.map((_, i) => {
    const start = min + i * step;
    const end = start + step;
    return `$${start.toFixed(0)} - $${end.toFixed(0)}`;
  });

  prices.forEach((p) => {
    let bucket = Math.floor((p - min) / step);
    if (bucket >= binCount) bucket = binCount - 1;
    bins[bucket]++;
  });

  return { labels, data: bins };
}
