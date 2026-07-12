/**
 * AuthProvider — lifecycle component that handles token auto-refresh.
 * Since auth state lives in Zustand (not React Context), this component
 * manages side effects: session restoration on mount and automatic
 * token refresh before expiry.
 *
 * Validates: Requirements 1.4, 1.6, 1.7
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { getOAuthProxyClient } from '@/services/oauth-proxy';

/** Refresh tokens 5 minutes before expiry to avoid interruptions */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Minimum interval between refresh attempts (30 seconds) */
const MIN_REFRESH_INTERVAL_MS = 30 * 1000;

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const sessionExpiresAt = useAuthStore((state) => state.session?.expiresAt ?? null);
  const sessionRefreshToken = useAuthStore((state) => state.session?.refreshToken ?? null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionExpiresAt || !sessionRefreshToken) {
      // No session — clear any pending refresh timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }

    const scheduleRefresh = () => {
      const now = Date.now();
      const timeUntilExpiry = sessionExpiresAt - now;
      const refreshIn = Math.max(
        timeUntilExpiry - REFRESH_BUFFER_MS,
        MIN_REFRESH_INTERVAL_MS
      );

      // If already expired, attempt immediate refresh
      if (timeUntilExpiry <= 0) {
        performRefresh();
        return;
      }

      refreshTimerRef.current = setTimeout(() => {
        performRefresh();
      }, refreshIn);
    };

    const performRefresh = async () => {
      try {
        const oauthProxy = getOAuthProxyClient();
        const payload = await oauthProxy.refreshToken({
          encryptedRefreshToken: sessionRefreshToken,
        });

        useAuthStore.getState().updateTokens({
          accessToken: payload.accessToken,
          tokenSecret: payload.tokenSecret,
          refreshToken: payload.refreshToken,
          expiresAt: payload.expiresAt,
        });
      } catch {
        // Refresh failed — clear session and redirect to sign-in (Req 1.7)
        useAuthStore.getState().logout();
      }
    };

    scheduleRefresh();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [sessionExpiresAt, sessionRefreshToken]);

  return <>{children}</>;
}
