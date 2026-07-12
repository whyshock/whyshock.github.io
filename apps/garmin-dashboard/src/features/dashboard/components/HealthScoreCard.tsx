import { useMemo } from 'react';
import type { DailySummary } from '@/types/garmin';
import { AnimatedNumber } from './AnimatedNumber';

interface HealthScoreCardProps {
  today: DailySummary | undefined;
  yesterday: DailySummary | undefined;
}

/**
 * Top card showing today's health snapshot:
 * - Body Battery gauge (circular)
 * - Resting HR with trend
 * - Stress level with color
 * - Sleep duration
 */
export function HealthScoreCard({ today, yesterday }: HealthScoreCardProps) {
  const bodyBattery = today?.bodyBattery ?? 0;
  const restingHR = today?.restingHeartRate;
  const yesterdayHR = yesterday?.restingHeartRate;
  const stressLevel = today?.stressLevel;
  const sleepMinutes = today?.sleepDuration;

  const hrTrend = useMemo(() => {
    if (restingHR && yesterdayHR) {
      const diff = restingHR - yesterdayHR;
      if (diff > 2) return 'up';
      if (diff < -2) return 'down';
    }
    return 'stable';
  }, [restingHR, yesterdayHR]);

  const stressColor = useMemo(() => {
    if (!stressLevel) return 'text-(--color-text-muted)';
    if (stressLevel <= 25) return 'text-emerald-500';
    if (stressLevel <= 50) return 'text-yellow-500';
    if (stressLevel <= 75) return 'text-orange-500';
    return 'text-red-500';
  }, [stressLevel]);

  const stressLabel = useMemo(() => {
    if (!stressLevel) return 'No data';
    if (stressLevel <= 25) return 'Low';
    if (stressLevel <= 50) return 'Moderate';
    if (stressLevel <= 75) return 'High';
    return 'Very High';
  }, [stressLevel]);

  const batteryColor = useMemo(() => {
    if (bodyBattery >= 70) return '#10b981';
    if (bodyBattery >= 40) return '#f59e0b';
    return '#ef4444';
  }, [bodyBattery]);

  // Circular gauge SVG calculations
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (bodyBattery / 100) * circumference;

  const sleepHours = sleepMinutes ? Math.floor(sleepMinutes / 60) : 0;
  const sleepMins = sleepMinutes ? sleepMinutes % 60 : 0;

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
      <h2 className="text-sm font-medium text-(--color-text-secondary) mb-4 uppercase tracking-wide">
        Today&apos;s Health
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
        {/* Body Battery Gauge */}
        <div className="flex flex-col items-center col-span-2 md:col-span-1">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="currentColor"
                className="text-(--color-bg-tertiary)"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={batteryColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatedNumber
                value={bodyBattery}
                className="text-2xl font-bold text-(--color-text-primary)"
              />
              <span className="text-xs text-(--color-text-muted)">Battery</span>
            </div>
          </div>
        </div>

        {/* Resting Heart Rate */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-1">
            <HeartIcon className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex items-baseline gap-1">
            {restingHR ? (
              <AnimatedNumber value={restingHR} className="text-xl font-bold text-(--color-text-primary)" />
            ) : (
              <span className="text-xl font-bold text-(--color-text-muted)">--</span>
            )}
            <span className="text-xs text-(--color-text-muted)">bpm</span>
          </div>
          <span className="text-xs text-(--color-text-secondary)">Resting HR</span>
          {hrTrend !== 'stable' && (
            <span className={`text-xs ${hrTrend === 'down' ? 'text-emerald-500' : 'text-red-400'}`}>
              {hrTrend === 'down' ? '↓' : '↑'} vs yesterday
            </span>
          )}
        </div>

        {/* Stress Level */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-1">
            <BrainIcon className="w-5 h-5 text-orange-500" />
          </div>
          <div className="flex items-baseline gap-1">
            {stressLevel ? (
              <AnimatedNumber value={stressLevel} className={`text-xl font-bold ${stressColor}`} />
            ) : (
              <span className="text-xl font-bold text-(--color-text-muted)">--</span>
            )}
            <span className="text-xs text-(--color-text-muted)">/100</span>
          </div>
          <span className="text-xs text-(--color-text-secondary)">Stress</span>
          <span className={`text-xs ${stressColor}`}>{stressLabel}</span>
        </div>

        {/* Sleep Duration */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center mb-1">
            <MoonIcon className="w-5 h-5 text-indigo-500" />
          </div>
          {sleepMinutes ? (
            <div className="text-xl font-bold text-(--color-text-primary)">
              <AnimatedNumber value={sleepHours} className="" />
              <span className="text-xs text-(--color-text-muted)">h </span>
              <AnimatedNumber value={sleepMins} className="" />
              <span className="text-xs text-(--color-text-muted)">m</span>
            </div>
          ) : (
            <span className="text-xl font-bold text-(--color-text-muted)">--</span>
          )}
          <span className="text-xs text-(--color-text-secondary)">Sleep</span>
          {sleepMinutes && sleepMinutes >= 420 && (
            <span className="text-xs text-emerald-500">Good</span>
          )}
          {sleepMinutes && sleepMinutes < 360 && sleepMinutes > 0 && (
            <span className="text-xs text-orange-500">Short</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
    </svg>
  );
}
