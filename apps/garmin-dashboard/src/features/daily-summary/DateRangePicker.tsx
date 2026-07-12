/**
 * DateRangePicker — allows users to select a custom date range (up to 90 days)
 * or use quick-select buttons (7d, 30d, 90d).
 *
 * Validates: Requirements 3.3, 3.6, 3.7
 */

import { useCallback, useMemo, useState } from 'react';
import type { DateRange, DateRangeOption } from '@/types/garmin';

export interface DateRangePickerProps {
  /** Current date range value */
  value: DateRange;
  /** Called when the date range changes */
  onChange: (range: DateRange) => void;
  /** Optional: the currently active quick-select option (7, 30, 90) */
  activeQuickSelect?: DateRangeOption | null;
  /** Called when a quick-select button is clicked */
  onQuickSelect?: (days: DateRangeOption) => void;
}

/** Max selectable range in days */
const MAX_RANGE_DAYS = 90;

/**
 * Formats a Date object as YYYY-MM-DD string.
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date as YYYY-MM-DD.
 */
function getTodayString(): string {
  return formatDateString(new Date());
}

/**
 * Calculates the number of days between two date strings (inclusive).
 */
function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function DateRangePicker({
  value,
  onChange,
  activeQuickSelect,
  onQuickSelect,
}: DateRangePickerProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const today = useMemo(() => getTodayString(), []);

  const quickSelectOptions: { label: string; days: DateRangeOption }[] = [
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
  ];

  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStart = e.target.value;
      if (!newStart) return;

      const error = validateRange(newStart, value.endDate);
      setValidationError(error);

      if (!error) {
        onChange({ startDate: newStart, endDate: value.endDate });
      }
    },
    [value.endDate, onChange]
  );

  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newEnd = e.target.value;
      if (!newEnd) return;

      const error = validateRange(value.startDate, newEnd);
      setValidationError(error);

      if (!error) {
        onChange({ startDate: value.startDate, endDate: newEnd });
      }
    },
    [value.startDate, onChange]
  );

  const handleQuickSelect = useCallback(
    (days: DateRangeOption) => {
      setValidationError(null);
      if (onQuickSelect) {
        onQuickSelect(days);
      }
    },
    [onQuickSelect]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Quick select buttons */}
        <div className="flex gap-2" role="group" aria-label="Quick date range selection">
          {quickSelectOptions.map((opt) => (
            <button
              key={opt.days}
              onClick={() => handleQuickSelect(opt.days)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] min-w-[44px] ${
                activeQuickSelect === opt.days
                  ? 'bg-primary text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-border-hover'
              }`}
              aria-pressed={activeQuickSelect === opt.days}
              aria-label={`Select last ${opt.days} days`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 text-sm text-text-secondary">
            <span>From:</span>
            <input
              type="date"
              value={value.startDate}
              max={today}
              onChange={handleStartDateChange}
              className="px-2 py-1.5 rounded-md border border-border bg-bg-primary text-text-primary text-sm min-h-[44px]"
              aria-label="Start date"
            />
          </label>
          <label className="flex items-center gap-1 text-sm text-text-secondary">
            <span>To:</span>
            <input
              type="date"
              value={value.endDate}
              max={today}
              onChange={handleEndDateChange}
              className="px-2 py-1.5 rounded-md border border-border bg-bg-primary text-text-primary text-sm min-h-[44px]"
              aria-label="End date"
            />
          </label>
        </div>
      </div>

      {/* Validation error */}
      {validationError && (
        <p className="text-sm text-red-500" role="alert">
          {validationError}
        </p>
      )}
    </div>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates the date range. Returns an error message string if invalid, or null if valid.
 */
function validateRange(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) {
    return 'Both start and end dates are required.';
  }

  const today = getTodayString();

  if (endDate > today) {
    return 'End date cannot be in the future.';
  }

  if (startDate > endDate) {
    return 'Start date must be before end date.';
  }

  const days = daysBetween(startDate, endDate);
  if (days > MAX_RANGE_DAYS) {
    return `Date range cannot exceed ${MAX_RANGE_DAYS} days. Selected: ${days} days.`;
  }

  return null;
}
