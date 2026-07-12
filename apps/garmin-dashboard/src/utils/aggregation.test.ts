/**
 * Tests for time-series aggregation utility.
 * Validates: Property 7 (Time-Series Aggregation Correctness)
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateByGranularity,
  type TimeSeriesDataPoint,
} from './aggregation';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function generateDailyData(startDate: string, days: number, valueGenerator: (i: number) => number): TimeSeriesDataPoint[] {
  const data: TimeSeriesDataPoint[] = [];
  const start = new Date(startDate + 'T00:00:00');

  for (let i = 0; i < days; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    data.push({
      date: `${year}-${month}-${day}`,
      value: valueGenerator(i),
    });
  }

  return data;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('aggregateByGranularity', () => {
  describe('empty data', () => {
    it('returns empty array for all granularities', () => {
      expect(aggregateByGranularity([], 'day')).toEqual([]);
      expect(aggregateByGranularity([], 'week')).toEqual([]);
      expect(aggregateByGranularity([], 'month')).toEqual([]);
    });
  });

  describe('day granularity', () => {
    it('returns data as-is without aggregation', () => {
      const data = generateDailyData('2024-01-01', 7, (i) => (i + 1) * 1000);
      const result = aggregateByGranularity(data, 'day');

      expect(result).toHaveLength(7);
      expect(result[0]!.date).toBe('2024-01-01');
      expect(result[0]!.value).toBe(1000);
      expect(result[0]!.count).toBe(1);
      expect(result[6]!.date).toBe('2024-01-07');
      expect(result[6]!.value).toBe(7000);
    });

    it('preserves total count of data points', () => {
      const data = generateDailyData('2024-03-01', 30, () => 5000);
      const result = aggregateByGranularity(data, 'day');

      const totalCount = result.reduce((sum, p) => sum + p.count, 0);
      expect(totalCount).toBe(30);
    });
  });

  describe('week granularity', () => {
    it('groups 7 consecutive days into one bucket', () => {
      const data = generateDailyData('2024-01-01', 7, () => 1000);
      const result = aggregateByGranularity(data, 'week');

      expect(result).toHaveLength(1);
      expect(result[0]!.value).toBe(1000);
      expect(result[0]!.count).toBe(7);
    });

    it('averages values within each weekly bucket', () => {
      // 7 days: values 1-7, average should be 4
      const data = generateDailyData('2024-01-01', 7, (i) => i + 1);
      const result = aggregateByGranularity(data, 'week');

      expect(result).toHaveLength(1);
      expect(result[0]!.value).toBe(4); // (1+2+3+4+5+6+7)/7 = 4
    });

    it('creates multiple weekly buckets for longer ranges', () => {
      const data = generateDailyData('2024-01-01', 21, () => 100);
      const result = aggregateByGranularity(data, 'week');

      expect(result).toHaveLength(3);
      result.forEach((bucket) => {
        expect(bucket.count).toBe(7);
        expect(bucket.value).toBe(100);
      });
    });

    it('handles partial final week', () => {
      const data = generateDailyData('2024-01-01', 10, () => 50);
      const result = aggregateByGranularity(data, 'week');

      expect(result).toHaveLength(2);
      expect(result[0]!.count).toBe(7);
      expect(result[1]!.count).toBe(3);
    });

    it('preserves total count across all buckets', () => {
      const data = generateDailyData('2024-01-01', 45, () => 8000);
      const result = aggregateByGranularity(data, 'week');

      const totalCount = result.reduce((sum, p) => sum + p.count, 0);
      expect(totalCount).toBe(45);
    });
  });

  describe('month granularity', () => {
    it('groups data by calendar month', () => {
      // 31 days of January
      const data = generateDailyData('2024-01-01', 31, () => 5000);
      const result = aggregateByGranularity(data, 'month');

      expect(result).toHaveLength(1);
      expect(result[0]!.value).toBe(5000);
      expect(result[0]!.count).toBe(31);
    });

    it('separates data into different calendar months', () => {
      // Jan 15 to Mar 15 (60 days spanning 3 months)
      const data = generateDailyData('2024-01-15', 60, () => 100);
      const result = aggregateByGranularity(data, 'month');

      expect(result).toHaveLength(3); // Jan, Feb, Mar
      // Jan: 17 days (Jan 15-31)
      expect(result[0]!.count).toBe(17);
      // Feb: 29 days (2024 is leap year)
      expect(result[1]!.count).toBe(29);
      // Mar: 14 days (Mar 1-14)
      expect(result[2]!.count).toBe(14);
    });

    it('averages values within each monthly bucket', () => {
      // 3 days in January with values 10, 20, 30
      const data: TimeSeriesDataPoint[] = [
        { date: '2024-01-01', value: 10 },
        { date: '2024-01-02', value: 20 },
        { date: '2024-01-03', value: 30 },
      ];
      const result = aggregateByGranularity(data, 'month');

      expect(result).toHaveLength(1);
      expect(result[0]!.value).toBe(20); // (10+20+30)/3 = 20
    });

    it('preserves total count across all buckets', () => {
      const data = generateDailyData('2024-01-01', 90, () => 3000);
      const result = aggregateByGranularity(data, 'month');

      const totalCount = result.reduce((sum, p) => sum + p.count, 0);
      expect(totalCount).toBe(90);
    });
  });

  describe('non-overlapping intervals', () => {
    it('each data point belongs to exactly one bucket (week)', () => {
      const data = generateDailyData('2024-02-01', 28, (i) => i * 10);
      const result = aggregateByGranularity(data, 'week');

      const totalCount = result.reduce((sum, p) => sum + p.count, 0);
      expect(totalCount).toBe(28);
      expect(result).toHaveLength(4);
    });

    it('each data point belongs to exactly one bucket (month)', () => {
      const data = generateDailyData('2024-01-01', 90, (i) => i);
      const result = aggregateByGranularity(data, 'month');

      const totalCount = result.reduce((sum, p) => sum + p.count, 0);
      expect(totalCount).toBe(90);
    });
  });

  describe('edge cases', () => {
    it('single data point works for all granularities', () => {
      const data: TimeSeriesDataPoint[] = [{ date: '2024-06-15', value: 42 }];

      const dayResult = aggregateByGranularity(data, 'day');
      expect(dayResult).toHaveLength(1);
      expect(dayResult[0]!.value).toBe(42);

      const weekResult = aggregateByGranularity(data, 'week');
      expect(weekResult).toHaveLength(1);
      expect(weekResult[0]!.value).toBe(42);

      const monthResult = aggregateByGranularity(data, 'month');
      expect(monthResult).toHaveLength(1);
      expect(monthResult[0]!.value).toBe(42);
    });

    it('rounds averaged values to 2 decimal places', () => {
      const data: TimeSeriesDataPoint[] = [
        { date: '2024-01-01', value: 1 },
        { date: '2024-01-02', value: 2 },
        { date: '2024-01-03', value: 3 },
      ];
      const result = aggregateByGranularity(data, 'month');
      // 6/3 = 2.0 exactly
      expect(result[0]!.value).toBe(2);

      const data2: TimeSeriesDataPoint[] = [
        { date: '2024-01-01', value: 1 },
        { date: '2024-01-02', value: 1 },
        { date: '2024-01-03', value: 2 },
      ];
      const result2 = aggregateByGranularity(data2, 'month');
      // 4/3 = 1.333... → 1.33
      expect(result2[0]!.value).toBe(1.33);
    });
  });
});
