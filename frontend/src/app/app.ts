import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { CATEGORY_OPTIONS } from './core/constants/app.constants';
import { HistoryEntry } from './core/models/search.models';
import { HistoryService } from './services/history.service';
import { ShellSearchService } from './services/shell-search.service';
import { BodyScrollService } from './services/body-scroll.service';
import { ToastService } from './services/toast.service';

/** Keep the nav pinned until the user is meaningfully past the top of the page. */
const NAV_HIDE_AFTER_PX = 88;
/** Ignore scroll jitter so the nav doesn't flicker on small movements. */
const NAV_SCROLL_DELTA_PX = 6;

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  readonly shellSearch = inject(ShellSearchService);
  readonly toastService = inject(ToastService);
  private readonly historyService = inject(HistoryService);
  private readonly bodyScroll = inject(BodyScrollService);
  private readonly ngZone = inject(NgZone);
  private readonly router = inject(Router);

  readonly categoryOptions = CATEGORY_OPTIONS;

  showHistory = false;
  history: HistoryEntry[] = [];
  private historySub: Subscription | null = null;
  private routerSub: Subscription | null = null;

  @ViewChild('appNav') private navRef?: ElementRef<HTMLElement>;
  private mobileQuery: MediaQueryList | null = null;
  private lastScrollY = 0;
  private scrollQueued = false;
  private navHidden = false;

  ngOnInit(): void {
    this.historySub = this.shellSearch.historyOpen$.subscribe((open) => {
      this.showHistory = open;
      if (open) {
        this.history = this.historyService.getHistory();
        this.bodyScroll.lock('history');
        this.setNavHidden(false);
      } else {
        this.bodyScroll.unlock('history');
      }
    });

    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.lastScrollY = window.scrollY;
        this.setNavHidden(false);
      });
  }

  ngAfterViewInit(): void {
    this.mobileQuery = window.matchMedia('(max-width: 768px)');
    this.mobileQuery.addEventListener('change', this.onMobileChange);
    this.lastScrollY = window.scrollY;

    // Scroll fires constantly; keep it out of Angular and touch the class directly.
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngOnDestroy(): void {
    this.historySub?.unsubscribe();
    this.routerSub?.unsubscribe();
    window.removeEventListener('scroll', this.onScroll);
    this.mobileQuery?.removeEventListener('change', this.onMobileChange);
    this.bodyScroll.unlock('history');
  }

  private readonly onMobileChange = (): void => {
    if (!this.mobileQuery?.matches) {
      this.setNavHidden(false);
    }
  };

  private readonly onScroll = (): void => {
    if (this.scrollQueued) return;
    this.scrollQueued = true;
    requestAnimationFrame(() => {
      this.scrollQueued = false;
      this.updateNavVisibility();
    });
  };

  private updateNavVisibility(): void {
    const y = Math.max(0, window.scrollY);
    const delta = y - this.lastScrollY;
    if (Math.abs(delta) < NAV_SCROLL_DELTA_PX) return;
    this.lastScrollY = y;

    // Desktop keeps the nav pinned, and a locked body means a modal owns the screen.
    if (!this.mobileQuery?.matches || this.bodyScroll.isLocked) {
      this.setNavHidden(false);
      return;
    }

    this.setNavHidden(y > NAV_HIDE_AFTER_PX && delta > 0);
  }

  private setNavHidden(hidden: boolean): void {
    if (hidden === this.navHidden) return;
    this.navHidden = hidden;
    this.navRef?.nativeElement.classList.toggle('is-hidden', hidden);
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
