import React, { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// ─── Lazy-loaded route components (code splitting) ────────────────────────────

const UploadPage = React.lazy(() => import('@/features/upload/UploadPage'));
const SignInPage = React.lazy(() => import('@/features/auth/SignInPage'));
const CallbackPage = React.lazy(() => import('@/features/auth/CallbackPage'));
const DashboardPage = React.lazy(() => import('@/features/dashboard/DashboardPage'));
const ActivitiesPage = React.lazy(() => import('@/features/activities/ActivitiesPage'));
const ActivityDetailPage = React.lazy(() => import('@/features/activities/ActivityDetailPage'));
const DailySummaryPage = React.lazy(() => import('@/features/daily-summary/DailySummaryPage'));
const TrainingPage = React.lazy(() => import('@/features/training/TrainingPage'));
const InsightsPage = React.lazy(() => import('@/features/insights/InsightsPage'));
const PerformancePage = React.lazy(() => import('@/features/performance/PerformancePage'));
const ExercisesPage = React.lazy(() => import('@/features/exercises/ExercisesPage'));

// ─── Suspense wrapper ─────────────────────────────────────────────────────────

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>;
}

// ─── Router definition ────────────────────────────────────────────────────────

export const router = createBrowserRouter(
  [
    // Public routes
    {
      path: '/upload',
      element: (
        <SuspenseWrapper>
          <UploadPage />
        </SuspenseWrapper>
      ),
    },
    {
      path: '/sign-in',
      element: (
        <SuspenseWrapper>
          <SignInPage />
        </SuspenseWrapper>
      ),
    },
    {
      path: '/callback',
      element: (
        <SuspenseWrapper>
          <CallbackPage />
        </SuspenseWrapper>
      ),
    },

    // Protected routes (require data to be loaded)
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: '/',
          element: (
            <SuspenseWrapper>
              <DashboardPage />
            </SuspenseWrapper>
          ),
        },
        {
          path: '/activities',
          element: (
            <SuspenseWrapper>
              <ActivitiesPage />
            </SuspenseWrapper>
          ),
        },
        {
          path: '/activities/:id',
          element: (
            <SuspenseWrapper>
              <ActivityDetailPage />
            </SuspenseWrapper>
          ),
        },
        {
          path: '/daily-summary',
          element: (
            <SuspenseWrapper>
              <DailySummaryPage />
            </SuspenseWrapper>
          ),
        },
        {
          path: '/training',
          element: (
            <SuspenseWrapper>
              <TrainingPage />
            </SuspenseWrapper>
          ),
        },
        {
          path: '/insights',
          element: (
            <SuspenseWrapper>
              <InsightsPage />
            </SuspenseWrapper>
          ),
        },
        {
          path: '/performance',
          element: (
            <SuspenseWrapper>
              <PerformancePage />
            </SuspenseWrapper>
          ),
        },
        {
          path: '/exercises',
          element: (
            <SuspenseWrapper>
              <ExercisesPage />
            </SuspenseWrapper>
          ),
        },
      ],
    },
  ],
  {
    basename: '/whyshock-x-garmin/',
  },
);
