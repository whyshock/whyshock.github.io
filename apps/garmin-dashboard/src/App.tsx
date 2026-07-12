import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { useDataStore } from '@/stores/data-store';
import { QueryProvider } from '@/providers/QueryProvider';

function App() {
  // Hydrate data from IndexedDB on app mount, then try loading static JSON
  useEffect(() => {
    const init = async () => {
      // First try IndexedDB (user's previously uploaded data)
      await useDataStore.getState().hydrate();

      // If no data in IndexedDB, try loading pre-synced static JSON
      // (deployed by GitHub Actions)
      if (!useDataStore.getState().isDataLoaded) {
        try {
          const resp = await fetch(`${import.meta.env.BASE_URL}data/garmin-data.json`);
          if (resp.ok) {
            const json = await resp.json();
            if (json.dailySummaries?.length > 0) {
              useDataStore.getState().setDailySummaries(json.dailySummaries);
            }
            if (json.activities?.length > 0) {
              useDataStore.getState().setActivities(json.activities);
            }
            if (json.userProfile) {
              useDataStore.getState().setProfile(json.userProfile);
            }
          }
        } catch {
          // No static data available — user will see upload page
        }
      }
    };

    init();
  }, []);

  return (
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  );
}

export default App;
