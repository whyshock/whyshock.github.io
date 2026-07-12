/**
 * Unit tests for formatting utilities.
 *
 * Validates: Requirements 2.2
 */

import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatDistance,
  formatDate,
  formatActivityType,
  getActivityTypeColor,
} from './formatters';

describe('formatDuration', () => {
  it('formats seconds-only durations', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  it('formats hours, minutes, seconds', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('formats zero duration', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('handles large durations', () => {
    expect(formatDuration(7200)).toBe('2:00:00');
  });

  it('handles negative or invalid values', () => {
    expect(formatDuration(-100)).toBe('0:00');
    expect(formatDuration(NaN)).toBe('0:00');
    expect(formatDuration(Infinity)).toBe('0:00');
  });
});

describe('formatDistance', () => {
  it('formats metric distances in km', () => {
    expect(formatDistance(5000, 'metric')).toBe('5.00 km');
  });

  it('formats imperial distances in miles', () => {
    expect(formatDistance(1609.344, 'imperial')).toBe('1.00 mi');
  });

  it('handles undefined distance', () => {
    expect(formatDistance(undefined, 'metric')).toBe('—');
  });

  it('handles zero distance', () => {
    expect(formatDistance(0, 'metric')).toBe('0 km');
  });

  it('formats short distances correctly', () => {
    expect(formatDistance(100, 'metric')).toBe('0.10 km');
  });

  it('formats long distances correctly', () => {
    expect(formatDistance(42195, 'metric')).toBe('42.20 km');
  });
});

describe('formatDate', () => {
  it('formats an ISO 8601 date string', () => {
    const result = formatDate('2024-01-15T09:30:00Z');
    // Result varies by locale, but should contain year
    expect(result).toContain('2024');
  });

  it('handles invalid date strings gracefully', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatActivityType', () => {
  it('returns readable labels for all types', () => {
    expect(formatActivityType('running')).toBe('Running');
    expect(formatActivityType('cycling')).toBe('Cycling');
    expect(formatActivityType('swimming')).toBe('Swimming');
    expect(formatActivityType('walking')).toBe('Walking');
    expect(formatActivityType('hiking')).toBe('Hiking');
    expect(formatActivityType('strength_training')).toBe('Strength Training');
    expect(formatActivityType('yoga')).toBe('Yoga');
    expect(formatActivityType('other')).toBe('Other');
  });
});

describe('getActivityTypeColor', () => {
  it('returns color classes for each activity type', () => {
    expect(getActivityTypeColor('running')).toBe('bg-activity-running');
    expect(getActivityTypeColor('cycling')).toBe('bg-activity-cycling');
    expect(getActivityTypeColor('swimming')).toBe('bg-activity-swimming');
    expect(getActivityTypeColor('strength_training')).toBe('bg-activity-strength');
    expect(getActivityTypeColor('other')).toBe('bg-activity-other');
  });
});
