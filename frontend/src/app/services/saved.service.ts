import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { API_BASE_URL } from '../core/constants/app.constants';
import {
  SavedSearch,
  SavedSearchCreate,
  SavedSearchUpdate,
} from '../core/models/persistence.models';

@Injectable({ providedIn: 'root' })
export class SavedService {
  private readonly http = inject(HttpClient);

  list(): Observable<SavedSearch[]> {
    return this.http
      .get<SavedSearch[]>(`${API_BASE_URL}/saved-searches`)
      .pipe(catchError(this.handleError));
  }

  create(body: SavedSearchCreate): Observable<SavedSearch> {
    return this.http
      .post<SavedSearch>(`${API_BASE_URL}/saved-searches`, body)
      .pipe(catchError(this.handleError));
  }

  update(id: string, body: SavedSearchUpdate): Observable<SavedSearch> {
    return this.http
      .patch<SavedSearch>(`${API_BASE_URL}/saved-searches/${id}`, body)
      .pipe(catchError(this.handleError));
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete<void>(`${API_BASE_URL}/saved-searches/${id}`)
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
