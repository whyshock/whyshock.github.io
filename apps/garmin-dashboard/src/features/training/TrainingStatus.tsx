/**
 * Training Status component — displays VO2 max, training load, and recovery time.
 * Provides informative messages when data is unavailable.
 *
 * Validates: Requirements 4.3, 4.6
 */

import { useTrainingStatus } from './hooks';
import type { TrainingLoadBalance } from '@/types/garmin';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps VO2 max value to a fitness level label.
 * Based on standard VO2 max classification tables for adults.
 */
function getVO2MaxLevel(vo2Max: number): { label: string; color: string } {
  if (vo2Max >= 56) return { label: 'Excellent', color: 'text-green-600' };
  if (vo2Max >= 47) return { label: 'Good', color: 'text-blue-600' };
  if (vo2Max >= 38) return { label: 'Fair', color: 'text-yellow-600' };
  if (vo2Max >= 27) return { label: 'Poor', color: 'text-orange-600' };
  return { label: 'Very Poor', color: 'text-red-600' };
}

/**
 * Returns display label and color for training load balance.
 */
function getLoadBalanceDisplay(balance: TrainingLoadBalance): { label: string; color: string } {
  switch (balance) {
    case 'optimal':
      return { label: 'Optimal', color: 'text-green-600' };
    case 'overreaching':
      return { label: 'Overreaching', color: 'text-orange-600' };
    case 'detraining':
      return { label: 'Detraining', color: 'text-yellow-600' };
    default:
      return { label: 'Unknown', color: 'text-text-secondary' };
  }
}

/**
 * Formats recovery time in hours to a human-readable string.
 */
function formatRecoveryTime(hours: number): string {
  if (hours <= 0) return 'Fully recovered';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrainingStatus() {
  const { data: trainingStatus, isLoading, isError, error, refetch } = useTrainingStatus();

  // ─── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-8"
        role="status"
        aria-label="Loading training status"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/5 p-6 text-center">
        <p className="font-medium text-text-primary">Unable to load training status</p>
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

  // ─── Empty / unavailable state ────────────────────────────────────────────

  if (!trainingStatus) {
    return (
      <div className="rounded-lg border border-border bg-bg-secondary p-6 text-center">
        <p className="font-medium text-text-primary">Training status unavailable</p>
        <p className="mt-1 text-sm text-text-secondary">
          Training data is not yet available. Continue recording activities to generate your training
          status metrics.
        </p>
      </div>
    );
  }

  // ─── Data display ─────────────────────────────────────────────────────────

  const vo2Level = getVO2MaxLevel(trainingStatus.vo2Max);
  const loadBalance = getLoadBalanceDisplay(trainingStatus.trainingLoadBalance);

  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-label="Training status metrics">
      {/* VO2 Max */}
      <div className="rounded-lg border border-border bg-bg-secondary p-4">
        <h3 className="text-sm font-medium text-text-muted">VO2 Max</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-text-primary">
            {trainingStatus.vo2Max}
          </span>
          <span className="text-sm text-text-muted">ml/kg/min</span>
        </div>
        <p className={`mt-1 text-sm font-medium ${vo2Level.color}`}>
          {vo2Level.label}
        </p>
      </div>

      {/* Training Load */}
      <div className="rounded-lg border border-border bg-bg-secondary p-4">
        <h3 className="text-sm font-medium text-text-muted">Training Load</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-text-primary">
            {trainingStatus.trainingLoad}
          </span>
        </div>
        <p className={`mt-1 text-sm font-medium ${loadBalance.color}`}>
          {loadBalance.label}
        </p>
      </div>

      {/* Recovery Time */}
      <div className="rounded-lg border border-border bg-bg-secondary p-4">
        <h3 className="text-sm font-medium text-text-muted">Recovery Time</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-text-primary">
            {formatRecoveryTime(trainingStatus.recoveryTimeHours)}
          </span>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          {trainingStatus.recoveryTimeHours <= 0
            ? 'Ready for your next workout'
            : 'Until full recovery'}
        </p>
      </div>
    </div>
  );
}

export default TrainingStatus;
