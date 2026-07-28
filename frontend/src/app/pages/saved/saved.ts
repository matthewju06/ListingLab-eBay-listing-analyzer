import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { CATEGORY_OPTIONS } from '../../core/constants/app.constants';
import { SavedSearch } from '../../core/models/persistence.models';
import { SavedService } from '../../services/saved.service';
import { ShellSearchService } from '../../services/shell-search.service';

@Component({
  selector: 'app-saved',
  imports: [CommonModule],
  templateUrl: './saved.html',
  styleUrl: '../persistence-shared.scss',
})
export class SavedComponent implements OnInit {
  private readonly savedService = inject(SavedService);
  private readonly shellSearch = inject(ShellSearchService);
  private readonly router = inject(Router);

  readonly items = signal<SavedSearch[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.savedService.list().subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.items.set([]);
        this.error.set(err.message || 'Failed to load saved searches');
        this.loading.set(false);
      },
    });
  }

  categoryLabel(categoryId: string | null): string {
    if (!categoryId) return 'Any category';
    return CATEGORY_OPTIONS.find((c) => c.id === categoryId)?.name || categoryId;
  }

  conditionLabel(condition: string | null): string {
    if (!condition) return 'Any condition';
    return condition;
  }

  priceLabel(item: SavedSearch): string {
    if (item.maxPrice != null && item.maxPrice !== '') {
      return `$${item.minPrice || '0'} – $${item.maxPrice}`;
    }
    return 'Auto price';
  }

  displayTitle(item: SavedSearch): string {
    return item.name?.trim() || item.query;
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  runSearch(item: SavedSearch): void {
    this.shellSearch.query = item.query;
    this.shellSearch.category = item.category || '';
    this.shellSearch.condition = item.condition || '';

    const hasRange = item.maxPrice != null && item.maxPrice !== '';
    if (hasRange) {
      this.shellSearch.submitSearch({
        minPrice: item.minPrice || '0',
        maxPrice: item.maxPrice || '',
      });
    } else {
      this.shellSearch.submitAutoSearch(false);
    }
  }

  remove(item: SavedSearch): void {
    if (!confirm(`Delete saved search “${this.displayTitle(item)}”?`)) return;
    this.busyId.set(item.id);
    this.error.set(null);
    this.savedService.remove(item.id).subscribe({
      next: () => {
        this.items.update((rows) => rows.filter((r) => r.id !== item.id));
        this.busyId.set(null);
      },
      error: (err: Error) => {
        this.error.set(err.message || 'Failed to delete');
        this.busyId.set(null);
      },
    });
  }

  goHome(): void {
    void this.router.navigateByUrl('/');
  }
}
