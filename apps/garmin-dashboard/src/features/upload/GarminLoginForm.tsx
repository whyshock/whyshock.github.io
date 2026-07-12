/**
 * Garmin login form for credential-based data sync.
 * Posts credentials to the Cloudflare Worker which authenticates
 * with Garmin SSO and fetches wellness/activity data.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '@/stores/data-store';
import type { Activity, ActivityType, DailySummary } from '@/types/garmin';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? '';

export function GarminLoginForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<SyncState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const setActivities = useDataStore((s) => s.setActivities);
  const setDailySummaries = useDataStore((s) => s.setDailySummaries);
  const setProfile = useDataStore((s) => s.setProfile);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !password) return;

      setState('syncing');
      setErrorMessage('');

      try {
        const response = await fetch(`${WORKER_URL}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message ?? `Sync failed (${response.status})`);
        }

        // Map the response to our app types
        const { dailySummaries, activities, displayName } = data.data;

        // Store daily summaries
        if (dailySummaries && dailySummaries.length > 0) {
          const mapped: DailySummary[] = dailySummaries.map(
            (s: {
              date: string;
              steps: number;
              restingHeartRate?: number;
              stressLevel?: number;
              bodyBattery?: number;
              sleepDuration?: number;
              respirationRate?: number;
            }) => ({
              date: s.date,
              steps: s.steps,
              restingHeartRate: s.restingHeartRate,
              stressLevel: s.stressLevel,
              bodyBattery: s.bodyBattery,
              sleepDuration: s.sleepDuration,
              respirationRate: s.respirationRate,
            }),
          );
          setDailySummaries(mapped);
        }

        // Store activities
        if (activities && activities.length > 0) {
          const mapped: Activity[] = activities.map(
            (a: {
              activityId: string;
              activityType: string;
              activityName: string;
              startTime: string;
              duration: number;
              distance?: number;
              calories?: number;
              averageHR?: number;
              maxHR?: number;
              elevationGain?: number;
            }) => ({
              activityId: a.activityId,
              activityType: (a.activityType ?? 'other') as ActivityType,
              activityName: a.activityName,
              startTime: a.startTime,
              duration: a.duration,
              distance: a.distance,
              calories: a.calories,
              averageHR: a.averageHR,
              maxHR: a.maxHR,
              elevationGain: a.elevationGain,
              hasGPS: false,
            }),
          );
          setActivities(mapped);
        }

        // Store profile
        if (displayName) {
          setProfile({
            userId: email,
            displayName,
          });
        }

        setState('success');
        // Navigate to dashboard after a short delay
        setTimeout(() => navigate('/'), 800);
      } catch (error) {
        setState('error');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred. Try uploading your data export instead.',
        );
      }
    },
    [email, password, navigate, setActivities, setDailySummaries, setProfile],
  );

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label htmlFor="garmin-email" className="block text-sm font-medium text-text-primary mb-1">
            Garmin Email
          </label>
          <input
            id="garmin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            required
            disabled={state === 'syncing'}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary
              placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="garmin-password"
            className="block text-sm font-medium text-text-primary mb-1"
          >
            Garmin Password
          </label>
          <input
            id="garmin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={state === 'syncing'}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary
              placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>

        {/* Error Display */}
        {state === 'error' && errorMessage && (
          <div className="p-3 rounded-lg bg-error/10 border border-error/30">
            <p className="text-sm text-error font-medium mb-1">Sync Failed</p>
            <p className="text-xs text-text-secondary">{errorMessage}</p>
            <p className="text-xs text-text-muted mt-2">
              If this keeps happening, try uploading your data export instead.
            </p>
          </div>
        )}

        {/* Success Display */}
        {state === 'success' && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/30">
            <p className="text-sm text-success font-medium">
              ✓ Data synced successfully! Redirecting to dashboard...
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={state === 'syncing' || !email || !password}
          className="w-full py-3 px-4 rounded-lg font-medium text-white
            bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 flex items-center justify-center gap-2"
        >
          {state === 'syncing' ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Syncing data...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Sync Data
            </>
          )}
        </button>
      </form>

      {/* Privacy Note */}
      <div className="mt-4 p-3 rounded-lg bg-bg-tertiary">
        <div className="flex items-start gap-2">
          <svg
            className="w-4 h-4 text-text-muted mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="text-xs text-text-muted">
            Your credentials are sent directly to Garmin&apos;s servers via our secure proxy. We
            don&apos;t store your password.
          </p>
        </div>
      </div>
    </div>
  );
}
