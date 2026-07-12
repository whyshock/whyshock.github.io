/**
 * Data summary shown after successful upload and parsing.
 * Displays statistics about the imported data and provides navigation options.
 */

import type { ParseResult } from '@/services/garmin-parser';
import { useDataStore } from '@/stores/data-store';

interface DataSummaryProps {
  result: ParseResult;
  onProceed: () => void;
  onReset: () => void;
}

export function DataSummary({ result, onProceed, onReset }: DataSummaryProps) {
  const clearData = useDataStore((s) => s.clearData);

  const handleClearAndReset = async () => {
    await clearData();
    onReset();
  };

  const activityCount = result.activities.length;
  const daysCount = result.dailySummaries.length;
  const profileName = result.userProfile?.displayName ?? 'Unknown';
  const errorCount = result.errors.length;

  // Calculate date range
  let dateRange = '';
  if (result.activities.length > 0) {
    const dates = result.activities.map((a) => new Date(a.startTime).getTime());
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));
    dateRange = `${earliest.toLocaleDateString()} — ${latest.toLocaleDateString()}`;
  }

  // Count activity types
  const typeCounts = result.activities.reduce(
    (acc, a) => {
      acc[a.activityType] = (acc[a.activityType] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg-primary">
      <div className="w-full max-w-lg">
        {/* Success Icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Data Imported Successfully</h1>
          {result.userProfile && (
            <p className="text-text-secondary mt-1">Welcome, {profileName}</p>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-bg-secondary border border-border">
            <p className="text-2xl font-bold text-primary">{activityCount}</p>
            <p className="text-sm text-text-secondary">Activities</p>
          </div>
          <div className="p-4 rounded-lg bg-bg-secondary border border-border">
            <p className="text-2xl font-bold text-accent">{daysCount}</p>
            <p className="text-sm text-text-secondary">Days of Health Data</p>
          </div>
        </div>

        {/* Details */}
        <div className="p-4 rounded-lg bg-bg-secondary border border-border mb-6 space-y-3">
          {dateRange && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Date Range</span>
              <span className="text-text-primary font-medium">{dateRange}</span>
            </div>
          )}

          {Object.keys(typeCounts).length > 0 && (
            <div>
              <p className="text-sm text-text-secondary mb-2">Activity Breakdown</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <span
                      key={type}
                      className="px-2 py-1 text-xs rounded-md bg-bg-tertiary text-text-primary"
                    >
                      {type.replace('_', ' ')}: {count}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {errorCount > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-warning">
                {errorCount} file{errorCount > 1 ? 's' : ''} could not be parsed (non-critical)
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onProceed}
            className="flex-1 px-6 py-3 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            View Dashboard →
          </button>
          <button
            onClick={handleClearAndReset}
            className="px-6 py-3 text-sm font-medium rounded-lg border border-border text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            Re-upload
          </button>
        </div>

        <p className="text-xs text-text-muted text-center mt-4">
          Your data is stored locally in your browser. No server involved.
        </p>
      </div>
    </div>
  );
}
