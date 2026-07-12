import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { DailyDetailData } from '@/services/garmin-parser';

interface HeartRateChartProps {
  data: DailyDetailData | undefined;
  restingHR?: number;
}

/**
 * Heart rate timeline chart showing all HR readings throughout the day.
 * Color-coded zones: recovery (blue), easy (green), moderate (yellow), hard (orange), max (red).
 */
export function HeartRateChart({ data, restingHR }: HeartRateChartProps) {
  const chartData = useMemo(() => {
    if (!data?.heartRates || data.heartRates.length === 0) return [];

    return data.heartRates.map((reading) => {
      const date = new Date(reading.time);
      return {
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hr: reading.value,
        timestamp: date.getTime(),
      };
    });
  }, [data]);

  const latestHR = chartData.length > 0 ? chartData[chartData.length - 1]!.hr : null;
  const maxHR = chartData.length > 0 ? Math.max(...chartData.map((d) => d.hr)) : 0;
  const minHR = chartData.length > 0 ? Math.min(...chartData.map((d) => d.hr)) : 0;

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
        <h3 className="text-sm font-medium text-(--color-text-secondary) uppercase tracking-wide mb-4">
          Heart Rate Timeline
        </h3>
        <div className="flex items-center justify-center h-48 text-(--color-text-muted) text-sm">
          No heart rate data available for today
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-(--color-text-secondary) uppercase tracking-wide">
          Heart Rate Timeline
        </h3>
        <div className="flex items-center gap-4">
          {latestHR && (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-red-500">{latestHR}</span>
              <span className="text-xs text-(--color-text-muted)">bpm latest</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-4 text-xs text-(--color-text-secondary)">
        <span>Min: <strong className="text-(--color-text-primary)">{minHR}</strong></span>
        <span>Max: <strong className="text-(--color-text-primary)">{maxHR}</strong></span>
        {restingHR && <span>Resting: <strong className="text-(--color-text-primary)">{restingHR}</strong></span>}
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <defs>
              <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[Math.max(30, minHR - 10), maxHR + 10]}
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'var(--color-text-secondary)' }}
              formatter={(value: number) => [`${value} bpm`, 'Heart Rate']}
            />
            {restingHR && (
              <ReferenceLine
                y={restingHR}
                stroke="#3b82f6"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: 'Resting', position: 'right', fontSize: 10, fill: '#3b82f6' }}
              />
            )}
            <Area
              type="monotone"
              dataKey="hr"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#hrGradient)"
              dot={false}
              activeDot={{ r: 3, fill: '#ef4444' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Zone legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />Recovery</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Easy</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" />Moderate</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" />Hard</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Max</span>
      </div>
    </div>
  );
}
