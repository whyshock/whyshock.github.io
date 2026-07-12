/**
 * ActivityDetail displays comprehensive metrics for a single activity.
 * Sections are conditionally rendered only when their data is available (Req 2.7).
 * Supports: heart rate zones, pace/speed splits, cadence, elevation, exercise sets (strength),
 * and a placeholder for the GPS map component.
 *
 * Validates: Requirements 2.3, 2.7
 */

import type {
  ActivityDetail as ActivityDetailType,
  HeartRateZone,
  PaceData,
  CadenceData,
  ElevationData,
  ExerciseSet,
} from '@/types/garmin';
import { usePreferencesStore } from '@/stores/preferences-store';
import {
  formatDuration,
  formatDistance,
  formatDate,
  formatTime,
  formatActivityType,
  getActivityTypeColor,
} from '@/utils/formatters';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActivityDetailProps {
  activity: ActivityDetailType;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ActivityDetail({ activity }: ActivityDetailProps) {
  const unitSystem = usePreferencesStore((state) => state.unitSystem);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <ActivityHeader activity={activity} unitSystem={unitSystem} />

      {/* Metric Sections — only rendered when data is present */}
      <div className="grid gap-6 lg:grid-cols-2">
        {activity.heartRateZones && activity.heartRateZones.length > 0 && (
          <HeartRateZonesSection zones={activity.heartRateZones} />
        )}

        {activity.pace && activity.pace.length > 0 && (
          <PaceSplitsSection splits={activity.pace} unitSystem={unitSystem} />
        )}

        {activity.cadence && activity.cadence.length > 0 && (
          <CadenceSection cadenceData={activity.cadence} />
        )}

        {activity.elevation && activity.elevation.length > 0 && (
          <ElevationSection elevationData={activity.elevation} unitSystem={unitSystem} />
        )}
      </div>

      {/* Exercise Sets — strength training only */}
      {activity.exercises && activity.exercises.length > 0 && (
        <ExerciseSetsSection exercises={activity.exercises} unitSystem={unitSystem} />
      )}

      {/* GPS Map placeholder */}
      {activity.hasGPS && activity.gpsRoute && activity.gpsRoute.length > 0 && (
        <GPSMapPlaceholder />
      )}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function ActivityHeader({
  activity,
  unitSystem,
}: {
  activity: ActivityDetailType;
  unitSystem: 'metric' | 'imperial';
}) {
  const typeColor = getActivityTypeColor(activity.activityType);
  const typeLabel = formatActivityType(activity.activityType);

  return (
    <section aria-label="Activity summary">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-4 w-4 flex-shrink-0 rounded-full ${typeColor}`}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-text-primary sm:text-2xl">
            {activity.activityName || typeLabel}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            <span className="font-medium">{typeLabel}</span>
            <span className="mx-2">·</span>
            {formatDate(activity.startTime)}
            <span className="ml-2 text-text-muted">{formatTime(activity.startTime)}</span>
          </p>
        </div>
      </div>

      {/* Key metrics bar */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryMetric label="Duration" value={formatDuration(activity.duration)} />
        <SummaryMetric
          label="Distance"
          value={formatDistance(activity.distance, unitSystem)}
        />
        {activity.averageHR !== undefined && (
          <SummaryMetric label="Avg HR" value={`${activity.averageHR} bpm`} />
        )}
        {activity.calories !== undefined && (
          <SummaryMetric label="Calories" value={`${activity.calories} kcal`} />
        )}
        {activity.elevationGain !== undefined && (
          <SummaryMetric
            label="Elevation Gain"
            value={
              unitSystem === 'imperial'
                ? `${Math.round(activity.elevationGain * 3.28084)} ft`
                : `${Math.round(activity.elevationGain)} m`
            }
          />
        )}
        {activity.maxHR !== undefined && (
          <SummaryMetric label="Max HR" value={`${activity.maxHR} bpm`} />
        )}
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold text-text-primary">{value}</p>
    </div>
  );
}

// ─── Heart Rate Zones ─────────────────────────────────────────────────────────

const ZONE_LABELS: Record<number, string> = {
  1: 'Zone 1 (Recovery)',
  2: 'Zone 2 (Easy)',
  3: 'Zone 3 (Moderate)',
  4: 'Zone 4 (Hard)',
  5: 'Zone 5 (Maximum)',
};

const ZONE_COLORS: Record<number, string> = {
  1: 'bg-blue-400',
  2: 'bg-green-400',
  3: 'bg-yellow-400',
  4: 'bg-orange-400',
  5: 'bg-red-500',
};

function HeartRateZonesSection({ zones }: { zones: HeartRateZone[] }) {
  const maxPercentage = Math.max(...zones.map((z) => z.percentageInZone), 1);

  return (
    <section
      className="rounded-lg border border-border bg-bg-secondary p-4"
      aria-label="Heart rate zones"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4">Heart Rate Zones</h3>
      <div className="space-y-3">
        {zones.map((zone) => (
          <div key={zone.zone} className="flex items-center gap-3">
            <span className="w-32 text-xs text-text-secondary flex-shrink-0 sm:w-40">
              {ZONE_LABELS[zone.zone] ?? `Zone ${zone.zone}`}
            </span>
            <div className="flex-1 h-5 bg-bg-tertiary rounded overflow-hidden">
              <div
                className={`h-full rounded ${ZONE_COLORS[zone.zone] ?? 'bg-gray-400'}`}
                style={{ width: `${(zone.percentageInZone / maxPercentage) * 100}%` }}
                role="meter"
                aria-label={`${ZONE_LABELS[zone.zone] ?? `Zone ${zone.zone}`}: ${zone.percentageInZone}%`}
                aria-valuenow={zone.percentageInZone}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span className="w-16 text-xs text-text-muted text-right flex-shrink-0">
              {zone.percentageInZone.toFixed(1)}%
            </span>
            <span className="w-16 text-xs text-text-muted text-right flex-shrink-0 hidden sm:block">
              {formatDuration(zone.timeInZone)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Pace/Speed Splits ────────────────────────────────────────────────────────

function formatPace(secondsPerKm: number, unitSystem: 'metric' | 'imperial'): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';

  let paceSeconds = secondsPerKm;
  if (unitSystem === 'imperial') {
    // Convert seconds/km to seconds/mile
    paceSeconds = secondsPerKm * 1.60934;
  }

  const minutes = Math.floor(paceSeconds / 60);
  const secs = Math.round(paceSeconds % 60);
  const unit = unitSystem === 'imperial' ? '/mi' : '/km';
  return `${minutes}:${String(secs).padStart(2, '0')} ${unit}`;
}

function PaceSplitsSection({
  splits,
  unitSystem,
}: {
  splits: PaceData[];
  unitSystem: 'metric' | 'imperial';
}) {
  return (
    <section
      className="rounded-lg border border-border bg-bg-secondary p-4"
      aria-label="Pace splits"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4">Pace Splits</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Pace splits table">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-medium text-text-muted">Split</th>
              <th className="pb-2 pr-4 font-medium text-text-muted">Pace</th>
              <th className="pb-2 font-medium text-text-muted">Distance</th>
            </tr>
          </thead>
          <tbody>
            {splits.map((split) => (
              <tr key={split.splitIndex} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-4 text-text-primary font-medium">
                  {split.splitIndex}
                </td>
                <td className="py-2 pr-4 text-text-secondary">
                  {formatPace(split.pace, unitSystem)}
                </td>
                <td className="py-2 text-text-secondary">
                  {formatDistance(split.distance, unitSystem)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Cadence ──────────────────────────────────────────────────────────────────

function CadenceSection({ cadenceData }: { cadenceData: CadenceData[] }) {
  const avgCadence =
    cadenceData.reduce((sum, d) => sum + d.value, 0) / cadenceData.length;

  return (
    <section
      className="rounded-lg border border-border bg-bg-secondary p-4"
      aria-label="Cadence"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4">Cadence</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-text-primary">
          {Math.round(avgCadence)}
        </span>
        <span className="text-sm text-text-muted">avg spm</span>
      </div>
      <div className="mt-4">
        <p className="text-xs text-text-muted mb-2">
          {cadenceData.length} data points recorded
        </p>
        <div className="flex items-end gap-px h-16" aria-label="Cadence distribution">
          {sampleDataPoints(cadenceData, 40).map((point, i) => {
            const max = Math.max(...cadenceData.map((d) => d.value), 1);
            const height = (point.value / max) * 100;
            return (
              <div
                key={i}
                className="flex-1 bg-primary/60 rounded-t"
                style={{ height: `${height}%` }}
                aria-hidden="true"
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Elevation Profile ────────────────────────────────────────────────────────

function ElevationSection({
  elevationData,
  unitSystem,
}: {
  elevationData: ElevationData[];
  unitSystem: 'metric' | 'imperial';
}) {
  const minElev = Math.min(...elevationData.map((d) => d.elevation));
  const maxElev = Math.max(...elevationData.map((d) => d.elevation));
  const totalGain = calculateElevationGain(elevationData);

  const formatElev = (m: number) =>
    unitSystem === 'imperial' ? `${Math.round(m * 3.28084)} ft` : `${Math.round(m)} m`;

  const sampledPoints = sampleDataPoints(elevationData, 50);

  return (
    <section
      className="rounded-lg border border-border bg-bg-secondary p-4"
      aria-label="Elevation profile"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4">Elevation Profile</h3>
      <div className="flex gap-4 text-sm text-text-secondary mb-4">
        <span>
          <span className="text-text-muted">Min:</span> {formatElev(minElev)}
        </span>
        <span>
          <span className="text-text-muted">Max:</span> {formatElev(maxElev)}
        </span>
        <span>
          <span className="text-text-muted">Gain:</span> {formatElev(totalGain)}
        </span>
      </div>
      {/* Simple bar chart representation of elevation */}
      <div className="flex items-end gap-px h-24" aria-label="Elevation chart">
        {sampledPoints.map((point, i) => {
          const range = maxElev - minElev || 1;
          const height = ((point.elevation - minElev) / range) * 100;
          return (
            <div
              key={i}
              className="flex-1 bg-green-500/60 rounded-t"
              style={{ height: `${Math.max(height, 2)}%` }}
              aria-hidden="true"
            />
          );
        })}
      </div>
    </section>
  );
}

function calculateElevationGain(data: ElevationData[]): number {
  let gain = 0;
  for (let i = 1; i < data.length; i++) {
    const diff = data[i].elevation - data[i - 1].elevation;
    if (diff > 0) gain += diff;
  }
  return gain;
}

// ─── Exercise Sets (Strength Training) ────────────────────────────────────────

function ExerciseSetsSection({
  exercises,
  unitSystem,
}: {
  exercises: ExerciseSet[];
  unitSystem: 'metric' | 'imperial';
}) {
  const formatWeight = (weight: number | undefined) => {
    if (weight === undefined) return '—';
    if (unitSystem === 'imperial') return `${Math.round(weight * 2.20462)} lbs`;
    return `${weight} kg`;
  };

  return (
    <section
      className="rounded-lg border border-border bg-bg-secondary p-4"
      aria-label="Exercise sets"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4">Exercise Sets</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Exercise sets table">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-medium text-text-muted">Exercise</th>
              <th className="pb-2 pr-4 font-medium text-text-muted">Sets</th>
              <th className="pb-2 pr-4 font-medium text-text-muted">Reps</th>
              <th className="pb-2 font-medium text-text-muted">Weight</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((exercise, index) => (
              <tr
                key={`${exercise.exerciseName}-${index}`}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 pr-4 text-text-primary font-medium">
                  {exercise.exerciseName}
                </td>
                <td className="py-2 pr-4 text-text-secondary">{exercise.sets}</td>
                <td className="py-2 pr-4 text-text-secondary">{exercise.reps}</td>
                <td className="py-2 text-text-secondary">
                  {formatWeight(exercise.weight)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── GPS Map Placeholder ──────────────────────────────────────────────────────

function GPSMapPlaceholder() {
  return (
    <section
      className="rounded-lg border border-border bg-bg-secondary p-4"
      aria-label="GPS route map"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4">Route Map</h3>
      <div
        className="flex items-center justify-center h-64 rounded-md bg-bg-tertiary border border-border/50 text-text-muted"
        aria-label="Map will be rendered here"
      >
        Map will be rendered here
      </div>
    </section>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Samples data points for chart rendering. If there are more points than maxPoints,
 * evenly samples across the dataset.
 */
function sampleDataPoints<T>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const sampled: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(data[Math.floor(i * step)]);
  }
  return sampled;
}
