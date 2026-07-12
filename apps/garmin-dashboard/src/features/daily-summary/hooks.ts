/**
 * TanStack Query hooks for daily summary data.
 * Reads from the Zustand data store (populated from uploaded Garmin exports).
 */

import { useQuery } from '@tanstack/react-query';
import { useDataStore } from '@/stores/data-store';
import type { DailySummary, DateRange } from '@/types/garmin';

/**
 * Query key factory for daily summaries.
 */
export const dailySummaryKeys = {
  all: ['dailySummary'] as const,
  range: (dateRange: DateRange) =>
    [...dailySummaryKeys.all, dateRange.startDate, dateRange.endDate] as const,
};

/**
 * Returns daily summaries filtered by date range from the local store.
 */
export function useDailySummary(dateRange: DateRange | undefined) {
  const dailySummaries = useDataStore((s) => s.dailySummaries);
  const isDataLoaded = useDataStore((s) => s.isDataLoaded);

  return useQuery<DailySummary[], Error>({
    queryKey: dailySummaryKeys.range(dateRange ?? { startDate: '', endDate: '' }),
    queryFn: () => {
      if (!dateRange) return Promise.resolve([]);

      const filtered = dailySummaries.filter((summary) => {
        return summary.date >= dateRange.startDate && summary.date <= dateRange.endDate;
      });

      return Promise.resolve(filtered);
    },
    enabled: isDataLoaded && !!dateRange,
    staleTime: Infinity,
  });
}

/**
 * Returns all daily summaries without date filtering.
 */
export function useAllDailySummaries() {
  const dailySummaries = useDataStore((s) => s.dailySummaries);
  const isDataLoaded = useDataStore((s) => s.isDataLoaded);

  return useQuery<DailySummary[], Error>({
    queryKey: dailySummaryKeys.all,
    queryFn: () => Promise.resolve(dailySummaries),
    enabled: isDataLoaded,
    staleTime: Infinity,
  });
}
