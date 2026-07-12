/**
 * Daily summary page — protected route.
 * Renders the DailySummaryView with the DateRangePicker and MetricsCharts
 * showing time-series for steps, HR, sleep, stress, and body battery.
 *
 * Validates: Requirements 3.3, 3.4, 3.6, 3.7
 */

import { useMemo, useState, useCallback } from 'react';
import DailySummaryView from './DailySummaryView';
import DateRangePicker from './DateRangePicker';
import MetricsChart from '@/components/charts/MetricsChart';
import { useDailySummary } from './hooks';
import { usePreferencesStore } from '@/stores/preferences-store';
import type { DateRange, DateRangeOption, DailySummary } from '@/types/garmin';
import type { TimeSeriesDataPoint } from '@/utils/aggregation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateRange(days: DateRangeOption): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extracts a numeric metric from daily summaries as time-series data points.
 * Filters out days where the metric is unavailable.
 */
function extractMetric(
  data: DailySummary[],
  extractor: (s: DailySummary) => number | undefined | null
): TimeSeriesDataPoint[] {
  const points: TimeSeriesDataPoint[] = [];
  for (const summary of data) {
    const value = extractor(summary);
    if (value != null) {
      points.push({ date: summary.date, value });
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DailySummaryPage() {
  const defaultDateRange = usePreferencesStore((s) => s.defaultDateRange);
  const [quickSelect, setQuickSelect] = useState<DateRangeOption | null>(defaultDateRange);
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRange(defaultDateRange));

  const { data, isLoading, isError, error } = useDailySummary(dateRange);

  // Handle quick-select button clicks
  const handleQuickSelect = useCallback((days: DateRangeOption) => {
    setQuickSelect(days);
    setDateRange(getDateRange(days));
  }, []);

  // Handle custom date range changes
  const handleDateRangeChange = useCallback((range: DateRange) => {
    setQuickSelect(null); // clear quick-select when custom range chosen
    setDateRange(range);
  }, []);

  // Extract time-series for each metric
  const stepsData = useMemo(() => extractMetric(data ?? [], (s) => s.steps), [data]);
  const hrData = useMemo(() => extractMetric(data ?? [], (s) => s.restingHeartRate), [data]);
  const sleepData = useMemo(
    () => extractMetric(data ?? [], (s) => (s.sleepDuration != null ? s.sleepDuration / 60 : null)),
    [data]
  );
  const stressData = useMemo(() => extractMetric(data ?? [], (s) => s.stressLevel), [data]);
  const bodyBatteryData = useMemo(() => extractMetric(data ?? [], (s) => s.bodyBattery), [data]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Daily Summary</h1>
        <DateRangePicker
          value={dateRange}
          onChange={handleDateRangeChange}
          activeQuickSelect={quickSelect}
          onQuickSelect={handleQuickSelect}
        />
      </div>

      {/* Time-Series Charts */}
      {!isError && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Trends</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MetricsChart
              metricName="Steps"
              data={stepsData}
              unit="steps"
              color="#10b981"
              isLoading={isLoading}
            />
            <MetricsChart
              metricName="Resting Heart Rate"
              data={hrData}
              unit="bpm"
              color="#ef4444"
              isLoading={isLoading}
            />
            <MetricsChart
              metricName="Sleep Duration"
              data={sleepData}
              unit="hrs"
              color="#8b5cf6"
              isLoading={isLoading}
            />
            <MetricsChart
              metricName="Stress Level"
              data={stressData}
              unit="/100"
              color="#f59e0b"
              isLoading={isLoading}
            />
            <MetricsChart
              metricName="Body Battery"
              data={bodyBatteryData}
              unit="/100"
              color="#06b6d4"
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {/* Error state for charts */}
      {isError && (
        <div className="rounded-lg border border-border p-4 bg-bg-secondary">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-3xl mb-2" aria-hidden="true">⚠️</div>
            <p className="text-sm text-red-500">
              {error?.message || 'Failed to load daily summary data.'}
            </p>
          </div>
        </div>
      )}

      {/* Detailed Daily Summary View (card-based view) */}
      <DailySummaryView />
    </div>
  );
}
