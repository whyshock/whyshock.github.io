/**
 * Unit tests for TrainingCalendarView component.
 *
 * Tests the calendar grid rendering, activity indicators,
 * month navigation, and loading/error states.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrainingCalendarView } from './TrainingCalendarView';
import type { Activity } from '@/types/garmin';

// ─── Mock the activities hook ─────────────────────────────────────────────────

const mockRefetch = vi.fn();

vi.mock('@/features/activities/hooks', () => ({
  useActivities: vi.fn(),
}));

import { useActivities } from '@/features/activities/hooks';
const mockUseActivities = vi.mocked(useActivities);

// ─── Test data ────────────────────────────────────────────────────────────────

function createActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    activityId: 'act-1',
    activityType: 'running',
    activityName: 'Morning Run',
    startTime: '2024-06-15T07:30:00Z',
    duration: 3600, // 1 hour
    distance: 10000,
    calories: 500,
    averageHR: 145,
    maxHR: 170,
    hasGPS: true,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TrainingCalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state while fetching activities', () => {
    mockUseActivities.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading training calendar')).toBeInTheDocument();
  });

  it('displays error state with retry button', () => {
    mockUseActivities.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    expect(screen.getByText('Unable to load training calendar')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('calls refetch when retry button is clicked', () => {
    mockUseActivities.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed'),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders calendar grid with weekday headers (Mon-Sun)', () => {
    mockUseActivities.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });

  it('renders month/year label and navigation buttons', () => {
    mockUseActivities.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    // Should show current month/year
    const now = new Date();
    const expectedLabel = now.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();

    // Navigation buttons
    expect(screen.getByLabelText('Previous month')).toBeInTheDocument();
    expect(screen.getByLabelText('Next month')).toBeInTheDocument();
  });

  it('navigates to previous month when clicking previous button', () => {
    mockUseActivities.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    const prevLabel = prevMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(screen.getByText(prevLabel)).toBeInTheDocument();
  });

  it('navigates to next month when clicking next button', () => {
    mockUseActivities.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1);
    const nextLabel = nextMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getByText(nextLabel)).toBeInTheDocument();
  });

  it('displays activity indicators on the correct date', () => {
    const activities: Activity[] = [
      createActivity({
        activityId: 'act-1',
        activityType: 'running',
        startTime: new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          10,
          8,
          0,
        ).toISOString(),
        duration: 1800,
      }),
    ];

    mockUseActivities.mockReturnValue({
      data: activities,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    // Should display activity type label and duration
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByText('30m')).toBeInTheDocument();
  });

  it('displays multiple activities on the same date', () => {
    const day = 15;
    const baseDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      day,
      8,
      0,
    );

    const activities: Activity[] = [
      createActivity({
        activityId: 'act-1',
        activityType: 'running',
        startTime: baseDate.toISOString(),
        duration: 3600,
      }),
      createActivity({
        activityId: 'act-2',
        activityType: 'cycling',
        startTime: new Date(baseDate.getTime() + 3600000 * 4).toISOString(),
        duration: 5400,
      }),
    ];

    mockUseActivities.mockReturnValue({
      data: activities,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByText('Cycle')).toBeInTheDocument();
    expect(screen.getByText('1h')).toBeInTheDocument();
    expect(screen.getByText('1h30m')).toBeInTheDocument();
  });

  it('shows "+N more" when more than 3 activities on a day', () => {
    const day = 12;
    const baseDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      day,
      6,
      0,
    );

    const activities: Activity[] = Array.from({ length: 5 }, (_, i) =>
      createActivity({
        activityId: `act-${i}`,
        activityType: 'running',
        startTime: new Date(baseDate.getTime() + i * 3600000).toISOString(),
        duration: 1800,
      }),
    );

    mockUseActivities.mockReturnValue({
      data: activities,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('renders the calendar grid as an accessible table', () => {
    mockUseActivities.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    expect(screen.getByRole('grid', { name: 'Training calendar' })).toBeInTheDocument();
  });

  it('formats duration correctly for hours and minutes', () => {
    const activities: Activity[] = [
      createActivity({
        activityId: 'act-1',
        activityType: 'hiking',
        startTime: new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          5,
          9,
          0,
        ).toISOString(),
        duration: 7200, // 2 hours exactly
      }),
    ];

    mockUseActivities.mockReturnValue({
      data: activities,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActivities>);

    render(<TrainingCalendarView />);

    expect(screen.getByText('Hike')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
  });
});
