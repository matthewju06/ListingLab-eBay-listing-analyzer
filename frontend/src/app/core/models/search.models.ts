export interface ItemSummary {
  title: string | null;
  /** Delivered total: item + shipping (used for comps / charts). */
  price: string;
  itemPrice?: string | null;
  shippingCost?: number | null;
  /** True when shipping was imputed from the result-set median. */
  shippingEstimated?: boolean;
  condition: string | null;
  itemWebUrl: string | null;
  username: string | null;
  feedbackPercentage: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  itemCreationDate: string | null;
}

export interface SearchRequest {
  query: string;
  minPrice: string;
  maxPrice: string;
  category: string | null;
  condition: string | null;
  filterStrength: number;
}

export interface SearchResponse {
  itemSummaries: ItemSummary[];
  appliedMinPrice?: number | null;
  appliedMaxPrice?: number | null;
  suggestedMinPrice?: number | null;
  suggestedMaxPrice?: number | null;
  /** Fraction of listings in the suggested cluster, 0–1. */
  suggestedCoverage?: number | null;
}

/** @deprecated Prefer auto vs refined via presence of maxPrice */
export type PriceMode = 'auto' | 'specific';

export interface SearchFilters {
  category: string;
  condition: string;
  /** When maxPrice is set, search uses a fixed range (refine). */
  minPrice: string;
  maxPrice: string;
}

export interface HistoryEntry {
  query: string;
  category: string;
  condition: string;
  categoryLabel: string;
  conditionLabel: string;
  timestamp: string;
  minPrice?: string;
  maxPrice?: string;
  /** Legacy fields from older history entries */
  priceMode?: PriceMode;
  filterStrength?: number;
}

export interface PriceMetrics {
  total: number;
  avg: number;
  median: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  p10: number;
  p90: number;
  /** Adjusted Fisher-Pearson sample skewness. */
  skewness: number;
}
