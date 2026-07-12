/**
 * MetricsChart — renders time-series data as a responsive line/area chart
 * using Recharts. Supports selectable granularity (day, week, month).
 *
 * Validates: Requirements 3.4, 3.7
 */

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { TimeGranularity } from '@/types/garmin';
import {
  aggregateByGranularity,
  type TimeSeriesDataPoint,
  type AggregatedDataPoint,
} from '@/utils/aggregation';

export interface MetricsChartProps {
  /** The metric name (used in tooltip and aria-label) */
  metricName: string;
  /** Raw daily data points */
  data: TimeSeriesDataPoint[];
  /** Unit string for Y-axis and tooltip (e.g., "steps", "bpm", "hrs") */
  unit?: string;
  /** Color for the chart line/area */
  color?: string;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Error message if data failed to load */
  error?: string | null;
  /** Initial granularity */
  defaultGranularity?: TimeGranularity;
}

const GRANULARITY_OPTIONS: { label: string; value: TimeGranularity }[] = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

export default function MetricsChart({
  metricName,
  data,
  unit = '',
  color = '#6366f1',
  isLoading = false,
  error = null,
  defaultGranularity = 'day',
}: MetricsChartProps) {
  const [granularity, setGranularity] = useState<TimeGranularity>(defaultGranularity);

  const aggregatedData: AggregatedDataPoint[] = useMemo(
    () => aggregateByGranularity(data, granularity),
    [data, granularity]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-4 bg-bg-secondary">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">{metricName}</h3>
        </div>
        <div
          className="flex items-center justify-center h-48"
          role="status"
          aria-label={`Loading ${metricName} chart`}
        >
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-border border-t-primary" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-border p-4 bg-bg-secondary">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">{metricName}</h3>
        </div>
        <div className="flex items-center justify-center h-48 text-center" role="alert">
          <p className="text-sm text-red-500">Failed to load {metricName} data: {error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 bg-bg-secondary">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">{metricName}</h3>
        </div>
        <div className="flex items-center justify-center h-48 text-center">
          <p className="text-sm text-text-muted italic">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-border p-4 bg-bg-secondary"
      aria-label={`${metricName} time-series chart`}
    >
      {/* Header with metric name and granularity toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-text-primary">{metricName}</h3>
        <GranularityToggle value={granularity} onChange={setGranularity} />
      </div>

      {/* Chart */}
      <div className="w-full h-56" role="img" aria-label={`${metricName} chart showing ${aggregatedData.length} data points`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={aggregatedData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id={`gradient-${metricName}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary, #6b7280)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary, #6b7280)' }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const firstPayload = payload[0];
                if (!firstPayload) return null;
                const point = firstPayload.payload as AggregatedDataPoint;
                return (
                  <div className="bg-bg-primary border border-border rounded-md px-3 py-2 shadow-md">
                    <p className="text-xs text-text-secondary">{point.label}</p>
                    <p className="text-sm font-semibold text-text-primary">
                      {point.value} {unit}
                    </p>
                    {granularity !== 'day' && (
                      <p className="text-xs text-text-muted">Avg of {point.count} days</p>
                    )}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${metricName})`}
              dot={aggregatedData.length <= 14}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Granularity Toggle ───────────────────────────────────────────────────────

interface GranularityToggleProps {
  value: TimeGranularity;
  onChange: (granularity: TimeGranularity) => void;
}

function GranularityToggle({ value, onChange }: GranularityToggleProps) {
  return (
    <div className="flex gap-1" role="group" aria-label="Chart granularity">
      {GRANULARITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] ${
            value === opt.value
              ? 'bg-primary text-white'
              : 'bg-bg-tertiary text-text-secondary hover:bg-border-hover'
          }`}
          aria-pressed={value === opt.value}
          aria-label={`Show data by ${opt.value}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
