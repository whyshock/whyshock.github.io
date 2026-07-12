import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import type { DailySummary } from '@/types/garmin';
import type { DailyDetailData } from '@/services/garmin-parser';

interface WeeklyTrendsProps {
  summaries: DailySummary[];
  dailyDetails: Record<string, DailyDetailData>;
}

/**
 * 7-day trend grid showing heart rate, body battery, and stress trends.
 */
export function WeeklyTrends({ summaries, dailyDetails }: WeeklyTrendsProps) {
  // Get last 7 days of data
  const weekData = useMemo(() => {
    const today = new Date();
    const days: Array<{
      date: string;
      day: string;
      minHR?: number;
      avgHR?: number;
      maxHR?: number;
      bodyBattery?: number;
      stress?: number;
    }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString([], { weekday: 'short' });

      const summary = summaries.find((s) => s.date === dateStr);
      const details = dailyDetails[dateStr];

      let minHR: number | undefined;
      let avgHR: number | undefined;
      let maxHR: number | undefined;

      if (details?.heartRates && details.heartRates.length > 0) {
        const hrs = details.heartRates.map((r) => r.value);
        minHR = Math.min(...hrs);
        maxHR = Math.max(...hrs);
        avgHR = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
      } else if (summary?.restingHeartRate) {
        minHR = summary.restingHeartRate;
        avgHR = summary.restingHeartRate;
      }

      days.push({
        date: dateStr,
        day: dayLabel,
        minHR,
        avgHR,
        maxHR,
        bodyBattery: summary?.bodyBattery,
        stress: summary?.stressLevel,
      });
    }

    return days;
  }, [summaries, dailyDetails]);

  const hasHRData = weekData.some((d) => d.avgHR !== undefined);
  const hasBatteryData = weekData.some((d) => d.bodyBattery !== undefined);
  const hasStressData = weekData.some((d) => d.stress !== undefined);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Heart Rate Trend */}
      <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4">
        <h3 className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wide mb-3">
          Heart Rate (7 days)
        </h3>
        {hasHRData ? (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={25} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '11px' }}
                  formatter={(value: number, name: string) => [
                    `${value} bpm`,
                    name === 'avgHR' ? 'Avg' : name === 'maxHR' ? 'Max' : 'Min',
                  ]}
                />
                <Bar dataKey="avgHR" fill="#ef4444" radius={[2, 2, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-xs text-(--color-text-muted)">
            No HR data this week
          </div>
        )}
      </div>

      {/* Body Battery Trend */}
      <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4">
        <h3 className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wide mb-3">
          Body Battery (7 days)
        </h3>
        {hasBatteryData ? (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={25} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '11px' }}
                  formatter={(value: number) => [`${value}/100`, 'Battery']}
                />
                <Line
                  type="monotone"
                  dataKey="bodyBattery"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#06b6d4' }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-xs text-(--color-text-muted)">
            No battery data this week
          </div>
        )}
      </div>

      {/* Stress Trend */}
      <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4">
        <h3 className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wide mb-3">
          Stress (7 days)
        </h3>
        {hasStressData ? (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={25} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '11px' }}
                  formatter={(value: number) => [`${value}/100`, 'Stress']}
                />
                <Line
                  type="monotone"
                  dataKey="stress"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b' }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-xs text-(--color-text-muted)">
            No stress data this week
          </div>
        )}
      </div>
    </div>
  );
}
