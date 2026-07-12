/**
 * Rich health dashboard page — the main landing page after data upload.
 * Shows today's health snapshot, heart rate timeline, stress/battery chart,
 * weekly trends, sleep overview, and derived health insights.
 */

import { useMemo } from 'react';
import { useDataStore } from '@/stores/data-store';
import {
  HealthScoreCard,
  HeartRateChart,
  StressBatteryChart,
  WeeklyTrends,
  SleepCard,
  HealthInsights,
} from './components';

export default function DashboardPage() {
  const dailySummaries = useDataStore((s) => s.dailySummaries);
  const dailyDetails = useDataStore((s) => s.dailyDetails);

  // Get today's date and find matching data
  const { today, yesterday, todayDetails } = useMemo(() => {
    // Try to find the most recent day with data
    const sortedSummaries = [...dailySummaries].sort((a, b) => b.date.localeCompare(a.date));
    const latestDate = sortedSummaries[0]?.date;
    const secondDate = sortedSummaries[1]?.date;

    const todaySummary = latestDate ? sortedSummaries.find((s) => s.date === latestDate) : undefined;
    const yesterdaySummary = secondDate ? sortedSummaries.find((s) => s.date === secondDate) : undefined;

    // Find the details for the latest date
    const detailsDate = latestDate ?? new Date().toISOString().slice(0, 10);
    const todayDetail = dailyDetails[detailsDate];

    // If no details for the "latest" date, try to find any day with details
    const fallbackDetails = !todayDetail
      ? Object.values(dailyDetails).find((d) => d.heartRates.length > 0 || d.stressReadings.length > 0)
      : todayDetail;

    return {
      today: todaySummary,
      yesterday: yesterdaySummary,
      todayDetails: fallbackDetails,
    };
  }, [dailySummaries, dailyDetails]);

  const latestDate = useMemo(() => {
    if (dailySummaries.length === 0) return null;
    const sorted = [...dailySummaries].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.date ?? null;
  }, [dailySummaries]);

  const hasData = dailySummaries.length > 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-(--color-text-primary)">Health Dashboard</h1>
        {latestDate && (
          <p className="text-sm text-(--color-text-secondary)">
            Latest data: {new Date(latestDate + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        )}
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Today's Health Score Card */}
          <HealthScoreCard today={today} yesterday={yesterday} />

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <HeartRateChart data={todayDetails} restingHR={today?.restingHeartRate} />
            <StressBatteryChart data={todayDetails} />
          </div>

          {/* Weekly Trends */}
          <WeeklyTrends summaries={dailySummaries} dailyDetails={dailyDetails} />

          {/* Sleep + Insights Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SleepCard today={today} />
            <HealthInsights
              today={today}
              summaries={dailySummaries}
              todayDetails={todayDetails}
            />
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-12 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-(--color-bg-tertiary) flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-(--color-text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-(--color-text-primary) mb-2">No health data yet</h2>
      <p className="text-sm text-(--color-text-secondary) max-w-md mx-auto">
        Upload your Garmin export ZIP file to see your health dashboard with heart rate, stress,
        body battery, and sleep insights.
      </p>
    </div>
  );
}
