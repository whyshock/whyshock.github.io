/**
 * TanStack Query hooks for training and performance data.
 * Derives training metrics from the uploaded activity and daily summary data.
 */

import { useQuery } from '@tanstack/react-query';
import { useDataStore } from '@/stores/data-store';
import type { PersonalRecord, TrainingStatus } from '@/types/garmin';

/**
 * Query key factory for training data.
 */
export const trainingKeys = {
  all: ['training'] as const,
  personalRecords: () => [...trainingKeys.all, 'personalRecords'] as const,
  trainingStatus: () => [...trainingKeys.all, 'trainingStatus'] as const,
};

/**
 * Derives personal records from activity data in the store.
 */
export function usePersonalRecords() {
  const activities = useDataStore((s) => s.activities);
  const isDataLoaded = useDataStore((s) => s.isDataLoaded);

  return useQuery<PersonalRecord[], Error>({
    queryKey: trainingKeys.personalRecords(),
    queryFn: () => {
      const records: PersonalRecord[] = [];

      // Find longest run
      const runs = activities.filter((a) => a.activityType === 'running' && a.distance);
      if (runs.length > 0) {
        const longest = runs.reduce((prev, curr) =>
          (curr.distance ?? 0) > (prev.distance ?? 0) ? curr : prev
        );
        records.push({
          recordType: 'longest_run',
          value: longest.distance ?? 0,
          unit: 'meters',
          activityId: longest.activityId,
          date: longest.startTime,
        });

        // Fastest 5K
        const fiveKRuns = runs.filter((a) => (a.distance ?? 0) >= 5000);
        if (fiveKRuns.length > 0) {
          const fastest5K = fiveKRuns.reduce((prev, curr) => {
            const prevPace = prev.duration / ((prev.distance ?? 5000) / 5000);
            const currPace = curr.duration / ((curr.distance ?? 5000) / 5000);
            return currPace < prevPace ? curr : prev;
          });
          records.push({
            recordType: 'fastest_5k',
            value: fastest5K.duration * (5000 / (fastest5K.distance ?? 5000)),
            unit: 'seconds',
            activityId: fastest5K.activityId,
            date: fastest5K.startTime,
          });
        }
      }

      // Find longest cycling
      const rides = activities.filter((a) => a.activityType === 'cycling' && a.distance);
      if (rides.length > 0) {
        const longest = rides.reduce((prev, curr) =>
          (curr.distance ?? 0) > (prev.distance ?? 0) ? curr : prev
        );
        records.push({
          recordType: 'longest_ride',
          value: longest.distance ?? 0,
          unit: 'meters',
          activityId: longest.activityId,
          date: longest.startTime,
        });
      }

      // Highest elevation gain
      const withElevation = activities.filter((a) => a.elevationGain && a.elevationGain > 0);
      if (withElevation.length > 0) {
        const highest = withElevation.reduce((prev, curr) =>
          (curr.elevationGain ?? 0) > (prev.elevationGain ?? 0) ? curr : prev
        );
        records.push({
          recordType: 'highest_elevation',
          value: highest.elevationGain ?? 0,
          unit: 'meters',
          activityId: highest.activityId,
          date: highest.startTime,
        });
      }

      return Promise.resolve(records);
    },
    enabled: isDataLoaded,
    staleTime: Infinity,
  });
}

/**
 * Derives training status from recent activity and wellness data.
 */
export function useTrainingStatus() {
  const activities = useDataStore((s) => s.activities);
  const dailySummaries = useDataStore((s) => s.dailySummaries);
  const isDataLoaded = useDataStore((s) => s.isDataLoaded);

  return useQuery<TrainingStatus, Error>({
    queryKey: trainingKeys.trainingStatus(),
    queryFn: () => {
      // Calculate a simple training load from recent activities (last 7 days)
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentActivities = activities.filter(
        (a) => new Date(a.startTime) >= weekAgo
      );

      // Simple training load: sum of duration * intensity proxy (HR if available)
      const trainingLoad = recentActivities.reduce((sum, a) => {
        const intensity = a.averageHR ? a.averageHR / 180 : 0.5; // Normalize HR
        return sum + (a.duration / 60) * intensity;
      }, 0);

      // Get VO2Max from recent daily summaries if available
      const recentSummary = dailySummaries.find((s) => s.vo2Max);
      const vo2Max = recentSummary?.vo2Max ?? 0;

      // Estimate recovery time based on training load
      const recoveryTimeHours = Math.min(72, Math.max(0, trainingLoad / 10));

      const status: TrainingStatus = {
        vo2Max,
        trainingLoad: Math.round(trainingLoad),
        trainingLoadBalance:
          trainingLoad > 500 ? 'overreaching' : trainingLoad < 50 ? 'detraining' : 'optimal',
        recoveryTimeHours: Math.round(recoveryTimeHours),
      };

      return Promise.resolve(status);
    },
    enabled: isDataLoaded,
    staleTime: Infinity,
  });
}
