/**
 * OAuth callback page — handles the redirect back from Garmin Connect.
 * Extracts oauth_token and oauth_verifier from URL params, exchanges them
 * for access tokens, stores the session, and redirects to the dashboard.
 *
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { getOAuthProxyClient } from '@/services/oauth-proxy';
import type { AuthSession } from '@/types/garmin';

type CallbackState = 'exchanging' | 'success' | 'error';

export default function CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const session = useAuthStore((state) => state.session);
  const [state, setState] = useState<CallbackState>('exchanging');
  const [error, setError] = useState<string | null>(null);

  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');

  useEffect(() => {
    // If no token/verifier present, show error
    if (!oauthToken || !oauthVerifier) {
      setState('error');
      setError('Missing OAuth parameters. Please try signing in again.');
      return;
    }

    let cancelled = false;

    const exchangeTokens = async () => {
      try {
        const oauthProxy = getOAuthProxyClient();
        const payload = await oauthProxy.exchangeAccessToken({
          requestToken: oauthToken,
          oauthVerifier: oauthVerifier,
        });

        if (cancelled) return;

        // Build auth session from the encrypted token payload
        const authSession: AuthSession = {
          userId: payload.userId,
          displayName: payload.displayName,
          accessToken: payload.accessToken,
          tokenSecret: payload.tokenSecret,
          refreshToken: payload.refreshToken,
          expiresAt: payload.expiresAt,
        };

        // Store session and redirect to dashboard
        login(authSession);
        setState('success');
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Token exchange failed. Please try again.';
        setError(message);
        setState('error');
      }
    };

    exchangeTokens();

    return () => {
      cancelled = true;
    };
  }, [oauthToken, oauthVerifier, login]);

  // On success, redirect to the dashboard after a brief moment to show the welcome
  useEffect(() => {
    if (state === 'success' && session) {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state, session, navigate]);

  const handleRetry = () => {
    navigate('/sign-in', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm text-center">
        {/* Loading state — token exchange in progress */}
        {state === 'exchanging' && (
          <div role="status" aria-label="Exchanging tokens">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border-primary border-t-accent-primary" />
            <p className="mt-4 text-text-secondary">
              Connecting to Garmin Connect...
            </p>
          </div>
        )}

        {/* Success state — shows user profile name (Req 1.4) */}
        {state === 'success' && session && (
          <div aria-live="polite">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-text-primary">
              Welcome, {session.displayName}!
            </h2>
            <p className="mt-2 text-text-secondary">
              Redirecting to your dashboard...
            </p>
          </div>
        )}

        {/* Error state with retry option (Req 1.5) */}
        {state === 'error' && (
          <div aria-live="polite">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-text-primary">
              Authentication Failed
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {error || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={handleRetry}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2"
              aria-label="Retry sign in"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
