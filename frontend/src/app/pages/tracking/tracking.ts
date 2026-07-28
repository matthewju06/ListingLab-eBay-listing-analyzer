import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TrackedListing } from '../../core/models/persistence.models';
import { TrackingService } from '../../services/tracking.service';

@Component({
  selector: 'app-tracking',
  imports: [CommonModule, FormsModule],
  templateUrl: './tracking.html',
  styleUrl: '../persistence-shared.scss',
})
export class TrackingComponent implements OnInit {
  private readonly trackingService = inject(TrackingService);

  readonly items = signal<TrackedListing[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly editingNotesId = signal<string | null>(null);
  readonly notesDraft = signal('');

  formTitle = '';
  formUrl = '';
  formTargetMin = '';
  formTargetMax = '';
  formNotes = '';

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.trackingService.list().subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.items.set([]);
        this.error.set(err.message || 'Failed to load tracked listings');
        this.loading.set(false);
      },
    });
  }

  formatPrice(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `$${value.toFixed(2)}`;
  }

  targetLabel(item: TrackedListing): string {
    const hasMin = item.targetMinPrice != null;
    const hasMax = item.targetMaxPrice != null;
    if (!hasMin && !hasMax) return 'No target range';
    return `${this.formatPrice(item.targetMinPrice)} – ${this.formatPrice(item.targetMaxPrice)}`;
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

  submitManual(event: Event): void {
    event.preventDefault();
    const title = this.formTitle.trim();
    const itemWebUrl = this.formUrl.trim();
    if (!title || !itemWebUrl) {
      this.error.set('Title and eBay URL are required');
      return;
    }

    const targetMinPrice = this.parseOptionalPrice(this.formTargetMin);
    const targetMaxPrice = this.parseOptionalPrice(this.formTargetMax);
    if (targetMinPrice === false || targetMaxPrice === false) {
      this.error.set('Target prices must be valid numbers');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.trackingService
      .create({
        title,
        itemWebUrl,
        targetMinPrice,
        targetMaxPrice,
        notes: this.formNotes.trim() || null,
      })
      .subscribe({
        next: (row) => {
          this.items.update((rows) => [row, ...rows]);
          this.formTitle = '';
          this.formUrl = '';
          this.formTargetMin = '';
          this.formTargetMax = '';
          this.formNotes = '';
          this.saving.set(false);
        },
        error: (err: Error) => {
          this.error.set(err.message || 'Failed to add listing');
          this.saving.set(false);
        },
      });
  }

  startEditNotes(item: TrackedListing): void {
    this.editingNotesId.set(item.id);
    this.notesDraft.set(item.notes || '');
  }

  cancelEditNotes(): void {
    this.editingNotesId.set(null);
    this.notesDraft.set('');
  }

  saveNotes(item: TrackedListing): void {
    const notes = this.notesDraft().trim() || null;
    this.busyId.set(item.id);
    this.error.set(null);
    this.trackingService.update(item.id, { notes }).subscribe({
      next: (updated) => {
        this.items.update((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
        this.busyId.set(null);
        this.cancelEditNotes();
      },
      error: (err: Error) => {
        this.error.set(err.message || 'Failed to update notes');
        this.busyId.set(null);
      },
    });
  }

  remove(item: TrackedListing): void {
    if (!confirm(`Stop tracking “${item.title}”?`)) return;
    this.busyId.set(item.id);
    this.error.set(null);
    this.trackingService.remove(item.id).subscribe({
      next: () => {
        this.items.update((rows) => rows.filter((r) => r.id !== item.id));
        this.busyId.set(null);
        if (this.editingNotesId() === item.id) this.cancelEditNotes();
      },
      error: (err: Error) => {
        this.error.set(err.message || 'Failed to delete');
        this.busyId.set(null);
      },
    });
  }

  private parseOptionalPrice(raw: string): number | null | false {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return false;
    return n;
  }
}
