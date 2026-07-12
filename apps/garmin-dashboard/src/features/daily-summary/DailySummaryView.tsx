/**
 * Daily Summary View — displays health metrics for a selected date range.
 * Shows steps, resting HR, sleep duration/stages, stress, body battery, respiration rate.
 * Defaults to 7-day date range; shows placeholders for dates with no data.
 *
 * Validates: Requirements 3.1, 3.2, 3.5
 */

import { useMemo, useState } from 'react';
import { useDailySummary } from './hooks';
import { usePreferencesStore } from '@/stores/preferences-store';
import type { DateRange, DateRangeOption, DailySummary } from '@/types/garmin';

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

function formatSleepDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/** Build a map from date string to DailySummary for fast lookup */
function buildDateMap(data: DailySummary[]): Map<string, DailySummary> {
  const map = new Map<string, DailySummary>();
  for (const entry of data) {
    map.set(entry.date, entry);
  }
  return map;
}

/** Generate all dates in range (inclusive) */
function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DailySummaryView() {
  const defaultDateRange = usePreferencesStore((s) => s.defaultDateRange);
  const [selectedRange, setSelectedRange] = useState<DateRangeOption>(defaultDateRange);

  const dateRange = useMemo(() => getDateRange(selectedRange), [selectedRange]);
  const { data, isLoading, isError, error, refetch } = useDailySummary(dateRange);

  const allDates = useMemo(
    () => getDatesInRange(dateRange.startDate, dateRange.endDate),
    [dateRange]
  );

  const dateMap = useMemo(() => buildDateMap(data ?? []), [data]);

  return (
    <div className="p-6 space-y-6">
      {/* Header + Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Daily Summary</h1>
        <DateRangeSelector value={selectedRange} onChange={setSelectedRange} />
      </div>

      {/* Loading State */}
      {isLoading && <LoadingState />}

      {/* Error State */}
      {isError && <ErrorState message={error?.message} onRetry={() => refetch()} />}

      {/* Data Grid */}
      {!isLoading && !isError && (
        <div className="space-y-6">
          {allDates.map((date) => {
            const summary = dateMap.get(date);
            return (
              <DayCard key={date} date={date} summary={summary} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Date Range Selector ──────────────────────────────────────────────────────

interface DateRangeSelectorProps {
  value: DateRangeOption;
  onChange: (value: DateRangeOption) => void;
}

function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const options: { label: string; value: DateRangeOption }[] = [
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
  ];

  return (
    <div className="flex gap-2" role="group" aria-label="Date range selection">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] min-w-[44px] ${
            value === opt.value
              ? 'bg-primary text-white'
              : 'bg-bg-tertiary text-text-secondary hover:bg-border-hover'
          }`}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

interface DayCardProps {
  date: string;
  summary: DailySummary | undefined;
}

function DayCard({ date, summary }: DayCardProps) {
  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (!summary) {
    return (
      <div className="rounded-lg border border-border p-4 bg-bg-secondary">
        <h2 className="text-sm font-medium text-text-secondary mb-3">{displayDate}</h2>
        <p className="text-text-muted text-sm italic">No data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4 bg-bg-secondary">
      <h2 className="text-sm font-medium text-text-secondary mb-3">{displayDate}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <MetricCard
          icon="👟"
          label="Steps"
          value={summary.steps.toLocaleString()}
          ariaLabel={`${summary.steps} steps`}
        />
        {summary.restingHeartRate != null && (
          <MetricCard
            icon="❤️"
            label="Resting HR"
            value={`${summary.restingHeartRate}`}
            unit="bpm"
            ariaLabel={`Resting heart rate: ${summary.restingHeartRate} beats per minute`}
          />
        )}
        {summary.sleepDuration != null && (
          <MetricCard
            icon="😴"
            label="Sleep Duration"
            value={formatSleepDuration(summary.sleepDuration)}
            ariaLabel={`Sleep duration: ${formatSleepDuration(summary.sleepDuration)}`}
          />
        )}
        {summary.sleepStages && (
          <SleepStagesCard stages={summary.sleepStages} />
        )}
        {summary.stressLevel != null && (
          <MetricCard
            icon="🧠"
            label="Stress Level"
            value={`${summary.stressLevel}`}
            unit="/100"
            ariaLabel={`Stress level: ${summary.stressLevel} out of 100`}
            color={getStressColor(summary.stressLevel)}
          />
        )}
        {summary.bodyBattery != null && (
          <MetricCard
            icon="🔋"
            label="Body Battery"
            value={`${summary.bodyBattery}`}
            unit="/100"
            ariaLabel={`Body battery: ${summary.bodyBattery} out of 100`}
            color={getBodyBatteryColor(summary.bodyBattery)}
          />
        )}
        {summary.respirationRate != null && (
          <MetricCard
            icon="🫁"
            label="Respiration Rate"
            value={`${summary.respirationRate}`}
            unit="br/min"
            ariaLabel={`Respiration rate: ${summary.respirationRate} breaths per minute`}
          />
        )}
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  ariaLabel: string;
  color?: string;
}

function MetricCard({ icon, label, value, unit, ariaLabel, color }: MetricCardProps) {
  return (
    <div
      className="rounded-md bg-bg-primary border border-border p-3 flex items-center gap-3"
      aria-label={ariaLabel}
      role="group"
    >
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <div>
        <p className="text-xs text-text-muted font-medium">{label}</p>
        <p className="text-lg font-semibold text-text-primary">
          <span style={color ? { color } : undefined}>{value}</span>
          {unit && <span className="text-sm font-normal text-text-secondary ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Sleep Stages Card ────────────────────────────────────────────────────────

interface SleepStagesProps {
  stages: NonNullable<DailySummary['sleepStages']>;
}

function SleepStagesCard({ stages }: SleepStagesProps) {
  const total = stages.deep + stages.light + stages.rem + stages.awake;
  const segments = [
    { label: 'Deep', value: stages.deep, color: '#1e3a5f' },
    { label: 'Light', value: stages.light, color: '#60a5fa' },
    { label: 'REM', value: stages.rem, color: '#a78bfa' },
    { label: 'Awake', value: stages.awake, color: '#f87171' },
  ];

  return (
    <div
      className="rounded-md bg-bg-primary border border-border p-3"
      aria-label={`Sleep stages: ${stages.deep} minutes deep, ${stages.light} minutes light, ${stages.rem} minutes REM, ${stages.awake} minutes awake`}
      role="group"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl" aria-hidden="true">🌙</span>
        <p className="text-xs text-text-muted font-medium">Sleep Stages</p>
      </div>
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-2" role="img" aria-hidden="true">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full"
            style={{
              width: total > 0 ? `${(seg.value / total) * 100}%` : '25%',
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: seg.color }}
              aria-hidden="true"
            />
            {seg.label}: {seg.value}m
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Loading State ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16" role="status" aria-label="Loading daily summary data">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
      <p className="mt-4 text-text-secondary text-sm">Loading daily summary...</p>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3" aria-hidden="true">⚠️</div>
      <h2 className="text-lg font-semibold text-text-primary mb-1">Failed to load data</h2>
      <p className="text-sm text-text-secondary mb-4">
        {message || 'An error occurred while fetching your daily summary.'}
      </p>
      <button
        onClick={onRetry}
        className="px-5 py-2 rounded-md bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors min-h-[44px] min-w-[44px]"
      >
        Retry
      </button>
    </div>
  );
}

// ─── Color Helpers ────────────────────────────────────────────────────────────

function getStressColor(level: number): string {
  if (level <= 25) return '#10b981'; // green - low
  if (level <= 50) return '#f59e0b'; // amber - medium
  if (level <= 75) return '#f97316'; // orange - high
  return '#ef4444'; // red - very high
}

function getBodyBatteryColor(level: number): string {
  if (level >= 75) return '#10b981'; // green - charged
  if (level >= 50) return '#06b6d4'; // cyan - moderate
  if (level >= 25) return '#f59e0b'; // amber - low
  return '#ef4444'; // red - depleted
}
