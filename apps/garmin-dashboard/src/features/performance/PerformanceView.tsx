/**
 * Performance View — displays race predictor estimates and functional threshold.
 * Race times are derived from VO2 max using standard formulas.
 * Functional threshold (FTP) is estimated from VO2 max.
 *
 * Validates: Requirements 4.5, 4.6
 */

import { useMemo } from 'react';
import { useTrainingStatus } from '@/features/training/hooks';

// ─── Race prediction utilities ────────────────────────────────────────────────

interface RacePrediction {
  name: string;
  distanceKm: number;
  predictedTimeSeconds: number;
}

/**
 * Estimates race pace (min/km) from VO2 max using the Daniels formula.
 * vVO2max (velocity at VO2 max) ≈ 29.54 + 5.000663 * VO2max - 0.007546 * VO2max^2
 * This gives meters per minute at VO2 max. We derive race estimates from this.
 *
 * For simplicity, we use a well-known lookup-based approach:
 * VO2 max → estimated 5K time, then Riegel formula for other distances.
 */
function estimateRaceTimes(vo2Max: number): RacePrediction[] {
  // Estimate 5K time from VO2 max using Daniels/Gilbert formula approximation
  // T(5K) in minutes ≈ derived from vVO2max
  const vVO2max = 29.54 + 5.000663 * vo2Max - 0.007546 * vo2Max * vo2Max; // meters/min
  const fiveKTimeMinutes = 5000 / (vVO2max * 0.9); // ~90% vVO2max sustained for 5K

  const fiveKTimeSeconds = fiveKTimeMinutes * 60;

  // Riegel formula: T2 = T1 * (D2/D1)^1.06
  const riegelExponent = 1.06;
  const fiveKDistanceKm = 5;

  const races = [
    { name: '5K', distanceKm: 5 },
    { name: '10K', distanceKm: 10 },
    { name: 'Half Marathon', distanceKm: 21.0975 },
    { name: 'Marathon', distanceKm: 42.195 },
  ];

  return races.map((race) => {
    const predictedTimeSeconds =
      fiveKTimeSeconds * Math.pow(race.distanceKm / fiveKDistanceKm, riegelExponent);
    return {
      name: race.name,
      distanceKm: race.distanceKm,
      predictedTimeSeconds,
    };
  });
}

/**
 * Estimates functional threshold power (cycling) or pace (running) from VO2 max.
 * FTP ≈ VO2 max * 0.75 (approximate watts/kg for cycling FTP).
 * Running threshold pace ≈ 88% of vVO2max.
 */
function estimateFunctionalThreshold(vo2Max: number): {
  runningPaceSecondsPerKm: number;
  cyclingFTPWattsPerKg: number;
} {
  // Running: threshold pace at ~88% vVO2max
  const vVO2max = 29.54 + 5.000663 * vo2Max - 0.007546 * vo2Max * vo2Max; // meters/min
  const thresholdVelocity = vVO2max * 0.88; // meters/min
  const runningPaceSecondsPerKm = (1000 / thresholdVelocity) * 60;

  // Cycling: FTP ≈ VO2 max × 0.075 (watts per kg approximation)
  const cyclingFTPWattsPerKg = vo2Max * 0.075;

  return { runningPaceSecondsPerKm, cyclingFTPWattsPerKg };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatRaceTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PerformanceView() {
  const { data: trainingStatus, isLoading, isError, error, refetch } = useTrainingStatus();

  const racePredictions = useMemo(() => {
    if (!trainingStatus?.vo2Max) return null;
    return estimateRaceTimes(trainingStatus.vo2Max);
  }, [trainingStatus?.vo2Max]);

  const threshold = useMemo(() => {
    if (!trainingStatus?.vo2Max) return null;
    return estimateFunctionalThreshold(trainingStatus.vo2Max);
  }, [trainingStatus?.vo2Max]);

  // ─── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        role="status"
        aria-label="Loading performance metrics"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/5 p-6 text-center">
        <p className="font-medium text-text-primary">Unable to load performance metrics</p>
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

  // ─── No VO2 max data available ────────────────────────────────────────────

  if (!trainingStatus?.vo2Max) {
    return (
      <div className="rounded-lg border border-border bg-bg-secondary p-6 text-center">
        <p className="font-medium text-text-primary">Training data needed</p>
        <p className="mt-1 text-sm text-text-secondary">
          Performance metrics require VO2 max data. Continue recording running or cycling activities
          with a heart rate monitor to generate your VO2 max estimate.
        </p>
      </div>
    );
  }

  // ─── Performance metrics display ──────────────────────────────────────────

  return (
    <div className="space-y-6" aria-label="Performance metrics">
      {/* Race Predictor */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary">Race Predictor</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Estimated race times based on your VO2 max ({trainingStatus.vo2Max} ml/kg/min)
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {racePredictions?.map((race) => (
            <div
              key={race.name}
              className="rounded-lg border border-border bg-bg-secondary p-4"
            >
              <h3 className="text-sm font-medium text-text-muted">{race.name}</h3>
              <p className="mt-2 text-xl font-bold text-text-primary">
                {formatRaceTime(race.predictedTimeSeconds)}
              </p>
              <p className="mt-1 text-xs text-text-muted">{race.distanceKm} km</p>
            </div>
          ))}
        </div>
      </section>

      {/* Functional Threshold */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary">Functional Threshold</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Estimated threshold values derived from your VO2 max
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Running Threshold Pace */}
          <div className="rounded-lg border border-border bg-bg-secondary p-4">
            <h3 className="text-sm font-medium text-text-muted">Running Threshold Pace</h3>
            <p className="mt-2 text-xl font-bold text-text-primary">
              {threshold ? formatPace(threshold.runningPaceSecondsPerKm) : '—'}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Pace you can sustain for ~60 minutes
            </p>
          </div>

          {/* Cycling FTP */}
          <div className="rounded-lg border border-border bg-bg-secondary p-4">
            <h3 className="text-sm font-medium text-text-muted">Cycling FTP (est.)</h3>
            <p className="mt-2 text-xl font-bold text-text-primary">
              {threshold ? `${threshold.cyclingFTPWattsPerKg.toFixed(1)} W/kg` : '—'}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Estimated power at functional threshold
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Export calculation utilities for testing
export { estimateRaceTimes, estimateFunctionalThreshold, formatRaceTime, formatPace };

export default PerformanceView;
