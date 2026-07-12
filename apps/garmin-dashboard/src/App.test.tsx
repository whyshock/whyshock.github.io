import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useDataStore } from '@/stores/data-store';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

describe('App Routing', () => {
  beforeEach(() => {
    // Reset data state before each test
    useDataStore.setState({
      activities: [],
      dailySummaries: [],
      userProfile: null,
      isDataLoaded: false,
      isHydrating: false,
    });
  });

  it('redirects users without data to upload page', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/upload" element={<div>Upload Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Upload Page')).toBeInTheDocument();
  });

  it('renders protected content when data is loaded', () => {
    useDataStore.setState({
      activities: [
        {
          activityId: '1',
          activityType: 'running',
          activityName: 'Morning Run',
          startTime: '2024-01-01T08:00:00Z',
          duration: 1800,
          distance: 5000,
          hasGPS: true,
        },
      ],
      dailySummaries: [],
      userProfile: { userId: 'test', displayName: 'Test User' },
      isDataLoaded: true,
      isHydrating: false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/upload" element={<div>Upload Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
