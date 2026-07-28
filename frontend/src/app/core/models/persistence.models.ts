/** API uses camelCase JSON (Pydantic aliases). */

export interface SavedSearch {
  id: string;
  userId: string;
  name: string | null;
  query: string;
  category: string | null;
  condition: string | null;
  minPrice: string | null;
  maxPrice: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedSearchCreate {
  name?: string | null;
  query: string;
  category?: string | null;
  condition?: string | null;
  minPrice?: string | null;
  maxPrice?: string | null;
}

export interface SavedSearchUpdate {
  name?: string | null;
  query?: string | null;
  category?: string | null;
  condition?: string | null;
  minPrice?: string | null;
  maxPrice?: string | null;
}

export interface TrackedListing {
  id: string;
  userId: string;
  title: string;
  itemWebUrl: string;
  imageUrl: string | null;
  condition: string | null;
  sellerUsername: string | null;
  lastSeenPrice: number | null;
  targetMinPrice: number | null;
  targetMaxPrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrackedListingCreate {
  title: string;
  itemWebUrl: string;
  imageUrl?: string | null;
  condition?: string | null;
  sellerUsername?: string | null;
  lastSeenPrice?: number | null;
  targetMinPrice?: number | null;
  targetMaxPrice?: number | null;
  notes?: string | null;
}

export interface TrackedListingUpdate {
  title?: string | null;
  itemWebUrl?: string | null;
  imageUrl?: string | null;
  condition?: string | null;
  sellerUsername?: string | null;
  lastSeenPrice?: number | null;
  targetMinPrice?: number | null;
  targetMaxPrice?: number | null;
  notes?: string | null;
}
