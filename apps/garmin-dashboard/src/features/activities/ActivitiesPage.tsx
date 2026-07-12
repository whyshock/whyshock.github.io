/**
 * Activities page — displays a paginated list of user activities.
 * Manages page state and delegates rendering to ActivityList.
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5
 */

import { useState } from 'react';
import { useActivities } from './hooks';
import { ActivityList } from './ActivityList';

export default function ActivitiesPage() {
  const [page, setPage] = useState(0);
  const { data: activities, isLoading, isError, error, refetch } = useActivities(page);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Activities</h1>
        <p className="mt-1 text-text-secondary text-sm">
          Your recorded fitness activities from Garmin Connect.
        </p>
      </header>

      <ActivityList
        activities={activities}
        isLoading={isLoading}
        isError={isError}
        error={error}
        page={page}
        onPageChange={setPage}
        onRetry={() => refetch()}
      />
    </div>
  );
}
