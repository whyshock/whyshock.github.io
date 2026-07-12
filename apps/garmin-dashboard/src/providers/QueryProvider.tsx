/**
 * TanStack Query provider with configured QueryClient.
 * Wraps the app to provide query caching, background refresh,
 * and retry logic for all Garmin API queries.
 *
 * Validates: Requirements 2.5, 2.6, 3.7, 8.7
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { APIError } from '@/types/api';

/**
 * Custom retry function: retries up to 3 times with exponential backoff
 * for retryable errors. Does not retry 401, 403, or 404.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;

  // Check if it's our structured APIError
  if (isAPIError(error)) {
    const nonRetryableCodes = ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'FORBIDDEN', 'NOT_FOUND'];
    if (nonRetryableCodes.includes(error.code)) return false;
    return error.retryable;
  }

  // For HTTP status code checks on generic errors
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const status = (error as { statusCode: number }).statusCode;
    if (status === 401 || status === 403 || status === 404) return false;
  }

  // Default: retry unknown errors
  return true;
}

/**
 * Exponential backoff delay for retries.
 */
function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
}

function isAPIError(error: unknown): error is APIError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retryable' in error &&
    'timestamp' in error
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: shouldRetry,
      retryDelay,
      staleTime: 5 * 60 * 1000, // 5 minutes default
      gcTime: 30 * 60 * 1000, // 30 minutes default
    },
  },
});

export { queryClient };

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
