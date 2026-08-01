import { Injectable, signal } from '@angular/core';

export type ToastKind = 'error' | 'info';

export interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
  durationMs: number;
}

const DEFAULT_DURATION_MS = 5600;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toast = signal<ToastState | null>(null);
  private readonly _progress = signal(1);
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;
  private seq = 0;

  readonly toast = this._toast.asReadonly();
  readonly progress = this._progress.asReadonly();

  error(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.show(message, 'info', durationMs);
  }

  show(message: string, kind: ToastKind = 'error', durationMs = DEFAULT_DURATION_MS): void {
    const trimmed = message.trim();
    if (!trimmed) return;

    this.clearTimers();
    const id = ++this.seq;
    this._toast.set({ id, message: trimmed, kind, durationMs });
    this._progress.set(1);

    const started = performance.now();
    const tick = (now: number) => {
      const current = this._toast();
      if (!current || current.id !== id) return;

      const elapsed = now - started;
      const remaining = Math.max(0, 1 - elapsed / durationMs);
      this._progress.set(remaining);

      if (remaining <= 0) {
        this.dismiss(id);
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);

    this.dismissTimer = setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id?: number): void {
    const current = this._toast();
    if (!current) return;
    if (id != null && current.id !== id) return;
    this.clearTimers();
    this._toast.set(null);
    this._progress.set(1);
  }

  private clearTimers(): void {
    if (this.dismissTimer != null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
