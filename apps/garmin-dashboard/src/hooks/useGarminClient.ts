/**
 * Hook that creates a configured GarminAPIClient using decrypted tokens
 * from the auth store.
 *
 * Validates: Requirements 2.5, 2.6
 */

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { createGarminAPIClient } from '@/services/garmin-api';
import type { GarminAPIClient } from '@/types/api';

const CONSUMER_KEY = import.meta.env.VITE_GARMIN_CONSUMER_KEY ?? '';
const CONSUMER_SECRET = import.meta.env.VITE_GARMIN_CONSUMER_SECRET ?? '';

export interface UseGarminClientResult {
  client: GarminAPIClient | null;
  isAuthenticated: boolean;
}

/**
 * Creates and memoizes a GarminAPIClient instance based on the current auth session.
 * Returns null when no valid session is available.
 */
export function useGarminClient(): UseGarminClientResult {
  const session = useAuthStore((state) => state.session);

  const client = useMemo(() => {
    if (!session) return null;

    return createGarminAPIClient({
      consumerKey: CONSUMER_KEY,
      consumerSecret: CONSUMER_SECRET,
      accessToken: session.accessToken,
      tokenSecret: session.tokenSecret,
    });
  }, [session]);

  return {
    client,
    isAuthenticated: session !== null,
  };
}
