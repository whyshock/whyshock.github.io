/**
 * Sign-in page — public route.
 * Displays a Garmin-branded sign-in button that initiates the OAuth 1.0a flow.
 * Handles errors with a retry option and shows user profile on successful auth.
 *
 * Validates: Requirements 1.1, 1.4, 1.5
 */

import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { getOAuthProxyClient } from '@/services/oauth-proxy';

export default function SignInPage() {
  const session = useAuthStore((state) => state.session);
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If user is already authenticated, redirect to the intended destination or home
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
  if (session) {
    return <Navigate to={from} replace />;
  }

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const oauthProxy = getOAuthProxyClient();
      const { redirectUrl } = await oauthProxy.getRequestToken();

      // Redirect user to Garmin authorization page (Req 1.1 — within 2 seconds)
      window.location.href = redirectUrl;
    } catch (err: unknown) {
      // Show error with retry option (Req 1.5)
      const message =
        err instanceof Error
          ? err.message
          : 'Authentication failed. Please try again.';
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm text-center">
        {/* Garmin branding */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary">
            Garmin Fitness Dashboard
          </h1>
          <p className="mt-2 text-text-secondary">
            Connect your Garmin account to view your fitness data.
          </p>
        </div>

        {/* Error message with retry (Req 1.5) */}
        {error && (
          <div
            className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300"
            role="alert"
            aria-live="polite"
          >
            <p className="font-medium">Authentication failed</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Sign-in button */}
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Sign in with Garmin Connect"
        >
          {isLoading ? (
            <>
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
                aria-hidden="true"
              />
              Connecting to Garmin...
            </>
          ) : (
            <>
              <GarminIcon />
              Sign in with Garmin Connect
            </>
          )}
        </button>

        {/* Retry button when error is shown */}
        {error && !isLoading && (
          <button
            onClick={handleSignIn}
            className="mt-3 text-sm font-medium text-accent-primary underline hover:text-accent-primary/80 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2"
            aria-label="Retry sign in"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline Garmin-style icon (simple mountain/GPS marker shape).
 */
function GarminIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"
        fill="currentColor"
      />
    </svg>
  );
}
