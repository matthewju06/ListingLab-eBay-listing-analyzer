import { Injectable } from '@angular/core';
import { EChartsCoreOption } from 'echarts/core';

import { ItemSummary } from '../core/models/search.models';
import { createHistogramData, parsePrice } from '../core/utils/search.utils';

const TEXT = '#bcbcbc';
const GRID = '#333333';
const BLUE = '#0064D2';
const GREEN = '#279100';
const ORANGE = '#FF8C00';
const GRAY = '#999999';

/** Don't allow zooming into less than this share of the full axis (percent). */
const MIN_ZOOM_SPAN_PCT = 10;

export interface ChartPointMeta {
  itemIndex: number;
  title: string;
  url: string | null;
  price: number;
}

export interface HistogramBinMeta {
  min: number;
  max: number;
  label: string;
}

function conditionBucket(item: ItemSummary): 'New' | 'Used' | 'Other' {
  const cond = (item.condition || '').toUpperCase();
  if (cond.includes('NEW')) return 'New';
  if (cond.includes('USED') || cond.includes('PRE-OWNED')) return 'Used';
  return 'Other';
}

function baseTooltip() {
  return {
    backgroundColor: '#1a1a1a',
    borderColor: GRID,
    textStyle: { color: TEXT },
    appendTo: 'body',
  };
}

function baseGrid(): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: TEXT, fontFamily: 'Space Grotesk, system-ui, sans-serif' },
    tooltip: baseTooltip(),
  };
}

/** Pad a numeric range; do not force inclusion of 0. */
function paddedBounds(values: number[], padRatio = 0.08, minPad = 1): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 1 };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) {
    const pad = Math.max(Math.abs(lo) * 0.05, minPad);
    return { min: Math.max(0, lo - pad), max: hi + pad };
  }
  const pad = Math.max((hi - lo) * padRatio, minPad);
  return { min: Math.max(0, lo - pad), max: hi + pad };
}

function scoreBounds(scores: number[]): { min: number; max: number } {
  if (!scores.length) return { min: 90, max: 100 };
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const pad = Math.max((hi - lo) * 0.2, 0.5);
  return {
    min: Math.max(0, Math.floor((lo - pad) * 10) / 10),
    max: Math.min(100, Math.ceil((hi + pad) * 10) / 10),
  };
}

@Injectable({ providedIn: 'root' })
export class ChartService {
  buildHistogramOptions(items: ItemSummary[]): {
    options: EChartsCoreOption;
    bins: HistogramBinMeta[];
  } {
    const prices = items.map(parsePrice).filter((p) => !isNaN(p));
    const histogram = createHistogramData(prices);
    const min = prices.length ? Math.floor(Math.min(...prices)) : 0;
    const max = prices.length ? Math.ceil(Math.max(...prices)) : 0;
    const range = max - min || 1;
    const step = histogram.labels.length ? range / histogram.labels.length : 1;

    const bins: HistogramBinMeta[] = histogram.labels.map((label, i) => ({
      label,
      min: min + i * step,
      max: min + (i + 1) * step,
    }));

    const options: EChartsCoreOption = {
      ...baseGrid(),
      tooltip: {
        ...baseTooltip(),
        trigger: 'axis',
        formatter: (params: unknown) => {
          const p = (params as { name: string; value: number }[])[0];
          return p ? `${p.name}<br/>${p.value} listings` : '';
        },
      },
      grid: { left: 8, right: 8, top: 8, bottom: 44, containLabel: true },
      xAxis: {
        type: 'category',
        data: histogram.labels,
        axisLabel: { color: TEXT, rotate: 35, fontSize: 10, hideOverlap: true },
        axisLine: { lineStyle: { color: GRID } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLabel: { color: TEXT },
        splitLine: { lineStyle: { color: GRID } },
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'none',
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          minSpan: MIN_ZOOM_SPAN_PCT,
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 16,
          bottom: 2,
          filterMode: 'none',
          minSpan: MIN_ZOOM_SPAN_PCT,
        },
      ],
      series: [
        {
          type: 'bar',
          barCategoryGap: '18%',
          barMaxWidth: 48,
          data: histogram.data.map((count, i) => ({
            value: count,
            binIndex: i,
            binMin: bins[i]?.min,
            binMax: bins[i]?.max,
          })),
          itemStyle: { color: 'rgba(0, 100, 210, 0.65)', borderColor: BLUE },
          emphasis: { itemStyle: { color: BLUE } },
        },
      ],
    };

    return { options, bins };
  }

