import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { API_BASE_URL } from '../core/constants/app.constants';
import { SearchRequest, SearchResponse } from '../core/models/search.models';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);

  search(request: SearchRequest): Observable<SearchResponse> {
    let params = new HttpParams().set('query', request.query);

    if (request.minPrice !== undefined) {
      params = params.set('minPrice', request.minPrice ?? '');
    }
    if (request.maxPrice !== undefined) {
      params = params.set('maxPrice', request.maxPrice ?? '');
    }
    if (request.category) {
      params = params.set('category', request.category);
    }
    if (request.condition) {
      params = params.set('condition', request.condition);
    }
    params = params.set('filterStrength', String(request.filterStrength));

    return this.http
      .get<SearchResponse>(`${API_BASE_URL}/search`, { params })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message =
      typeof error.error === 'object' && error.error?.detail
        ? Array.isArray(error.error.detail)
          ? error.error.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ')
          : error.error.detail
        : error.message || 'Search failed';
    return throwError(() => new Error(typeof message === 'string' ? message : 'Search failed'));
  }
}
