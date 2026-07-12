import { useMemo } from 'react';
import type { DailySummary } from '@/types/garmin';
import type { DailyDetailData } from '@/services/garmin-parser';
import { AnimatedNumber } from './AnimatedNumber';

interface HealthInsightsProps {
  today: DailySummary | undefined;
  summaries: DailySummary[];
  todayDetails: DailyDetailData | undefined;
}

interface InsightData {
  label: string;
  value: number;
  maxValue: number;
  description: string;
  color: string;
  icon: string;
}

/**
 * Health insights derived from wellness metrics.
 * No AI — just math-based scoring from available data.
 */
export function HealthInsights({ today, summaries, todayDetails }: HealthInsightsProps) {
  const insights = useMemo((): InsightData[] => {
    const result: InsightData[] = [];

    // 1. Recovery Score = weighted (body battery * 0.4 + sleep quality * 0.3 + resting HR trend * 0.3)
    if (today) {
      const batteryScore = (today.bodyBattery ?? 50) / 100;
      const sleepScore = today.sleepDuration
        ? Math.min(today.sleepDuration / 480, 1) // 8 hours = perfect
        : 0.5;

      // HR trend: lower = better
      const recentSummaries = summaries.slice(0, 7);
      const recentHRs = recentSummaries
        .map((s) => s.restingHeartRate)
        .filter((hr): hr is number => hr !== undefined);
      let hrTrendScore = 0.5;
      if (recentHRs.length >= 2) {
        const latest = recentHRs[0]!;
        const avg = recentHRs.reduce((a, b) => a + b, 0) / recentHRs.length;
        // If HR is below average, that's good
        hrTrendScore = Math.max(0, Math.min(1, 1 - (latest - avg + 5) / 10));
      }

      const recoveryScore = Math.round(
        (batteryScore * 0.4 + sleepScore * 0.3 + hrTrendScore * 0.3) * 100
      );

      let recoveryDesc = 'Your body is recovering well.';
      if (recoveryScore < 40) recoveryDesc = 'Recovery is low. Consider rest.';
      else if (recoveryScore < 60) recoveryDesc = 'Moderate recovery. Listen to your body.';
      else if (recoveryScore >= 80) recoveryDesc = 'Excellent recovery. Ready for activity!';

      result.push({
        label: 'Recovery Score',
        value: recoveryScore,
        maxValue: 100,
        description: recoveryDesc,
        color: recoveryScore >= 70 ? '#10b981' : recoveryScore >= 40 ? '#f59e0b' : '#ef4444',
        icon: '🔋',
      });
    }

    // 2. Stress Load = sum of stress readings above 40 threshold, normalized
    if (todayDetails?.stressReadings && todayDetails.stressReadings.length > 0) {
      const threshold = 40;
      const readings = todayDetails.stressReadings.map((r) => r.value);
      const aboveThreshold = readings.filter((v) => v > threshold);
      const stressLoad = aboveThreshold.length > 0
        ? Math.round((aboveThreshold.reduce((a, b) => a + b - threshold, 0) / readings.length))
        : 0;

      const normalizedLoad = Math.min(stressLoad, 60); // Cap at 60 for display
      let stressDesc = 'Low stress load today. Well managed!';
      if (normalizedLoad >= 40) stressDesc = 'High stress accumulation. Take breaks.';
      else if (normalizedLoad >= 20) stressDesc = 'Moderate stress. Some tension building.';

      result.push({
        label: 'Stress Load',
        value: normalizedLoad,
        maxValue: 60,
        description: stressDesc,
        color: normalizedLoad < 20 ? '#10b981' : normalizedLoad < 40 ? '#f59e0b' : '#ef4444',
        icon: '🧠',
      });
    }

    // 3. Cardio Health = based on resting HR (lower is generally better for adults)
    if (today?.restingHeartRate) {
      const rhr = today.restingHeartRate;
      // Rough scoring: <60 excellent, 60-70 good, 70-80 average, >80 below average
      let cardioScore: number;
      if (rhr < 55) cardioScore = 95;
      else if (rhr < 60) cardioScore = 85;
      else if (rhr < 65) cardioScore = 75;
      else if (rhr < 70) cardioScore = 65;
      else if (rhr < 75) cardioScore = 55;
      else if (rhr < 80) cardioScore = 45;
      else cardioScore = 35;

      let cardioDesc = `Resting HR of ${rhr} bpm. `;
      if (cardioScore >= 80) cardioDesc += 'Athlete-level cardiovascular fitness.';
      else if (cardioScore >= 60) cardioDesc += 'Good cardiovascular health.';
      else if (cardioScore >= 40) cardioDesc += 'Average range. Activity helps!';
      else cardioDesc += 'Consider building aerobic fitness.';

      result.push({
        label: 'Cardio Health',
        value: cardioScore,
        maxValue: 100,
        description: cardioDesc,
        color: cardioScore >= 70 ? '#10b981' : cardioScore >= 50 ? '#f59e0b' : '#ef4444',
        icon: '❤️',
      });
    }

    return result;
  }, [today, summaries, todayDetails]);

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
      <h3 className="text-sm font-medium text-(--color-text-secondary) uppercase tracking-wide mb-4">
        Health Insights
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.map((insight) => (
          <div
            key={insight.label}
            className="rounded-lg border border-(--color-border) bg-(--color-bg-primary) p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg" aria-hidden="true">{insight.icon}</span>
              <span className="text-xs font-medium text-(--color-text-secondary) uppercase">
                {insight.label}
              </span>
            </div>

            <div className="flex items-baseline gap-1 mb-2">
              <AnimatedNumber
                value={insight.value}
                className="text-2xl font-bold"
                duration={1500}
              />
              <span className="text-xs text-(--color-text-muted)">/{insight.maxValue}</span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-(--color-bg-tertiary) rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${(insight.value / insight.maxValue) * 100}%`,
                  backgroundColor: insight.color,
                }}
              />
            </div>

            <p className="text-xs text-(--color-text-secondary) leading-relaxed">
              {insight.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
