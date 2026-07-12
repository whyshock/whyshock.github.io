/**
 * Formatting utilities for duration, distance, dates, and activity types.
 *
 * Validates: Requirements 2.2
 */

import type { ActivityType, UnitSystem } from '@/types/garmin';

/**
 * Formats a duration in seconds to HH:MM:SS or MM:SS format.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats distance in meters to km or miles based on unit system.
 */
export function formatDistance(meters: number | undefined, unitSystem: UnitSystem): string {
  if (meters === undefined || meters === null || !Number.isFinite(meters)) return '—';

  if (unitSystem === 'imperial') {
    const miles = meters / 1609.344;
    if (miles < 0.01) return '0 mi';
    return `${miles.toFixed(2)} mi`;
  }

  const km = meters / 1000;
  if (km < 0.01) return '0 km';
  return `${km.toFixed(2)} km`;
}

/**
 * Formats an ISO 8601 date string into a readable format.
 */
export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Formats a time portion from an ISO 8601 date string.
 */
export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Returns a display label for an activity type.
 */
export function formatActivityType(type: ActivityType): string {
  const labels: Record<ActivityType, string> = {
    running: 'Running',
    cycling: 'Cycling',
    swimming: 'Swimming',
    walking: 'Walking',
    hiking: 'Hiking',
    strength_training: 'Strength Training',
    yoga: 'Yoga',
    other: 'Other',
  };
  return labels[type] ?? 'Other';
}

/**
 * Returns the Tailwind color class for an activity type indicator.
 */
export function getActivityTypeColor(type: ActivityType): string {
  const colors: Record<ActivityType, string> = {
    running: 'bg-activity-running',
    cycling: 'bg-activity-cycling',
    swimming: 'bg-activity-swimming',
    walking: 'bg-activity-walking',
    hiking: 'bg-activity-hiking',
    strength_training: 'bg-activity-strength',
    yoga: 'bg-activity-yoga',
    other: 'bg-activity-other',
  };
  return colors[type] ?? 'bg-activity-other';
}
