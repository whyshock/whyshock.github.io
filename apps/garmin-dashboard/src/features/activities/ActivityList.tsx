/**
 * ActivityList displays a paginated list of activities with type, date,
 * duration, and distance. Supports loading, error, and empty states.
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5
 */

import { Link } from 'react-router-dom';
import type { Activity } from '@/types/garmin';
import { usePreferencesStore } from '@/stores/preferences-store';
import {
  formatDuration,
  formatDistance,
  formatDate,
  formatTime,
  formatActivityType,
  getActivityTypeColor,
} from '@/utils/formatters';

const PAGE_SIZE = 50;

interface ActivityListProps {
  activities: Activity[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

export function ActivityList({
  activities,
  isLoading,
  isError,
  error,
  page,
  onPageChange,
  onRetry,
}: ActivityListProps) {
  const unitSystem = usePreferencesStore((state) => state.unitSystem);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16"
        role="status"
        aria-label="Loading activities"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
        <p className="mt-4 text-text-secondary">Loading activities...</p>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16"
        role="alert"
        aria-live="assertive"
      >
        <p className="text-error font-medium">
          {error?.message ?? 'Failed to load activities'}
        </p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 min-h-[44px] min-w-[44px]"
          aria-label="Retry loading activities"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-text-secondary text-lg">No activities found</p>
        <p className="mt-2 text-text-muted text-sm">
          Activities from Garmin Connect will appear here.
        </p>
      </div>
    );
  }

  const hasNextPage = activities.length === PAGE_SIZE;
  const hasPreviousPage = page > 0;

  return (
    <div>
      {/* Activity cards */}
      <ul className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3" role="list">
        {activities.map((activity) => (
          <li key={activity.activityId}>
            <ActivityCard activity={activity} unitSystem={unitSystem} />
          </li>
        ))}
      </ul>

      {/* Pagination controls */}
      <nav
        className="mt-8 flex items-center justify-between border-t border-border pt-4"
        aria-label="Activity list pagination"
      >
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPreviousPage}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 min-h-[44px] min-w-[44px]"
          aria-label="Previous page"
        >
          ← Previous
        </button>

        <span className="text-sm text-text-secondary" aria-current="page">
          Page {page + 1}
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 min-h-[44px] min-w-[44px]"
          aria-label="Next page"
        >
          Next →
        </button>
      </nav>
    </div>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

interface ActivityCardProps {
  activity: Activity;
  unitSystem: 'metric' | 'imperial';
}

function ActivityCard({ activity, unitSystem }: ActivityCardProps) {
  const typeColor = getActivityTypeColor(activity.activityType);
  const typeLabel = formatActivityType(activity.activityType);

  return (
    <Link
      to={`/activities/${activity.activityId}`}
      className="block rounded-lg border border-border bg-bg-secondary p-4 transition-colors hover:border-border-hover hover:bg-bg-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      aria-label={`${typeLabel} on ${formatDate(activity.startTime)}, duration ${formatDuration(activity.duration)}`}
    >
      <div className="flex items-start gap-3">
        {/* Activity type color indicator */}
        <span
          className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${typeColor}`}
          aria-hidden="true"
        />

        <div className="flex-1 min-w-0">
          {/* Activity type and name */}
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text-primary truncate">
              {activity.activityName || typeLabel}
            </h3>
          </div>

          {/* Type badge */}
          <span className="inline-block mt-1 text-xs font-medium text-text-muted">
            {typeLabel}
          </span>

          {/* Date and time */}
          <p className="mt-2 text-sm text-text-secondary">
            {formatDate(activity.startTime)}
            <span className="ml-2 text-text-muted">{formatTime(activity.startTime)}</span>
          </p>

          {/* Metrics row */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <MetricItem label="Duration" value={formatDuration(activity.duration)} />
            <MetricItem
              label="Distance"
              value={formatDistance(activity.distance, unitSystem)}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Metric Item ──────────────────────────────────────────────────────────────

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-text-secondary">
      <span className="text-text-muted">{label}:</span>{' '}
      <span className="font-medium text-text-primary">{value}</span>
    </span>
  );
}
