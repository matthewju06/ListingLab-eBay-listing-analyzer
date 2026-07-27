import { Injectable } from '@angular/core';

import { HISTORY_KEY, MAX_HISTORY } from '../core/constants/app.constants';
import { HistoryEntry } from '../core/models/search.models';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  getHistory(): HistoryEntry[] {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  saveEntry(entry: HistoryEntry): void {
    const history = this.getHistory().filter(
      (h) => h.query.toLowerCase() !== entry.query.toLowerCase(),
    );
    history.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  }

  clearHistory(): void {
    localStorage.removeItem(HISTORY_KEY);
  }
}
