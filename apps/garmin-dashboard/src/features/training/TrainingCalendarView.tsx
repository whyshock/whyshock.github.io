/**
 * Training Calendar View — displays a monthly calendar grid with activities
 * plotted on their respective dates. Each activity shows a color-coded indicator
 * by activity type and duration.
 *
 * Validates: Requirements 4.1
 */

import { useMemo, useState } from 'react';
import { useActivities } from '@/features/activities/hooks';
import type { Activity, ActivityType } from '@/types/garmin';

// ─── Activity type display config ─────────────────────────────────────────────

const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  running: 'var(--color-activity-running)',
  cycling: 'var(--color-activity-cycling)',
  swimming: 'var(--color-activity-swimming)',
  strength_training: 'var(--color-activity-strength)',
  hiking: 'var(--color-activity-hiking)',
  walking: 'var(--color-activity-walking)',
  yoga: 'var(--color-activity-yoga)',
  other: 'var(--color-activity-other)',
};

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  running: 'Run',
  cycling: 'Cycle',
  swimming: 'Swim',
  strength_training: 'Strength',
  hiking: 'Hike',
  walking: 'Walk',
  yoga: 'Yoga',
  other: 'Other',
};

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h${minutes > 0 ? `${minutes}m` : ''}`;
  }
  return `${minutes}m`;
}

function getMonthLabel(year: number, month: number): string {
  const date = new Date(year, month);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Returns a 2D array representing the calendar grid for a given month.
 * Each row is a week (Mon-Sun). Days outside the month are null.
 */
function getCalendarGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // getDay() returns 0=Sun, 1=Mon, ..., 6=Sat
  // We want Monday=0, so shift: (day + 6) % 7
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  const grid: (number | null)[][] = [];
  let currentDay = 1;

  // Build 4-6 weeks
  for (let week = 0; week < 6; week++) {
    const row: (number | null)[] = [];
    for (let dayCol = 0; dayCol < 7; dayCol++) {
      if (week === 0 && dayCol < startDayOfWeek) {
        row.push(null);
      } else if (currentDay > daysInMonth) {
        row.push(null);
      } else {
        row.push(currentDay);
        currentDay++;
      }
    }
    grid.push(row);
    // Stop if all days have been placed
    if (currentDay > daysInMonth) break;
  }

  return grid;
}

function getDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return (
    now.getFullYear() === year &&
    now.getMonth() === month &&
    now.getDate() === day
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrainingCalendarView() {
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  // Fetch activities — we use page 0 to get the most recent batch.
  // In a real app this would be filtered by month via API params;
  // for now we filter client-side from the cached activity list.
  const { data: activities, isLoading, isError, error, refetch } = useActivities(0);

  // Group activities by date (YYYY-MM-DD)
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    if (!activities) return map;

    for (const activity of activities) {
      const date = activity.startTime.slice(0, 10); // ISO 8601 → YYYY-MM-DD
      const existing = map.get(date) ?? [];
      existing.push(activity);
      map.set(date, existing);
    }
    return map;
  }, [activities]);

  const calendarGrid = useMemo(
    () => getCalendarGrid(currentYear, currentMonth),
    [currentYear, currentMonth],
  );

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        role="status"
        aria-label="Loading training calendar"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/5 p-6 text-center">
        <p className="text-text-primary font-medium">Unable to load training calendar</p>
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

  // ─── Calendar render ──────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          aria-label="Previous month"
          className="rounded-md p-2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <h2 className="text-lg font-semibold text-text-primary">
          {getMonthLabel(currentYear, currentMonth)}
        </h2>

        <button
          onClick={handleNextMonth}
          aria-label="Next month"
          className="rounded-md p-2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" role="grid" aria-label="Training calendar">
          <thead>
            <tr>
              {WEEKDAY_HEADERS.map((day) => (
                <th
                  key={day}
                  className="border border-border px-1 py-2 text-center text-xs font-medium text-text-muted"
                  scope="col"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendarGrid.map((week, weekIdx) => (
              <tr key={weekIdx}>
                {week.map((day, dayIdx) => {
                  if (day === null) {
                    return (
                      <td
                        key={dayIdx}
                        className="border border-border bg-bg-secondary/50 p-1"
                        aria-hidden="true"
                      />
                    );
                  }

                  const dateKey = getDateKey(currentYear, currentMonth, day);
                  const dayActivities = activitiesByDate.get(dateKey) ?? [];
                  const todayHighlight = isToday(currentYear, currentMonth, day);

                  return (
                    <td
                      key={dayIdx}
                      className={`border border-border p-1 align-top ${
                        todayHighlight ? 'bg-primary/5' : 'bg-bg-primary'
                      }`}
                      aria-label={`${dateKey}${dayActivities.length > 0 ? `, ${dayActivities.length} activities` : ''}`}
                    >
                      {/* Day number */}
                      <div className="mb-0.5 flex items-center justify-between">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                            todayHighlight
                              ? 'bg-primary text-white'
                              : 'text-text-primary'
                          }`}
                        >
                          {day}
                        </span>
                      </div>

                      {/* Activity indicators */}
                      <div className="flex flex-col gap-0.5">
                        {dayActivities.slice(0, 3).map((activity) => (
                          <ActivityIndicator key={activity.activityId} activity={activity} />
                        ))}
                        {dayActivities.length > 3 && (
                          <span className="text-[10px] text-text-muted">
                            +{dayActivities.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Activity Indicator Sub-component ─────────────────────────────────────────

function ActivityIndicator({ activity }: { activity: Activity }) {
  const color = ACTIVITY_TYPE_COLORS[activity.activityType] ?? ACTIVITY_TYPE_COLORS.other;
  const label = ACTIVITY_TYPE_LABELS[activity.activityType] ?? 'Other';
  const duration = formatDuration(activity.duration);

  return (
    <div
      className="flex items-center gap-1 rounded-sm px-1 py-0.5"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
      title={`${label} — ${duration}`}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate text-[10px] font-medium text-text-primary">{label}</span>
      <span className="ml-auto text-[9px] text-text-muted">{duration}</span>
    </div>
  );
}

export default TrainingCalendarView;
