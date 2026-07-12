/**
 * Unit tests for PersonalRecords component.
 *
 * Tests loading state, error state with retry, empty state,
 * and rendering of record cards with correct data.
 *
 * Validates: Requirements 4.2, 4.6, 4.7
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersonalRecords } from './PersonalRecords';
import type { PersonalRecord } from '@/types/garmin';

// ─── Mock the personal records hook ──────────────────────────────────────────

const mockRefetch = vi.fn();

vi.mock('./hooks', () => ({
  usePersonalRecords: vi.fn(),
}));

import { usePersonalRecords } from './hooks';
const mockUsePersonalRecords = vi.mocked(usePersonalRecords);

// ─── Test data ───────────────────────────────────────────────────────────────

function createRecord(overrides: Partial<PersonalRecord> = {}): PersonalRecord {
  return {
    recordType: 'longest_run',
    value: 42.2,
    unit: 'km',
    activityId: 'act-123',
    date: '2024-03-15',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PersonalRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state while fetching records', () => {
    mockUsePersonalRecords.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePersonalRecords>);

    render(<PersonalRecords />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading personal records')).toBeInTheDocument();
  });

  it('displays error state with error message', () => {
    mockUsePersonalRecords.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePersonalRecords>);

    render(<PersonalRecords />);

    expect(screen.getByText('Unable to load personal records')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('displays retry button on error and calls refetch on click', () => {
    mockUsePersonalRecords.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('API failure'),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePersonalRecords>);

    render(<PersonalRecords />);

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('displays empty state placeholder when no records exist', () => {
    mockUsePersonalRecords.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePersonalRecords>);

    render(<PersonalRecords />);

    expect(screen.getByText('No personal records found yet')).toBeInTheDocument();
    expect(
      screen.getByText('Keep training! Your records will appear here as you log activities.'),
    ).toBeInTheDocument();
  });

  it('displays empty state when data is undefined', () => {
    mockUsePersonalRecords.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePersonalRecords>);

    render(<PersonalRecords />);

    expect(screen.getByText('No personal records found yet')).toBeInTheDocument();
  });

  it('renders record cards with correct data', () => {
    const records: PersonalRecord[] = [
      createRecord({
        recordType: 'longest_run',
        value: 42.2,
        unit: 'km',
        date: '2024-03-15',
      }),
      createRecord({
        recordType: 'fastest_pace',
        value: 3.45,
        unit: 'min/km',
        activityId: 'act-456',
        date: '2024-06-20',
      }),
      createRecord({
        recordType: 'highest_elevation',
        value: 1250,
        unit: 'm',
        activityId: 'act-789',
        date: '2024-01-10',
      }),
    ];

    mockUsePersonalRecords.mockReturnValue({
      data: records,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePersonalRecords>);

    render(<PersonalRecords />);

    // Check labels
    expect(screen.getByText('Longest Run')).toBeInTheDocument();
    expect(screen.getByText('Fastest Pace')).toBeInTheDocument();
    expect(screen.getByText('Highest Elevation Gain')).toBeInTheDocument();

    // Check values
    expect(screen.getByText('42.2')).toBeInTheDocument();
    expect(screen.getByText('3.45')).toBeInTheDocument();
    expect(screen.getByText('1250')).toBeInTheDocument();

    // Check units
    expect(screen.getByText('km')).toBeInTheDocument();
    expect(screen.getByText('min/km')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();

    // Check dates
    expect(screen.getByText('Achieved Mar 15, 2024')).toBeInTheDocument();
    expect(screen.getByText('Achieved Jun 20, 2024')).toBeInTheDocument();
    expect(screen.getByText('Achieved Jan 10, 2024')).toBeInTheDocument();
  });

  it('renders as an accessible list', () => {
    const records: PersonalRecord[] = [
      createRecord({ recordType: 'longest_run', value: 42.2, unit: 'km' }),
    ];

    mockUsePersonalRecords.mockReturnValue({
      data: records,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePersonalRecords>);

    render(<PersonalRecords />);

    expect(screen.getByRole('list', { name: 'Personal records' })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });

  it('handles unknown record types gracefully', () => {
    const records: PersonalRecord[] = [
      createRecord({
        recordType: 'custom_record_type',
        value: 100,
        unit: 'units',
      }),
    ];

    mockUsePersonalRecords.mockReturnValue({
      data: records,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePersonalRecords>);

    render(<PersonalRecords />);

    // Should format unknown type nicely
    expect(screen.getByText('Custom Record Type')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('units')).toBeInTheDocument();
  });

  it('renders multiple record cards in a grid', () => {
    const records: PersonalRecord[] = [
      createRecord({ recordType: 'longest_run', value: 42.2, unit: 'km', activityId: 'a1' }),
      createRecord({ recordType: 'fastest_pace', value: 3.5, unit: 'min/km', activityId: 'a2' }),
      createRecord({ recordType: 'highest_elevation', value: 1500, unit: 'm', activityId: 'a3' }),
    ];

    mockUsePersonalRecords.mockReturnValue({
      data: records,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePersonalRecords>);

    render(<PersonalRecords />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
  });
});
