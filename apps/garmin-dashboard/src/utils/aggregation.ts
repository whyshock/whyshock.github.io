/**
 * Time-series data aggregation utilities.
 * Groups daily data points into week or month buckets with averaged values.
 *
 * Validates: Requirements 3.4
 */

import type { TimeGranularity } from '@/types/garmin';

export interface TimeSeriesDataPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface AggregatedDataPoint {
  date: string; // Representative date for the bucket (first date in bucket)
  label: string; // Display label for the bucket
  value: number; // Averaged value
  count: number; // Number of data points in bucket
}

/**
 * Aggregates daily data points by the specified granularity.
 *
 * - "day": Returns data as-is (no aggregation), each point labeled with its date.
 * - "week": Groups data into 7-day buckets starting from the first data point,
 *   averages the values within each bucket.
 * - "month": Groups data by calendar month, averages the values within each month.
 *
 * @param data - Array of daily data points (must be sorted by date ascending)
 * @param granularity - The aggregation level: 'day', 'week', or 'month'
 * @returns Aggregated data points
 */
export function aggregateByGranularity(
  data: TimeSeriesDataPoint[],
  granularity: TimeGranularity
): AggregatedDataPoint[] {
  if (data.length === 0) return [];

  switch (granularity) {
    case 'day':
      return aggregateByDay(data);
    case 'week':
      return aggregateByWeek(data);
    case 'month':
      return aggregateByMonth(data);
    default:
      return aggregateByDay(data);
  }
}

function aggregateByDay(data: TimeSeriesDataPoint[]): AggregatedDataPoint[] {
  return data.map((point) => ({
    date: point.date,
    label: formatDayLabel(point.date),
    value: point.value,
    count: 1,
  }));
}

function aggregateByWeek(data: TimeSeriesDataPoint[]): AggregatedDataPoint[] {
  const buckets: Map<number, TimeSeriesDataPoint[]> = new Map();

  // Use the first data point's date as the starting reference
  const startDate = new Date(data[0]!.date + 'T00:00:00');

  for (const point of data) {
    const pointDate = new Date(point.date + 'T00:00:00');
    const daysDiff = Math.floor(
      (pointDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weekIndex = Math.floor(daysDiff / 7);

    if (!buckets.has(weekIndex)) {
      buckets.set(weekIndex, []);
    }
    buckets.get(weekIndex)!.push(point);
  }

  const result: AggregatedDataPoint[] = [];
  const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);

  for (const key of sortedKeys) {
    const points = buckets.get(key)!;
    const avg = points.reduce((sum, p) => sum + p.value, 0) / points.length;
    const firstDate = points[0]!.date;
    const lastDate = points[points.length - 1]!.date;

    result.push({
      date: firstDate,
      label: formatWeekLabel(firstDate, lastDate),
      value: Math.round(avg * 100) / 100,
      count: points.length,
    });
  }

  return result;
}

function aggregateByMonth(data: TimeSeriesDataPoint[]): AggregatedDataPoint[] {
  const buckets: Map<string, TimeSeriesDataPoint[]> = new Map();

  for (const point of data) {
    // Group by YYYY-MM
    const monthKey = point.date.substring(0, 7);

    if (!buckets.has(monthKey)) {
      buckets.set(monthKey, []);
    }
    buckets.get(monthKey)!.push(point);
  }

  const result: AggregatedDataPoint[] = [];
  const sortedKeys = [...buckets.keys()].sort();

  for (const key of sortedKeys) {
    const points = buckets.get(key)!;
    const avg = points.reduce((sum, p) => sum + p.value, 0) / points.length;

    result.push({
      date: points[0]!.date,
      label: formatMonthLabel(key),
      value: Math.round(avg * 100) / 100,
      count: points.length,
    });
  }

  return result;
}

// ─── Label Formatters ─────────────────────────────────────────────────────────

function formatDayLabel(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatWeekLabel(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
