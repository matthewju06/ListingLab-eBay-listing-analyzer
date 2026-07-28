import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { API_BASE_URL } from '../core/constants/app.constants';
import {
  TrackedListing,
  TrackedListingCreate,
  TrackedListingUpdate,
} from '../core/models/persistence.models';

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly http = inject(HttpClient);

  list(): Observable<TrackedListing[]> {
    return this.http
      .get<TrackedListing[]>(`${API_BASE_URL}/tracked-listings`)
      .pipe(catchError(this.handleError));
  }

  create(body: TrackedListingCreate): Observable<TrackedListing> {
    return this.http
      .post<TrackedListing>(`${API_BASE_URL}/tracked-listings`, body)
      .pipe(catchError(this.handleError));
  }

  update(id: string, body: TrackedListingUpdate): Observable<TrackedListing> {
    return this.http
      .patch<TrackedListing>(`${API_BASE_URL}/tracked-listings/${id}`, body)
      .pipe(catchError(this.handleError));
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete<void>(`${API_BASE_URL}/tracked-listings/${id}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message =
      typeof error.error === 'object' && error.error?.detail
        ? Array.isArray(error.error.detail)
          ? error.error.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ')
          : error.error.detail
        : error.message || 'Request failed';
    return throwError(() => new Error(typeof message === 'string' ? message : 'Request failed'));
  }
}
