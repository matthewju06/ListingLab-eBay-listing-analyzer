import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';

import { CATEGORY_OPTIONS } from './core/constants/app.constants';
import { HistoryEntry } from './core/models/search.models';
import { HistoryService } from './services/history.service';
import { ShellSearchService } from './services/shell-search.service';
import { BodyScrollService } from './services/body-scroll.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  readonly shellSearch = inject(ShellSearchService);
  private readonly historyService = inject(HistoryService);
  private readonly bodyScroll = inject(BodyScrollService);

  readonly categoryOptions = CATEGORY_OPTIONS;

  showHistory = false;
  history: HistoryEntry[] = [];
  private historySub: Subscription | null = null;

  ngOnInit(): void {
    this.historySub = this.shellSearch.historyOpen$.subscribe((open) => {
      this.showHistory = open;
      if (open) {
        this.history = this.historyService.getHistory();
        this.bodyScroll.lock('history');
      } else {
        this.bodyScroll.unlock('history');
      }
    });
  }

  ngOnDestroy(): void {
    this.historySub?.unsubscribe();
    this.bodyScroll.unlock('history');
  }

  onSearchSubmit(event: Event): void {
    event.preventDefault();
    this.shellSearch.submitSearch();
  }

  openHistory(): void {
    this.shellSearch.openHistory();
  }

  closeHistory(): void {
    this.shellSearch.closeHistory();
  }

  clearHistory(): void {
    this.historyService.clearHistory();
    this.history = [];
  }

  restoreHistory(entry: HistoryEntry): void {
    this.shellSearch.restoreHistory(entry);
  }

  historyPriceInfo(entry: HistoryEntry): string {
    const max = entry.maxPrice;
    if ((max != null && max !== '') || entry.priceMode === 'specific') {
      return `$${entry.minPrice || '0'} – $${max || '∞'}`;
    }
    return 'Auto';
  }
}
