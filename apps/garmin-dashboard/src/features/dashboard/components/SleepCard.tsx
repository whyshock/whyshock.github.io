import type { DailySummary } from '@/types/garmin';
import { AnimatedNumber } from './AnimatedNumber';

interface SleepCardProps {
  today: DailySummary | undefined;
}

/**
 * Sleep overview card showing duration, stages, and quality assessment.
 */
export function SleepCard({ today }: SleepCardProps) {
  const sleepMinutes = today?.sleepDuration;
  const stages = today?.sleepStages;

  if (!sleepMinutes) {
    return (
      <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
        <h3 className="text-sm font-medium text-(--color-text-secondary) uppercase tracking-wide mb-4">
          Sleep
        </h3>
        <div className="flex items-center justify-center h-32 text-(--color-text-muted) text-sm">
          No sleep data available
        </div>
      </div>
    );
  }

  const hours = Math.floor(sleepMinutes / 60);
  const minutes = sleepMinutes % 60;

  // Quality assessment
  let quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  let qualityColor: string;
  if (sleepMinutes >= 480) {
    quality = 'Excellent';
    qualityColor = 'text-emerald-500';
  } else if (sleepMinutes >= 420) {
    quality = 'Good';
    qualityColor = 'text-teal-500';
  } else if (sleepMinutes >= 360) {
    quality = 'Fair';
    qualityColor = 'text-yellow-500';
  } else {
    quality = 'Poor';
    qualityColor = 'text-red-500';
  }

  // Duration bar (target = 8 hours = 480 min)
  const durationPercent = Math.min((sleepMinutes / 480) * 100, 100);

  // Stage percentages
  const totalStageMinutes = stages
    ? stages.deep + stages.light + stages.rem + stages.awake
    : sleepMinutes;

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-(--color-text-secondary) uppercase tracking-wide">
          Sleep
        </h3>
        <span className={`text-sm font-medium ${qualityColor}`}>{quality}</span>
      </div>

      {/* Duration */}
      <div className="flex items-baseline gap-1 mb-3">
        <AnimatedNumber value={hours} className="text-3xl font-bold text-(--color-text-primary)" />
        <span className="text-sm text-(--color-text-muted)">h</span>
        <AnimatedNumber value={minutes} className="text-3xl font-bold text-(--color-text-primary)" />
        <span className="text-sm text-(--color-text-muted)">m</span>
      </div>

      {/* Duration bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-(--color-text-muted) mb-1">
          <span>Duration</span>
          <span>Target: 8h</span>
        </div>
        <div className="h-2 bg-(--color-bg-tertiary) rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-1000 ease-out"
            style={{ width: `${durationPercent}%` }}
          />
        </div>
      </div>

      {/* Sleep stages */}
      {stages && (
        <div className="space-y-2">
          <p className="text-xs text-(--color-text-secondary) font-medium">Sleep Stages</p>
          <div className="h-4 flex rounded-full overflow-hidden">
            <div
              className="bg-indigo-800"
              style={{ width: `${(stages.deep / totalStageMinutes) * 100}%` }}
              title={`Deep: ${stages.deep}m`}
            />
            <div
              className="bg-indigo-400"
              style={{ width: `${(stages.light / totalStageMinutes) * 100}%` }}
              title={`Light: ${stages.light}m`}
            />
            <div
              className="bg-purple-500"
              style={{ width: `${(stages.rem / totalStageMinutes) * 100}%` }}
              title={`REM: ${stages.rem}m`}
            />
            <div
              className="bg-gray-400"
              style={{ width: `${(stages.awake / totalStageMinutes) * 100}%` }}
              title={`Awake: ${stages.awake}m`}
            />
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-800" />
              Deep {stages.deep}m
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              Light {stages.light}m
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              REM {stages.rem}m
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Awake {stages.awake}m
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
