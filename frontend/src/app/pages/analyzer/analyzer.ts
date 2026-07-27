import { ChangeDetectorRef, Component, OnDestroy, OnInit, computed, inject, NgZone, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { EChartsCoreOption, ECElementEvent } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  ModuleRegistry,
  RowSelectionOptions,
  Theme,
  colorSchemeDark,
  themeQuartz,
} from 'ag-grid-community';
import { Subscription } from 'rxjs';

import { CATEGORY_OPTIONS } from '../../core/constants/app.constants';
import { ItemSummary, PriceMetrics } from '../../core/models/search.models';
import { capitalizeWords, computeMetrics, downloadCsv, formatPrice } from '../../core/utils/search.utils';
import { ChartService } from '../../services/chart.service';
import { HistoryService } from '../../services/history.service';
import { SearchService } from '../../services/search.service';
import { ShellSearchService } from '../../services/shell-search.service';
import { BodyScrollService } from '../../services/body-scroll.service';

ModuleRegistry.registerModules([AllCommunityModule]);

interface ChartClickData {
  itemIndex?: number;
  url?: string | null;
  title?: string;
  binMin?: number;
  binMax?: number;
  name?: string;
}

export interface ListingRow {
  rowIndex: number;
  title: string;
  price: number;
  condition: string;
  itemWebUrl: string | null;
  username: string;
  feedbackPercentage: number | null;
  categoryName: string;
  imageUrl: string | null;
}

const PLACEHOLDER_IMAGE = 'https://img.icons8.com/office40/512/cancel-2.png';
const DEFAULT_STRENGTH = 4;

