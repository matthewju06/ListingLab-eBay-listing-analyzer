import { Injectable, inject } from '@angular/core';
import { IsActiveMatchOptions, NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Subject, filter } from 'rxjs';

import { HistoryEntry } from '../core/models/search.models';

export interface ShellSearchState {
  query: string;
  category: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
}

const DEFAULT_STRENGTH = 4;

const EXACT_URL_MATCH: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'exact',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

@Injectable({ providedIn: 'root' })
export class ShellSearchService {
  private readonly router = inject(Router);

  query = '';
  category = '';
  condition = '';

  private readonly historyOpenSubject = new BehaviorSubject<boolean>(false);
  readonly historyOpen$ = this.historyOpenSubject.asObservable();

  /** Fires when search is re-submitted with the same URL (Angular skips navigation). */
  private readonly forceSearchSubject = new Subject<void>();
  readonly forceSearch$ = this.forceSearchSubject.asObservable();

  constructor() {
    this.syncFromUrl(this.router.url);
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      this.syncFromUrl(e.urlAfterRedirects);
    });
  }

  openHistory(): void {
    this.historyOpenSubject.next(true);
  }

  closeHistory(): void {
    this.historyOpenSubject.next(false);
  }

  submitSearch(options?: { minPrice?: string; maxPrice?: string; replaceUrl?: boolean }): void {
    const q = this.query.trim();
    if (!q) return;
    if (q.length > 80) return;

    const minPrice = options?.minPrice ?? '';
    const maxPrice = options?.maxPrice ?? '';
    const queryParams = this.buildQueryParams(q, minPrice, maxPrice);
    const target = this.router.createUrlTree(['/search'], { queryParams });
    const sameUrl = this.router.isActive(target, EXACT_URL_MATCH);

    void this.router.navigateByUrl(target, { replaceUrl: options?.replaceUrl ?? false }).then(() => {
      if (sameUrl) {
        this.forceSearchSubject.next();
      }
    });
  }

  /** Clear price refine and re-run Auto. */
  submitAutoSearch(replaceUrl = true): void {
    this.submitSearch({ minPrice: '', maxPrice: '', replaceUrl });
  }

  submitRefinedSearch(minPrice: string, maxPrice: string, replaceUrl = true): void {
    this.submitSearch({ minPrice, maxPrice, replaceUrl });
  }

  restoreHistory(entry: HistoryEntry): void {
    this.query = entry.query;
    this.category = entry.category || '';
    this.condition = entry.condition || '';
    this.closeHistory();

    const hasRange =
      (entry.maxPrice != null && entry.maxPrice !== '') ||
      entry.priceMode === 'specific';

    if (hasRange) {
      this.submitSearch({
        minPrice: entry.minPrice || '0',
        maxPrice: entry.maxPrice || '',
      });
    } else {
      this.submitAutoSearch(false);
    }
  }

  buildQueryParams(
    query: string,
    minPrice = '',
    maxPrice = '',
  ): Record<string, string | number | null> {
    const refined = maxPrice !== '';
    return {
      q: query,
      category: this.category || null,
      condition: this.condition || null,
      minPrice: refined ? minPrice || '0' : null,
      maxPrice: refined ? maxPrice : null,
      filterStrength: refined ? null : DEFAULT_STRENGTH,
    };
  }

  private syncFromUrl(url: string): void {
    const tree = this.router.parseUrl(url);
    const params = tree.queryParams;
    const path =
      tree.root.children['primary']?.segments.map((segment) => segment.path).join('/') ?? '';

    if (path === 'search') {
      if (params['q'] != null) {
        this.query = String(params['q']);
      }
      this.category = params['category'] != null ? String(params['category']) : '';
      this.condition = params['condition'] != null ? String(params['condition']) : '';
      return;
    }

    if (params['q'] != null) {
      this.query = String(params['q']);
    }
  }
}
