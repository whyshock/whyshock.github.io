/**
 * Unit tests for DailySummaryView component.
 * Tests rendering of metrics, placeholder for missing data, loading/error states.
 *
 * Validates: Requirements 3.1, 3.2, 3.5
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DailySummaryView from './DailySummaryView';
import type { DailySummary } from '@/types/garmin';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRefetch = vi.fn();
let mockQueryResult: {
  data: DailySummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
};

vi.mock('./hooks', () => ({
  useDailySummary: () => mockQueryResult,
}));

vi.mock('@/stores/preferences-store', () => ({
  usePreferencesStore: (selector: (state: { defaultDateRange: number }) => unknown) =>
    selector({ defaultDateRange: 7 }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderView() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DailySummaryView />
    </QueryClientProvider>,
  );
}

function makeSummary(overrides: Partial<DailySummary> = {}): DailySummary {
  return {
    date: '2024-01-15',
    steps: 8500,
    restingHeartRate: 62,
    sleepDuration: 420,
    sleepStages: { deep: 90, light: 180, rem: 120, awake: 30 },
    stressLevel: 35,
    bodyBattery: 72,
    respirationRate: 16,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DailySummaryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult = {
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    };
  });

  describe('Loading State', () => {
    it('shows loading indicator when data is loading', () => {
      mockQueryResult.isLoading = true;
      renderView();

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading daily summary...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message with retry button on error', () => {
      mockQueryResult.isError = true;
      mockQueryResult.error = new Error('Network failure');
      renderView();

      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
      expect(screen.getByText('Network failure')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('calls refetch when retry button is clicked', () => {
      mockQueryResult.isError = true;
      mockQueryResult.error = new Error('Fetch error');
      renderView();

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(mockRefetch).toHaveBeenCalledOnce();
    });
  });

  describe('Data Display', () => {
    it('displays all metrics for a complete daily summary', () => {
      const summary = makeSummary({ date: getRecentDate(0) });
      mockQueryResult.data = [summary];
      renderView();

      expect(screen.getByText('8,500')).toBeInTheDocument();
      expect(screen.getByText('62')).toBeInTheDocument();
      expect(screen.getByText('7h 0m')).toBeInTheDocument();
      expect(screen.getByText('35')).toBeInTheDocument();
      expect(screen.getByText('72')).toBeInTheDocument();
      expect(screen.getByText('16')).toBeInTheDocument();
    });

    it('displays sleep stages breakdown', () => {
      const summary = makeSummary({ date: getRecentDate(0) });
      mockQueryResult.data = [summary];
      renderView();

      expect(screen.getByText(/Deep: 90m/)).toBeInTheDocument();
      expect(screen.getByText(/Light: 180m/)).toBeInTheDocument();
      expect(screen.getByText(/REM: 120m/)).toBeInTheDocument();
      expect(screen.getByText(/Awake: 30m/)).toBeInTheDocument();
    });

    it('shows placeholder for dates with no data', () => {
      // Return empty array so no dates have data
      mockQueryResult.data = [];
      renderView();

      const placeholders = screen.getAllByText('No data available');
      // Default range is 7 days, so we should see 7 placeholders
      expect(placeholders).toHaveLength(7);
    });

    it('handles partial data gracefully (missing optional metrics)', () => {
      const summary = makeSummary({
        date: getRecentDate(0),
        restingHeartRate: undefined,
        sleepDuration: undefined,
        sleepStages: undefined,
        stressLevel: undefined,
        bodyBattery: undefined,
        respirationRate: undefined,
      });
      mockQueryResult.data = [summary];
      renderView();

      // Steps should still show
      expect(screen.getByText('8,500')).toBeInTheDocument();
      // Optional metrics should not render
      expect(screen.queryByText('Resting HR')).not.toBeInTheDocument();
      expect(screen.queryByText('Sleep Duration')).not.toBeInTheDocument();
      expect(screen.queryByText('Sleep Stages')).not.toBeInTheDocument();
      expect(screen.queryByText('Stress Level')).not.toBeInTheDocument();
      expect(screen.queryByText('Body Battery')).not.toBeInTheDocument();
      expect(screen.queryByText('Respiration Rate')).not.toBeInTheDocument();
    });
  });

  describe('Date Range Selector', () => {
    it('renders date range buttons (7d, 30d, 90d)', () => {
      mockQueryResult.data = [];
      renderView();

      expect(screen.getByRole('button', { name: '7 Days' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '30 Days' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '90 Days' })).toBeInTheDocument();
    });

    it('defaults to 7 days selected', () => {
      mockQueryResult.data = [];
      renderView();

      const btn = screen.getByRole('button', { name: '7 Days' });
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches date range when a different button is clicked', () => {
      mockQueryResult.data = [];
      renderView();

      const thirtyDayBtn = screen.getByRole('button', { name: '30 Days' });
      fireEvent.click(thirtyDayBtn);

      expect(thirtyDayBtn).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: '7 Days' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });
  });

  describe('Accessibility', () => {
    it('has aria-label on the date range group', () => {
      mockQueryResult.data = [];
      renderView();

      expect(screen.getByRole('group', { name: 'Date range selection' })).toBeInTheDocument();
    });

    it('metric cards have appropriate aria labels', () => {
      const summary = makeSummary({ date: getRecentDate(0) });
      mockQueryResult.data = [summary];
      renderView();

      expect(screen.getByLabelText('8500 steps')).toBeInTheDocument();
      expect(
        screen.getByLabelText('Resting heart rate: 62 beats per minute'),
      ).toBeInTheDocument();
    });
  });
});

// ─── Test Utilities ───────────────────────────────────────────────────────────

/** Get a date string for X days ago */
function getRecentDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