@Component({
  selector: 'app-analyzer',
  imports: [CommonModule, FormsModule, NgxEchartsDirective, AgGridAngular],
  templateUrl: './analyzer.html',
  styleUrl: './analyzer.scss',
})
export class AnalyzerComponent implements OnInit, OnDestroy {
  private readonly searchService = inject(SearchService);
  private readonly historyService = inject(HistoryService);
  private readonly shellSearch = inject(ShellSearchService);
  private readonly chartService = inject(ChartService);
  private readonly bodyScroll = inject(BodyScrollService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private gridApi: GridApi<ListingRow> | null = null;
  private expandedGridApi: GridApi<ListingRow> | null = null;
  private queryParamsSub: Subscription | null = null;
  private forceSearchSub: Subscription | null = null;
  private lastSearchKey = '';
  private resizeSettleTimers: ReturnType<typeof setTimeout>[] = [];
  private readonly onViewportResize = (): void => this.syncViewportMode();

  /** True below the mobile results breakpoint — drives @if mount (not display:none). */
  readonly isMobileUi = signal(false);

  readonly categoryOptions = CATEGORY_OPTIONS;

  query = '';
  category = '';
  condition = '';
  minPrice = '';
  maxPrice = '';

  refineMinPrice = '';
  refineMaxPrice = '';
  appliedMinPrice: number | null = null;
  appliedMaxPrice: number | null = null;

  items: ItemSummary[] = [];
  rowData: ListingRow[] = [];
  metrics: PriceMetrics | null = null;
  loading = false;
  error = '';
  filterMessage = '';
  highlightedRow: number | null = null;
  readonly expandedChart = signal<'seller' | 'date' | null>(null);
  readonly expandedTable = signal(false);
  readonly previewListing = signal<ListingRow | null>(null);

  /** Mobile results: sort / filter (desktop uses AG Grid). */
  mobileSortBy: 'price' | 'title' | 'condition' | 'username' | 'feedbackPercentage' = 'price';
  mobileSortOrder: 'asc' | 'desc' = 'asc';
  mobileFilterInclude = '';
  mobileFilterExclude = '';
  mobileFilterMin = '';
  mobileFilterMax = '';

  histogramOptions: EChartsCoreOption = {};
  donutOptions: EChartsCoreOption = {};
  sellerScatterOptions: EChartsCoreOption = {};
  dateScatterOptions: EChartsCoreOption = {};

  readonly gridContext = {
    openListingPreview: (row: ListingRow) => this.openListingPreview(row),
  };

  readonly defaultSellerAvatar =
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="32" fill="#404040"/>
        <circle cx="32" cy="24" r="12" fill="#808080"/>
        <path d="M10 56c4-12 14-18 22-18s18 6 22 18" fill="#808080"/>
      </svg>`,
    );

  readonly gridTheme: Theme = themeQuartz.withPart(colorSchemeDark).withParams({
    backgroundColor: '#1a1a1a',
    foregroundColor: '#bcbcbc',
    headerBackgroundColor: '#333333',
    headerFontWeight: 600,
    oddRowBackgroundColor: '#252525',
    rowHoverColor: '#333333',
    selectedRowBackgroundColor: 'rgba(0, 100, 210, 0.28)',
    accentColor: '#0064D2',
    borderColor: '#333333',
    browserColorScheme: 'dark',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize: 13,
    headerFontSize: 12,
    spacing: 6,
    borderRadius: 8,
    headerColumnBorder: { color: '#555555' },
    headerColumnBorderHeight: '70%',
    headerColumnResizeHandleColor: '#9a9a9a',
    headerColumnResizeHandleWidth: 2,
    headerColumnResizeHandleHeight: '55%',
    columnBorder: { color: '#2f2f2f' },
  });

  readonly defaultColDef: ColDef<ListingRow> = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    minWidth: 80,
  };

  readonly rowSelection: RowSelectionOptions = {
    mode: 'singleRow',
    checkboxes: false,
    enableClickSelection: true,
  };

  readonly columnDefs: ColDef<ListingRow>[] = [
    {
      headerName: 'Preview',
      field: 'imageUrl',
      width: 108,
      maxWidth: 120,
      minWidth: 96,
      sortable: false,
      filter: false,
      floatingFilter: false,
      cellClass: 'preview-cell',
      cellRenderer: (params: ICellRendererParams<ListingRow, string | null>) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'listing-thumb-btn';
        button.title = 'Open listing preview';
        button.setAttribute('aria-label', 'Open listing preview');

        const img = document.createElement('img');
        img.src = params.value || PLACEHOLDER_IMAGE;
        img.alt = params.data?.title || 'Listing image';
        img.loading = 'lazy';
        button.appendChild(img);

        const badge = document.createElement('span');
        badge.className = 'listing-thumb-badge';
        badge.setAttribute('aria-hidden', 'true');
        badge.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
        button.appendChild(badge);

        button.addEventListener('click', (event) => {
          event.stopPropagation();
          if (params.data) {
            (params.context as { openListingPreview: (row: ListingRow) => void }).openListingPreview(
              params.data,
            );
          }
        });

        return button;
      },
    },
    {
      headerName: 'Title',
      field: 'title',
      flex: 2,
      minWidth: 220,
    },
    {
      headerName: 'Price',
      field: 'price',
      width: 130,
      filter: 'agNumberColumnFilter',
      filterParams: {
        filterOptions: ['inRange', 'equals', 'greaterThan', 'lessThan'],
        defaultOption: 'inRange',
        maxNumConditions: 1,
      },
      valueFormatter: (p) => formatPrice(p.value),
    },
    {
      headerName: 'Condition',
      field: 'condition',
      width: 170,
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'notContains', 'equals'],
        defaultOption: 'contains',
        maxNumConditions: 2,
      },
    },
    {
      headerName: 'Seller',
      field: 'username',
      width: 110,
      maxWidth: 130,
    },
    {
      headerName: 'Feedback',
      field: 'feedbackPercentage',
      width: 100,
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => (p.value == null ? 'N/A' : `${p.value}%`),
    },
  ];

  formatPrice = formatPrice;
  capitalizeWords = capitalizeWords;

  get hasResults(): boolean {
    return this.items.length > 0;
  }

  get isRefined(): boolean {
    return this.maxPrice !== '';
  }

  get mobileSortedRows(): ListingRow[] {
    let rows = [...this.rowData];
    const include = this.mobileFilterInclude.trim().toLowerCase();
    const exclude = this.mobileFilterExclude.trim().toLowerCase();
    const min = this.mobileFilterMin !== '' ? Number(this.mobileFilterMin) : null;
    const max = this.mobileFilterMax !== '' ? Number(this.mobileFilterMax) : null;
    const useNumericRange =
      this.mobileSortBy === 'price' || this.mobileSortBy === 'feedbackPercentage';

    if (useNumericRange) {
      rows = rows.filter((r) => {
        const value = this.mobileSortBy === 'price' ? r.price : r.feedbackPercentage;
        if (value == null || Number.isNaN(Number(value))) {
          return min == null && max == null;
        }
        const n = Number(value);
        if (min != null && !Number.isNaN(min) && n < min) return false;
        if (max != null && !Number.isNaN(max) && n > max) return false;
        return true;
      });
    } else {
      const field = this.mobileSortBy as 'title' | 'condition' | 'username';
      if (include || exclude) {
        rows = rows.filter((r) => {
          const value = String(r[field] ?? '').toLowerCase();
          if (include && !value.includes(include)) return false;
          if (exclude && value.includes(exclude)) return false;
          return true;
        });
      }
    }

    const dir = this.mobileSortOrder === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[this.mobileSortBy];
      const bv = b[this.mobileSortBy];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * dir;
    });
    return rows;
  }

  get mobileUsesNumericFilter(): boolean {
    return this.mobileSortBy === 'price' || this.mobileSortBy === 'feedbackPercentage';
  }

  get mobileNumericFilterUnit(): string {
    return this.mobileSortBy === 'feedbackPercentage' ? '%' : '$';
  }

  get mobileTextFilterFieldLabel(): string {
    switch (this.mobileSortBy) {
      case 'condition':
        return 'condition';
      case 'username':
        return 'seller';
      default:
        return 'title';
    }
  }

  readonly expandedChartTitle = computed(() =>
    this.expandedChart() === 'seller' ? 'Price vs Seller Score' : 'Price by Listing Date',
  );

  readonly expandedChartOptions = computed(() =>
    this.expandedChart() === 'seller' ? this.sellerScatterOptions : this.dateScatterOptions,
  );

  getRowId = (params: GetRowIdParams<ListingRow>): string => String(params.data.rowIndex);

  ngOnInit(): void {
    this.isMobileUi.set(this.isMobileViewport());
    window.addEventListener('resize', this.onViewportResize, { passive: true });

    this.queryParamsSub = this.route.queryParamMap.subscribe((params) => {
      this.hydrateFromParams(params);
      const q = params.get('q')?.trim();
      if (!q) {
        this.lastSearchKey = '';
        return;
      }
      const key = params.toString();
      if (key === this.lastSearchKey) return;
      this.lastSearchKey = key;
      this.executeSearch();
    });

    // Same URL re-submit (search / Apply) does not change query params — force a refresh.
    this.forceSearchSub = this.shellSearch.forceSearch$.subscribe(() => {
      this.hydrateFromParams(this.route.snapshot.queryParamMap);
      const q = this.query.trim();
      if (!q) return;
      this.lastSearchKey = this.route.snapshot.queryParamMap.toString();
      this.executeSearch();
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onViewportResize);
    this.clearResizeSettleTimers();
    this.queryParamsSub?.unsubscribe();
    this.forceSearchSub?.unsubscribe();
    this.bodyScroll.unlock('analyzer-modal');
  }

  onGridReady(event: GridReadyEvent<ListingRow>): void {
    this.gridApi = event.api;
    this.refreshDesktopGridLayout();
    if (this.highlightedRow != null) {
      this.highlightRow(this.highlightedRow);
    }
  }

  onExpandedGridReady(event: GridReadyEvent<ListingRow>): void {
    this.expandedGridApi = event.api;
    if (this.highlightedRow != null) {
      this.selectRowOnApi(this.expandedGridApi, this.highlightedRow);
    }
  }

  openExpandedChart(chart: 'seller' | 'date'): void {
    this.expandedTable.set(false);
    this.previewListing.set(null);
    this.expandedChart.set(chart);
    this.syncBodyScrollLock();
    this.cdr.detectChanges();
  }

  closeExpandedChart(): void {
    this.expandedChart.set(null);
    this.syncBodyScrollLock();
    this.cdr.detectChanges();
  }

  openExpandedTable(): void {
    this.expandedChart.set(null);
    this.previewListing.set(null);
    this.expandedTable.set(true);
    this.syncBodyScrollLock();
    this.cdr.detectChanges();
  }

  closeExpandedTable(): void {
    this.expandedTable.set(false);
    this.expandedGridApi = null;
    this.syncBodyScrollLock();
    this.cdr.detectChanges();
  }

  openListingPreview(row: ListingRow): void {
    this.ngZone.run(() => {
      this.expandedChart.set(null);
      this.expandedTable.set(false);
      this.previewListing.set({ ...row });
      this.syncBodyScrollLock();
      this.cdr.detectChanges();
    });
  }

  closeListingPreview(): void {
    this.previewListing.set(null);
    this.syncBodyScrollLock();
    this.cdr.detectChanges();
  }

  goToListing(): void {
    const url = this.previewListing()?.itemWebUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  applyPriceRefine(): void {
    const max = String(this.refineMaxPrice ?? '').trim();
    if (!max) {
      this.error = 'Enter a maximum price to refine, or use Reset to Auto.';
      return;
    }
    const min = String(this.refineMinPrice ?? '').trim() || '0';
    if (Number(max) <= Number(min)) {
      this.error = 'Please enter a valid price range.';
      return;
    }
    this.error = '';
    this.shellSearch.query = this.query;
    this.shellSearch.category = this.category;
    this.shellSearch.condition = this.condition;
    this.shellSearch.submitRefinedSearch(min, max);
  }

  resetToAuto(): void {
    this.error = '';
    this.shellSearch.query = this.query;
    this.shellSearch.category = this.category;
    this.shellSearch.condition = this.condition;
    this.shellSearch.submitAutoSearch(true);
  }

  downloadCsv(): void {
    downloadCsv(this.items, this.query);
  }

  onScatterClick(event: ECElementEvent): void {
    this.ngZone.run(() => {
      const data = event.data as ChartClickData | undefined;
      if (!data || typeof data.itemIndex !== 'number') return;

      const row = this.rowData[data.itemIndex];
      if (!row) return;

      this.highlightRow(data.itemIndex);
      this.openListingPreview(row);
    });
  }

  onHistogramClick(event: ECElementEvent): void {
    this.ngZone.run(() => {
      const data = event.data as ChartClickData | undefined;
      if (!data || data.binMin === undefined || data.binMax === undefined) return;

      const lo = Math.max(0, Math.floor(data.binMin));
      const hi = Math.ceil(data.binMax);
      this.refineMinPrice = String(lo);
      this.refineMaxPrice = String(hi);

      const matches = this.rowData.filter(
        (row) => row.price >= data.binMin! && row.price < data.binMax!,
      );

      if (matches.length) {
        this.highlightRow(matches[0].rowIndex);
        this.filterMessage = `${matches.length} listing(s) in $${lo}–$${hi} — adjust band filled; click Apply to re-fetch`;
      } else {
        this.filterMessage = `Price band set to $${lo}–$${hi} — click Apply to re-fetch`;
      }
      this.cdr.detectChanges();
    });
  }

  onDonutClick(event: ECElementEvent): void {
    this.ngZone.run(() => {
      const name = (event.data as ChartClickData | undefined)?.name;
      if (!name) return;

      const match = this.rowData.findIndex((row) => {
        const cond = (row.condition || '').toUpperCase();
        if (name === 'New') return cond.includes('NEW');
        if (name === 'Used') return cond.includes('USED') || cond.includes('PRE-OWNED');
        return !cond.includes('NEW') && !cond.includes('USED') && !cond.includes('PRE-OWNED');
      });

      if (match >= 0) {
        this.highlightRow(match);
        this.filterMessage = `Showing first ${name} listing — click other segments to jump`;
        this.cdr.detectChanges();
      }
    });
  }

  clearHighlight(): void {
    this.highlightedRow = null;
    this.filterMessage = '';
    this.gridApi?.deselectAll();
    this.expandedGridApi?.deselectAll();
  }

  private toListingRow(item: ItemSummary, index: number): ListingRow {
    const price = parseFloat(item.price);
    const feedback = item.feedbackPercentage != null ? parseFloat(item.feedbackPercentage) : NaN;
    return {
      rowIndex: index,
      title: item.title || 'N/A',
      price: isNaN(price) ? 0 : price,
      condition: item.condition || 'N/A',
      itemWebUrl: item.itemWebUrl,
      username: item.username || 'N/A',
      feedbackPercentage: isNaN(feedback) ? null : feedback,
      categoryName: item.categoryName || 'N/A',
      imageUrl: item.imageUrl,
    };
  }

  private buildCharts(): void {
    this.histogramOptions = this.chartService.buildHistogramOptions(this.items).options;
    this.donutOptions = this.chartService.buildDonutOptions(this.items);
    this.sellerScatterOptions = this.chartService.buildSellerScatterOptions(this.items);
    this.dateScatterOptions = this.chartService.buildDateScatterOptions(this.items);
  }

  private isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  private syncViewportMode(): void {
    const mobile = this.isMobileViewport();
    const wasMobile = this.isMobileUi();

    if (mobile === wasMobile) {
      if (!mobile) {
        requestAnimationFrame(() => this.refreshDesktopGridLayout());
      }
      return;
    }

    this.isMobileUi.set(mobile);

    if (mobile) {
      this.gridApi = null;
      if (this.expandedTable()) {
        this.expandedTable.set(false);
        this.syncBodyScrollLock();
      }
    }

    // Charts keep stale canvas metrics across breakpoint changes — rebuild options.
    if (this.items.length) {
      this.buildCharts();
    }

    this.cdr.detectChanges();
    this.settleLayoutAfterBreakpointChange();
  }

  private settleLayoutAfterBreakpointChange(): void {
    this.clearResizeSettleTimers();

    const settle = () => {
      this.refreshDesktopGridLayout();
      this.clampWindowScrollToContent();
      window.dispatchEvent(new Event('resize'));
    };

    requestAnimationFrame(() => {
      settle();
      requestAnimationFrame(() => {
        settle();
        this.resizeSettleTimers.push(setTimeout(settle, 50));
        this.resizeSettleTimers.push(setTimeout(settle, 150));
        this.resizeSettleTimers.push(setTimeout(settle, 350));
      });
    });
  }

  private clearResizeSettleTimers(): void {
    for (const timer of this.resizeSettleTimers) {
      clearTimeout(timer);
    }
    this.resizeSettleTimers = [];
  }

  private refreshDesktopGridLayout(): void {
    if (!this.gridApi || this.isMobileUi()) return;
    this.gridApi.sizeColumnsToFit();
    this.gridApi.resetRowHeights();
  }

  /** Clamp scroll to real content bottom (ignores ghost overflow past .container). */
  private clampWindowScrollToContent(): void {
    const container = document.querySelector('.container') as HTMLElement | null;
    const contentBottom = container
      ? container.getBoundingClientRect().bottom + window.scrollY
      : document.documentElement.scrollHeight;
    const maxScroll = Math.max(0, contentBottom - window.innerHeight);
    if (window.scrollY > maxScroll + 1) {
      window.scrollTo({ top: maxScroll, behavior: 'auto' });
    }
  }

  private clampWindowScroll(): void {
    this.clampWindowScrollToContent();
  }

  private highlightRow(index: number): void {
    this.highlightedRow = index;
    if (this.expandedChart()) {
      this.expandedChart.set(null);
      this.syncBodyScrollLock();
    }
    this.cdr.detectChanges();

    requestAnimationFrame(() => {
      if (this.expandedTable()) {
        this.selectRowOnApi(this.expandedGridApi, index);
        return;
      }

      if (this.isMobileUi()) {
        const mobileCard = document.querySelector('.mobile-listing-card.highlighted');
        if (mobileCard) {
          mobileCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }
      }

      document.querySelector('.results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.selectRowOnApi(this.gridApi, index);
    });
  }

  private selectRowOnApi(api: GridApi<ListingRow> | null, index: number): void {
    if (!api) return;
    const node = api.getRowNode(String(index));
    if (!node) return;
    api.deselectAll();
    node.setSelected(true, false);
    api.ensureNodeVisible(node, 'middle');
  }

  private syncBodyScrollLock(): void {
    const locked = !!(this.expandedChart() || this.expandedTable() || this.previewListing());
    if (locked) {
      this.bodyScroll.lock('analyzer-modal');
    } else {
      this.bodyScroll.unlock('analyzer-modal');
    }
  }

  private hydrateFromParams(params: ParamMap): void {
    this.query = params.get('q') ?? '';
    this.category = params.get('category') ?? '';
    this.condition = params.get('condition') ?? '';
    this.minPrice = params.get('minPrice') ?? '';
    this.maxPrice = params.get('maxPrice') ?? '';

    if (this.isRefined) {
      this.refineMinPrice = this.minPrice || '0';
      this.refineMaxPrice = this.maxPrice;
    }
  }

  private executeSearch(): void {
    const trimmed = this.query.trim();
    if (!trimmed) return;

    this.loading = true;
    this.error = '';
    this.items = [];
    this.rowData = [];
    this.metrics = null;
    this.highlightedRow = null;
    this.filterMessage = '';
    this.expandedChart.set(null);
    this.expandedTable.set(false);
    this.previewListing.set(null);
    this.appliedMinPrice = null;
    this.appliedMaxPrice = null;
    this.mobileFilterInclude = '';
    this.mobileFilterExclude = '';
    this.mobileFilterMin = '';
    this.mobileFilterMax = '';
    this.syncBodyScrollLock();
    this.cdr.detectChanges();

    const refined = this.isRefined;
    const minPrice = refined ? this.minPrice || '0' : '';
    const maxPrice = refined ? this.maxPrice : '';

    this.searchService
      .search({
        query: trimmed,
        minPrice,
        maxPrice,
        category: this.category || null,
        condition: this.condition || null,
        filterStrength: refined ? 0 : DEFAULT_STRENGTH,
      })
      .subscribe({
        next: (response) => {
          this.items = response.itemSummaries;
          this.appliedMinPrice = response.appliedMinPrice ?? null;
          this.appliedMaxPrice = response.appliedMaxPrice ?? null;

          if (this.appliedMinPrice != null && this.appliedMaxPrice != null) {
            this.refineMinPrice = String(Math.round(this.appliedMinPrice * 100) / 100);
            this.refineMaxPrice = String(Math.round(this.appliedMaxPrice * 100) / 100);
          }

          if (!this.items.length) {
            this.error = 'No results found. Try a different search term.';
            this.loading = false;
            this.cdr.detectChanges();
            return;
          }

          this.rowData = this.items.map((item, index) => this.toListingRow(item, index));
          this.metrics = computeMetrics(this.items);
          this.buildCharts();
          this.saveHistory(trimmed);
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err: Error) => {
          this.error = `Search failed. ${err.message}`;
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  private saveHistory(query: string): void {
    const categoryLabel =
      this.categoryOptions.find((c) => c.id === this.category)?.name || 'Any';
    const conditionLabel =
      this.condition === 'new' ? 'New' : this.condition === 'used' ? 'Used' : 'Any';

    this.historyService.saveEntry({
      query,
      category: this.category,
      condition: this.condition,
      minPrice: this.isRefined ? this.minPrice : '',
      maxPrice: this.isRefined ? this.maxPrice : '',
      priceMode: this.isRefined ? 'specific' : 'auto',
      filterStrength: DEFAULT_STRENGTH,
      categoryLabel,
      conditionLabel,
      timestamp: new Date().toISOString(),
    });
  }
}
