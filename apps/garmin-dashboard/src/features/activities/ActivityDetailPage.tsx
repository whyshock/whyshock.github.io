import { useParams } from 'react-router-dom';
import { useActivityDetail } from '@/features/activities/hooks';
import { ActivityMap } from '@/components/maps';

/**
 * Activity detail page — displays detailed metrics for a single activity.
 * Renders an interactive GPS map when the activity has GPS route data.
 *
 * Requirements: 2.3, 2.7, 4.4, 4.7
 */
export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: activity, isLoading, isError, error, refetch } = useActivityDetail(id ?? '');

  if (isLoading) {
    return (
      <div className="p-6" role="status" aria-label="Loading activity detail">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-bg-tertiary" />
          <div className="h-4 w-64 rounded bg-bg-tertiary" />
          <div className="h-80 w-full rounded bg-bg-tertiary" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-error/20 bg-error/5 p-4">
          <h2 className="text-lg font-semibold text-error">Unable to load activity</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="p-6">
        <p className="text-text-secondary">Activity not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {activity.activityName || 'Activity Detail'}
        </h1>
        <p className="mt-1 text-text-secondary">
          {activity.activityType} &middot;{' '}
          {new Date(activity.startTime).toLocaleDateString()}
        </p>
      </div>

      {/* Metrics summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Duration" value={formatDuration(activity.duration)} />
        {activity.distance !== undefined && (
          <MetricCard label="Distance" value={formatDistance(activity.distance)} />
        )}
        {activity.averageHR !== undefined && (
          <MetricCard label="Avg HR" value={`${activity.averageHR} bpm`} />
        )}
        {activity.elevationGain !== undefined && (
          <MetricCard label="Elevation" value={`${activity.elevationGain} m`} />
        )}
        {activity.calories !== undefined && (
          <MetricCard label="Calories" value={`${activity.calories} kcal`} />
        )}
      </div>

      {/* Heart Rate Zones */}
      {activity.heartRateZones && activity.heartRateZones.length > 0 && (
        <section aria-labelledby="hr-zones-heading">
          <h2 id="hr-zones-heading" className="text-lg font-semibold text-text-primary mb-3">
            Heart Rate Zones
          </h2>
          <div className="space-y-2">
            {activity.heartRateZones.map((zone) => (
              <div key={zone.zone} className="flex items-center gap-3">
                <span className="w-16 text-sm text-text-secondary">Zone {zone.zone}</span>
                <div className="flex-1 h-4 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${zone.percentageInZone}%` }}
                  />
                </div>
                <span className="w-12 text-sm text-text-secondary text-right">
                  {zone.percentageInZone}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* GPS Route Map — only render when GPS data is available */}
      {activity.gpsRoute && activity.gpsRoute.length > 0 && (
        <section aria-labelledby="map-heading">
          <h2 id="map-heading" className="text-lg font-semibold text-text-primary mb-3">
            Route Map
          </h2>
          <ActivityMap gpsRoute={activity.gpsRoute} />
        </section>
      )}

      {/* Exercises for strength training */}
      {activity.exercises && activity.exercises.length > 0 && (
        <section aria-labelledby="exercises-heading">
          <h2 id="exercises-heading" className="text-lg font-semibold text-text-primary mb-3">
            Exercises
          </h2>
          <div className="space-y-2">
            {activity.exercises.map((exercise, idx) => (
              <div
                key={`${exercise.exerciseName}-${idx}`}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <span className="font-medium text-text-primary">{exercise.exerciseName}</span>
                <span className="text-sm text-text-secondary">
                  {exercise.sets} × {exercise.reps}
                  {exercise.weight !== undefined && ` @ ${exercise.weight} kg`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Placeholder for no GPS data */}
      {activity.hasGPS && (!activity.gpsRoute || activity.gpsRoute.length === 0) && (
        <p className="text-text-muted text-sm">
          GPS data is unavailable for this activity.
        </p>
      )}
    </div>
  );
}

// ─── Helper components and functions ──────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}
