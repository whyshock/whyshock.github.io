/**
 * TanStack Query hooks for activity data.
 * Reads from the Zustand data store (populated from uploaded Garmin exports).
 *
 * Uses TanStack Query for consistent state management interface (loading/error states,
 * caching, refetch patterns) while sourcing data from the local store.
 */

import { useQuery } from '@tanstack/react-query';
import { useDataStore } from '@/stores/data-store';
import type { Activity, ActivityDetail } from '@/types/garmin';

/**
 * Query key factory for activities.
 */
export const activityKeys = {
  all: ['activities'] as const,
  lists: () => [...activityKeys.all, 'list'] as const,
  list: (page: number) => [...activityKeys.lists(), page] as const,
  details: () => [...activityKeys.all, 'detail'] as const,
  detail: (activityId: string) => [...activityKeys.details(), activityId] as const,
};

const PAGE_SIZE = 50;

/**
 * Returns a paginated list of activities from the local store.
 */
export function useActivities(page: number = 0) {
  const activities = useDataStore((s) => s.activities);
  const isDataLoaded = useDataStore((s) => s.isDataLoaded);

  return useQuery<Activity[], Error>({
    queryKey: activityKeys.list(page),
    queryFn: () => {
      const start = page * PAGE_SIZE;
      return Promise.resolve(activities.slice(start, start + PAGE_SIZE));
    },
    enabled: isDataLoaded,
    staleTime: Infinity, // Local data doesn't go stale
  });
}

/**
 * Returns all activities (no pagination). Useful for charts and aggregations.
 */
export function useAllActivities() {
  const activities = useDataStore((s) => s.activities);
  const isDataLoaded = useDataStore((s) => s.isDataLoaded);

  return useQuery<Activity[], Error>({
    queryKey: activityKeys.all,
    queryFn: () => Promise.resolve(activities),
    enabled: isDataLoaded,
    staleTime: Infinity,
  });
}

/**
 * Returns detail for a specific activity from the local store.
 * Since we don't have full ActivityDetail from exports, we map Activity → ActivityDetail.
 */
export function useActivityDetail(activityId: string | undefined) {
  const activities = useDataStore((s) => s.activities);
  const isDataLoaded = useDataStore((s) => s.isDataLoaded);

  return useQuery<ActivityDetail, Error>({
    queryKey: activityKeys.detail(activityId ?? ''),
    queryFn: () => {
      const activity = activities.find((a) => a.activityId === activityId);
      if (!activity) {
        return Promise.reject(new Error('Activity not found'));
      }
      // Map Activity to ActivityDetail (missing detailed metrics from export)
      const detail: ActivityDetail = {
        ...activity,
        heartRateZones: undefined,
        pace: undefined,
        cadence: undefined,
        elevation: undefined,
        gpsRoute: undefined,
        exercises: undefined,
      };
      return Promise.resolve(detail);
    },
    enabled: isDataLoaded && !!activityId,
    staleTime: Infinity,
  });
}
