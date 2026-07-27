import { Injectable } from '@angular/core';

/** Reference-counted body scroll lock so shell + page modals don't fight. */
@Injectable({ providedIn: 'root' })
export class BodyScrollService {
  private readonly locks = new Set<string>();

  lock(id: string): void {
    this.locks.add(id);
    this.apply();
  }

  unlock(id: string): void {
    this.locks.delete(id);
    this.apply();
  }

  clearAll(): void {
    this.locks.clear();
    this.apply();
  }

  private apply(): void {
    document.body.style.overflow = this.locks.size > 0 ? 'hidden' : '';
  }
}