  buildDonutOptions(items: ItemSummary[]): EChartsCoreOption {
    const counts = { New: 0, Used: 0, Other: 0 };
    items.forEach((item) => {
      counts[conditionBucket(item)]++;
    });

    return {
      ...baseGrid(),
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        bottom: 0,
        left: 'center',
        width: '90%',
        itemGap: 10,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: TEXT, fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '62%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          label: { show: false },
          data: [
            { name: 'New', value: counts.New, itemStyle: { color: GREEN } },
            { name: 'Used', value: counts.Used, itemStyle: { color: ORANGE } },
            { name: 'Other', value: counts.Other, itemStyle: { color: GRAY } },
          ],
        },
      ],
    };
  }

  buildSellerScatterOptions(items: ItemSummary[]): EChartsCoreOption {
    const seriesMap: Record<string, ChartPointMeta[]> = { New: [], Used: [], Other: [] };
    const prices: number[] = [];
    const scores: number[] = [];

    items.forEach((item, itemIndex) => {
      const price = parsePrice(item);
      const score = parseFloat(item.feedbackPercentage || '');
      if (isNaN(price) || isNaN(score)) return;

      prices.push(price);
      scores.push(score);
      seriesMap[conditionBucket(item)].push({
        itemIndex,
        title: item.title || 'Listing',
        url: item.itemWebUrl,
        price,
      });
    });

    return this.buildScatterChart(
      seriesMap,
      (p) => [parseFloat(items[p.itemIndex].feedbackPercentage || '0'), p.price],
      (p) =>
        `${p.title}<br/>$${p.price.toFixed(2)} · ${items[p.itemIndex].feedbackPercentage}% seller`,
      {
        isTime: false,
        xBounds: scoreBounds(scores),
        yBounds: paddedBounds(prices, 0.08, 2),
        xMinValueSpan: 2,
        yMinValueSpan: Math.max(5, (Math.max(...prices, 0) - Math.min(...prices, 0)) * 0.08 || 5),
      },
    );
  }

  buildDateScatterOptions(items: ItemSummary[]): EChartsCoreOption {
    const seriesMap: Record<string, ChartPointMeta[]> = { New: [], Used: [], Other: [] };
    const prices: number[] = [];
    const times: number[] = [];

    items.forEach((item, itemIndex) => {
      const price = parsePrice(item);
      const date = item.itemCreationDate ? new Date(item.itemCreationDate) : null;
      if (isNaN(price) || !date || isNaN(date.getTime())) return;

      prices.push(price);
      times.push(date.getTime());
      seriesMap[conditionBucket(item)].push({
        itemIndex,
        title: item.title || 'Listing',
        url: item.itemWebUrl,
        price,
      });
    });

    const dayMs = 24 * 60 * 60 * 1000;
    const timeSpan = times.length ? Math.max(...times) - Math.min(...times) : dayMs;
    const xMinValueSpan = Math.max(3 * dayMs, timeSpan * 0.08);

    return this.buildScatterChart(
      seriesMap,
      (p) => [items[p.itemIndex].itemCreationDate!, p.price],
      (p) => {
        const date = new Date(items[p.itemIndex].itemCreationDate!);
        return `${p.title}<br/>$${p.price.toFixed(2)} · ${date.toLocaleDateString()}`;
      },
      {
        isTime: true,
        xBounds: null,
        yBounds: paddedBounds(prices, 0.08, 2),
        xMinValueSpan,
        yMinValueSpan: Math.max(5, (Math.max(...prices, 0) - Math.min(...prices, 0)) * 0.08 || 5),
      },
    );
  }

  private buildScatterChart(
    seriesMap: Record<string, ChartPointMeta[]>,
    getValue: (p: ChartPointMeta) => [string | number, number],
    tooltipFn: (p: ChartPointMeta) => string,
    axisConfig: {
      isTime: boolean;
      xBounds: { min: number; max: number } | null;
      yBounds: { min: number; max: number };
      xMinValueSpan: number;
      yMinValueSpan: number;
    },
  ): EChartsCoreOption {
    const colors = { New: GREEN, Used: ORANGE, Other: GRAY };
    const { isTime, xBounds, yBounds, xMinValueSpan, yMinValueSpan } = axisConfig;

    return {
      ...baseGrid(),
      tooltip: {
        ...baseTooltip(),
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { data: ChartPointMeta & { title: string; price: number } };
          return p?.data ? `${tooltipFn(p.data)}<br/><em>Click to preview listing</em>` : '';
        },
      },
      legend: { top: 0, textStyle: { color: TEXT } },
      // No axis name labels — panel titles already describe the chart.
      grid: { left: 8, right: 12, top: 28, bottom: 24, containLabel: true },
      xAxis: {
        type: isTime ? 'time' : 'value',
        axisLabel: {
          color: TEXT,
          hideOverlap: true,
          ...(isTime
            ? {}
            : {
                formatter: (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
              }),
        },
        splitLine: { lineStyle: { color: GRID } },
        scale: !isTime,
        ...(xBounds ? { min: xBounds.min, max: xBounds.max } : {}),
      },
      yAxis: {
        type: 'value',
        scale: true,
        min: yBounds.min,
        max: yBounds.max,
        axisLabel: {
          color: TEXT,
          formatter: (v: number) => `$${Math.round(v)}`,
        },
        splitLine: { lineStyle: { color: GRID } },
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'none',
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          preventDefaultMouseMove: true,
          minSpan: MIN_ZOOM_SPAN_PCT,
          minValueSpan: xMinValueSpan,
        },
        {
          type: 'inside',
          yAxisIndex: 0,
          filterMode: 'none',
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          preventDefaultMouseMove: true,
          minSpan: MIN_ZOOM_SPAN_PCT,
          minValueSpan: yMinValueSpan,
        },
      ],
      series: (['New', 'Used', 'Other'] as const).map((name) => ({
        name,
        type: 'scatter',
        symbolSize: 10,
        itemStyle: { color: colors[name], opacity: 0.75 },
        emphasis: { scale: 1.4 },
        data: seriesMap[name].map((p) => ({
          value: getValue(p),
          itemIndex: p.itemIndex,
          title: p.title,
          url: p.url,
          price: p.price,
        })),
      })),
    };
  }
}
