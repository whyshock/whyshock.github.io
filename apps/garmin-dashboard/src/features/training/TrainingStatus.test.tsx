/**
 * Unit tests for TrainingStatus component.
 *
 * Tests loading, error, empty, and data display states.
 * Validates: Requirements 4.3, 4.6
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrainingStatus } from './TrainingStatus';
import type { TrainingStatus as TrainingStatusType } from '@/types/garmin';

// ─── Mock the training hooks ──────────────────────────────────────────────────

const mockRefetch = vi.fn();

vi.mock('./hooks', () => ({
  useTrainingStatus: vi.fn(),
}));

import { useTrainingStatus } from './hooks';
const mockUseTrainingStatus = vi.mocked(useTrainingStatus);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TrainingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state while fetching training status', () => {
    mockUseTrainingStatus.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<TrainingStatus />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading training status')).toBeInTheDocument();
  });

  it('displays error state with retry button', () => {
    mockUseTrainingStatus.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('API rate limited'),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<TrainingStatus />);

    expect(screen.getByText('Unable to load training status')).toBeInTheDocument();
    expect(screen.getByText('API rate limited')).toBeInTheDocument();
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

    render(<TrainingStatus />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('displays unavailable message when no training status data', () => {
    mockUseTrainingStatus.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<TrainingStatus />);

    expect(screen.getByText('Training status unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(/Continue recording activities to generate your training status metrics/),
    ).toBeInTheDocument();
  });

  it('displays VO2 max with level indicator', () => {
    const data: TrainingStatusType = {
      vo2Max: 50,
      trainingLoad: 350,
      trainingLoadBalance: 'optimal',
      recoveryTimeHours: 24,
    };

    mockUseTrainingStatus.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<TrainingStatus />);

    expect(screen.getByText('VO2 Max')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('ml/kg/min')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('displays training load with balance label', () => {
    const data: TrainingStatusType = {
      vo2Max: 45,
      trainingLoad: 500,
      trainingLoadBalance: 'overreaching',
      recoveryTimeHours: 48,
    };

    mockUseTrainingStatus.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<TrainingStatus />);

    expect(screen.getByText('Training Load')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('Overreaching')).toBeInTheDocument();
  });

  it('displays recovery time in hours', () => {
    const data: TrainingStatusType = {
      vo2Max: 42,
      trainingLoad: 200,
      trainingLoadBalance: 'optimal',
      recoveryTimeHours: 18,
    };

    mockUseTrainingStatus.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<TrainingStatus />);

    expect(screen.getByText('Recovery Time')).toBeInTheDocument();
    expect(screen.getByText('18h')).toBeInTheDocument();
    expect(screen.getByText('Until full recovery')).toBeInTheDocument();
  });

  it('displays "Fully recovered" when recovery time is 0', () => {
    const data: TrainingStatusType = {
      vo2Max: 55,
      trainingLoad: 100,
      trainingLoadBalance: 'detraining',
      recoveryTimeHours: 0,
    };

    mockUseTrainingStatus.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<TrainingStatus />);

    expect(screen.getByText('Fully recovered')).toBeInTheDocument();
    expect(screen.getByText('Ready for your next workout')).toBeInTheDocument();
  });

  it('displays recovery time in days and hours when >= 24h', () => {
    const data: TrainingStatusType = {
      vo2Max: 40,
      trainingLoad: 600,
      trainingLoadBalance: 'overreaching',
      recoveryTimeHours: 50,
    };

    mockUseTrainingStatus.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<TrainingStatus />);

    expect(screen.getByText('2d 2h')).toBeInTheDocument();
  });

  it('classifies VO2 max levels correctly', () => {
    // Excellent (>=56)
    const excellentData: TrainingStatusType = {
      vo2Max: 60,
      trainingLoad: 300,
      trainingLoadBalance: 'optimal',
      recoveryTimeHours: 12,
    };

    mockUseTrainingStatus.mockReturnValue({
      data: excellentData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    const { unmount } = render(<TrainingStatus />);
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    unmount();

    // Poor (27-37)
    const poorData: TrainingStatusType = {
      vo2Max: 30,
      trainingLoad: 100,
      trainingLoadBalance: 'detraining',
      recoveryTimeHours: 0,
    };

    mockUseTrainingStatus.mockReturnValue({
      data: poorData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useTrainingStatus>);

    render(<TrainingStatus />);
    expect(screen.getByText('Poor')).toBeInTheDocument();
  });
});
