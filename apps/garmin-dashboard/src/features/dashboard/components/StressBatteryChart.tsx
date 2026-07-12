import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DailyDetailData } from '@/services/garmin-parser';

interface StressBatteryChartProps {
  data: DailyDetailData | undefined;
}

/**
 * Combined stress + body battery chart.
 * Body battery as area fill, stress as line overlay.
 * Shows the inverse relationship between stress and battery drain.
 */
export function StressBatteryChart({ data }: StressBatteryChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];

    // Create a unified timeline from both datasets
    const timeMap = new Map<string, { time: string; battery?: number; stress?: number }>();

    for (const reading of data.bodyBatteryReadings) {
      const date = new Date(reading.time);
      const key = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const existing = timeMap.get(key) ?? { time: key };
      existing.battery = reading.value;
      timeMap.set(key, existing);
    }

    for (const reading of data.stressReadings) {
      const date = new Date(reading.time);
      const key = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const existing = timeMap.get(key) ?? { time: key };
      existing.stress = reading.value;
      timeMap.set(key, existing);
    }

    // Sort by timestamp and return
    return Array.from(timeMap.values()).sort((a, b) => {
      // Parse time for sorting
      return a.time.localeCompare(b.time);
    });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
        <h3 className="text-sm font-medium text-(--color-text-secondary) uppercase tracking-wide mb-4">
          Stress & Body Battery
        </h3>
        <div className="flex items-center justify-center h-48 text-(--color-text-muted) text-sm">
          No stress/battery data available for today
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
      <h3 className="text-sm font-medium text-(--color-text-secondary) uppercase tracking-wide mb-4">
        Stress & Body Battery
      </h3>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <defs>
              <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
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
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'var(--color-text-secondary)' }}
              formatter={(value: number, name: string) => [
                value,
                name === 'battery' ? 'Body Battery' : 'Stress Level',
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              formatter={(value) => (value === 'battery' ? 'Body Battery' : 'Stress')}
            />
            <Area
              type="monotone"
              dataKey="battery"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#batteryGradient)"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="stress"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              strokeDasharray="2 2"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
