/**
 * PersonalRecords — displays the user's personal records (longest run,
 * fastest pace, highest elevation gain, etc.) in a card grid layout.
 *
 * Handles loading, error with retry, and empty states.
 *
 * Validates: Requirements 4.2, 4.6, 4.7
 */

import { usePersonalRecords } from './hooks';
import type { PersonalRecord } from '@/types/garmin';

// ─── Record type display config ──────────────────────────────────────────────

interface RecordDisplayConfig {
  label: string;
  icon: string;
  color: string;
}

const RECORD_TYPE_CONFIG: Record<string, RecordDisplayConfig> = {
  longest_run: {
    label: 'Longest Run',
    icon: '🏃',
    color: 'var(--color-activity-running)',
  },
  fastest_pace: {
    label: 'Fastest Pace',
    icon: '⚡',
    color: 'var(--color-activity-cycling)',
  },
  fastest_5k: {
    label: 'Fastest 5K',
    icon: '🏅',
    color: 'var(--color-activity-running)',
  },
  fastest_10k: {
    label: 'Fastest 10K',
    icon: '🎯',
    color: 'var(--color-activity-running)',
  },
  highest_elevation: {
    label: 'Highest Elevation Gain',
    icon: '⛰️',
    color: 'var(--color-activity-hiking)',
  },
  longest_ride: {
    label: 'Longest Ride',
    icon: '🚴',
    color: 'var(--color-activity-cycling)',
  },
  longest_swim: {
    label: 'Longest Swim',
    icon: '🏊',
    color: 'var(--color-activity-swimming)',
  },
};

const DEFAULT_CONFIG: RecordDisplayConfig = {
  label: 'Record',
  icon: '🏆',
  color: 'var(--color-primary)',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRecordConfig(recordType: string): RecordDisplayConfig {
  return RECORD_TYPE_CONFIG[recordType] ?? {
    ...DEFAULT_CONFIG,
    label: formatRecordType(recordType),
  };
}

function formatRecordType(recordType: string): string {
  return recordType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PersonalRecords() {
  const { data: records, isLoading, isError, error, refetch } = usePersonalRecords();

  // ─── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        role="status"
        aria-label="Loading personal records"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/5 p-6 text-center">
        <p className="text-text-primary font-medium">
          Unable to load personal records
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {error?.message ?? 'An unexpected error occurred'}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────

  if (!records || records.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-secondary p-8 text-center">
        <span className="text-4xl" aria-hidden="true">🏆</span>
        <p className="mt-3 text-text-primary font-medium">
          No personal records found yet
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Keep training! Your records will appear here as you log activities.
        </p>
      </div>
    );
  }

  // ─── Records grid ───────────────────────────────────────────────────────

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Personal records"
      role="list"
    >
      {records.map((record) => (
        <RecordCard key={`${record.recordType}-${record.activityId}`} record={record} />
      ))}
    </div>
  );
}

// ─── Record Card Sub-component ───────────────────────────────────────────────

function RecordCard({ record }: { record: PersonalRecord }) {
  const config = getRecordConfig(record.recordType);

  return (
    <div
      className="rounded-lg border border-border bg-bg-primary p-4 shadow-sm transition-shadow hover:shadow-md"
      role="listitem"
      aria-label={`${config.label}: ${record.value} ${record.unit}`}
    >
      {/* Header with icon and label */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)` }}
          aria-hidden="true"
        >
          {config.icon}
        </span>
        <span className="text-sm font-medium text-text-secondary">
          {config.label}
        </span>
      </div>

      {/* Value and unit */}
      <div className="mt-3">
        <span className="text-2xl font-bold text-text-primary">
          {record.value}
        </span>
        <span className="ml-1 text-sm text-text-muted">
          {record.unit}
        </span>
      </div>

      {/* Date achieved */}
      <p className="mt-2 text-xs text-text-muted">
        Achieved {formatDate(record.date)}
      </p>
    </div>
  );
}

export default PersonalRecords;
