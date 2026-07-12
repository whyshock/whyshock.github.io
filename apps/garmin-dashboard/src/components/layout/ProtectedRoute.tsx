import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useDataStore } from '@/stores/data-store';
import { Layout } from './Layout';

/**
 * Route guard that redirects users to the upload page if no data is loaded.
 * Preserves the intended destination so users can be redirected back after upload.
 * Wraps content with the Layout shell (header, nav, footer).
 */
export function ProtectedRoute() {
  const isDataLoaded = useDataStore((state) => state.isDataLoaded);
  const isHydrating = useDataStore((state) => state.isHydrating);
  const location = useLocation();

  // While hydrating from IndexedDB, show nothing (avoids flash)
  if (isHydrating) {
    return null;
  }

  // If no data is loaded, redirect to upload page
  if (!isDataLoaded) {
    return <Navigate to="/upload" state={{ from: location }} replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
