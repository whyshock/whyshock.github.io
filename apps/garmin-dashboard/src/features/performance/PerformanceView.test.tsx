/**
 * Unit tests for PerformanceView component and its calculation utilities.
 *
 * Tests loading, error, empty states, race predictions, and functional threshold.
 * Validates: Requirements 4.5, 4.6
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PerformanceView,
  estimateRaceTimes,
  estimateFunctionalThreshold,
  formatRaceTime,
  formatPace,
} from './PerformanceView';
import type { TrainingStatus } from '@/types/garmin';

// ─── Mock the training hooks ──────────────────────────────────────────────────

const mockRefetch = vi.fn();

vi.mock('@/features/training/hooks', () => ({
  useTrainingStatus: vi.fn(),
}));

import { useTrainingStatus } from '@/features/training/hooks';
const mockUseTrainingStatus = vi.mocked(useTrainingStatus);

// ─── Component Tests ──────────────────────────────────────────────────────────

describe('PerformanceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state while fetching data', () => {
    mockUseTrainingStatus.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<PerformanceView />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading performance metrics')).toBeInTheDocument();
  });

  it('displays error state with retry button', () => {
    mockUseTrainingStatus.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Service unavailable'),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<PerformanceView />);

    expect(screen.getByText('Unable to load performance metrics')).toBeInTheDocument();
    expect(screen.getByText('Service unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('calls refetch when retry button is clicked', () => {
    mockUseTrainingStatus.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed'),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<PerformanceView />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('displays "Training data needed" when no VO2 max is available', () => {
    mockUseTrainingStatus.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<PerformanceView />);

    expect(screen.getByText('Training data needed')).toBeInTheDocument();
    expect(
      screen.getByText(/Performance metrics require VO2 max data/),
    ).toBeInTheDocument();
  });

  it('displays race predictor section with all four race distances', () => {
    const data: TrainingStatus = {
      vo2Max: 50,
      trainingLoad: 300,
      trainingLoadBalance: 'optimal',
      recoveryTimeHours: 12,
    };

    mockUseTrainingStatus.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<PerformanceView />);

    expect(screen.getByText('Race Predictor')).toBeInTheDocument();
    expect(screen.getByText('5K')).toBeInTheDocument();
    expect(screen.getByText('10K')).toBeInTheDocument();
    expect(screen.getByText('Half Marathon')).toBeInTheDocument();
    expect(screen.getByText('Marathon')).toBeInTheDocument();
  });

  it('displays functional threshold section', () => {
    const data: TrainingStatus = {
      vo2Max: 50,
      trainingLoad: 300,
      trainingLoadBalance: 'optimal',
      recoveryTimeHours: 12,
    };

    mockUseTrainingStatus.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<PerformanceView />);

    expect(screen.getByText('Functional Threshold')).toBeInTheDocument();
    expect(screen.getByText('Running Threshold Pace')).toBeInTheDocument();
    expect(screen.getByText('Cycling FTP (est.)')).toBeInTheDocument();
  });

  it('shows VO2 max value in race predictor description', () => {
    const data: TrainingStatus = {
      vo2Max: 48,
      trainingLoad: 250,
      trainingLoadBalance: 'optimal',
      recoveryTimeHours: 8,
    };

    mockUseTrainingStatus.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<PerformanceView />);

    expect(screen.getByText(/48 ml\/kg\/min/)).toBeInTheDocument();
  });
});

// ─── Utility Function Tests ───────────────────────────────────────────────────

describe('estimateRaceTimes', () => {
  it('returns predictions for 4 race distances', () => {
    const predictions = estimateRaceTimes(50);
    expect(predictions).toHaveLength(4);
    expect(predictions.map((p) => p.name)).toEqual(['5K', '10K', 'Half Marathon', 'Marathon']);
  });

  it('produces longer times for lower VO2 max', () => {
    const fastRunner = estimateRaceTimes(60);
    const slowRunner = estimateRaceTimes(35);

    for (let i = 0; i < fastRunner.length; i++) {
      expect(fastRunner[i].predictedTimeSeconds).toBeLessThan(
        slowRunner[i].predictedTimeSeconds,
      );
    }
  });

  it('produces monotonically increasing times for increasing distances', () => {
    const predictions = estimateRaceTimes(50);

    for (let i = 1; i < predictions.length; i++) {
      expect(predictions[i].predictedTimeSeconds).toBeGreaterThan(
        predictions[i - 1].predictedTimeSeconds,
      );
    }
  });

  it('produces reasonable 5K times for typical VO2 max values', () => {
    // A VO2 max of 50 should give roughly 20-25 min 5K
    const predictions = estimateRaceTimes(50);
    const fiveKMinutes = predictions[0].predictedTimeSeconds / 60;
    expect(fiveKMinutes).toBeGreaterThan(15);
    expect(fiveKMinutes).toBeLessThan(30);
  });
});

describe('estimateFunctionalThreshold', () => {
  it('returns running pace and cycling FTP', () => {
    const threshold = estimateFunctionalThreshold(50);
    expect(threshold.runningPaceSecondsPerKm).toBeGreaterThan(0);
    expect(threshold.cyclingFTPWattsPerKg).toBeGreaterThan(0);
  });

  it('produces faster running pace for higher VO2 max', () => {
    const fitRunner = estimateFunctionalThreshold(60);
    const avgRunner = estimateFunctionalThreshold(40);

    // Lower seconds per km = faster
    expect(fitRunner.runningPaceSecondsPerKm).toBeLessThan(
      avgRunner.runningPaceSecondsPerKm,
    );
  });

  it('produces higher cycling FTP for higher VO2 max', () => {
    const fitCyclist = estimateFunctionalThreshold(60);
    const avgCyclist = estimateFunctionalThreshold(40);

    expect(fitCyclist.cyclingFTPWattsPerKg).toBeGreaterThan(
      avgCyclist.cyclingFTPWattsPerKg,
    );
  });
});

describe('formatRaceTime', () => {
  it('formats minutes and seconds for times under 1 hour', () => {
    expect(formatRaceTime(1234)).toBe('20:34');
  });

  it('formats hours, minutes, and seconds for times over 1 hour', () => {
    expect(formatRaceTime(5400)).toBe('1:30:00');
  });

  it('pads seconds with leading zero', () => {
    expect(formatRaceTime(605)).toBe('10:05');
  });
});

describe('formatPace', () => {
  it('formats pace as minutes:seconds /km', () => {
    expect(formatPace(300)).toBe('5:00 /km');
  });

  it('pads seconds with leading zero', () => {
    expect(formatPace(245)).toBe('4:05 /km');
  });
});
