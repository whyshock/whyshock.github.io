import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './auth-store';
import { usePreferencesStore } from './preferences-store';
import type { AuthSession } from '@/types/garmin';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createMockSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    userId: 'user-123',
    displayName: 'Test User',
    accessToken: 'encrypted-access-token',
    tokenSecret: 'encrypted-token-secret',
    refreshToken: 'encrypted-refresh-token',
    expiresAt: Date.now() + 3600_000, // 1 hour from now
    ...overrides,
  };
}

function resetStores(): void {
  useAuthStore.setState({
    session: null,
    isLoading: false,
    error: null,
  });
  usePreferencesStore.getState().clearPreferences();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('auth-store', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    resetStores();
  });

  describe('login', () => {
    it('stores the session in state', () => {
      const session = createMockSession();
      useAuthStore.getState().login(session);

      expect(useAuthStore.getState().session).toEqual(session);
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('persists the session in sessionStorage under userId prefix', () => {
      const session = createMockSession({ userId: 'garmin-42' });
      useAuthStore.getState().login(session);

      const stored = sessionStorage.getItem('garmin-42:auth_session');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(session);
    });

    it('calls loadPreferences on the preferences store', () => {
      const loadPreferences = vi.spyOn(usePreferencesStore.getState(), 'loadPreferences');
      const session = createMockSession({ userId: 'pref-user' });

      useAuthStore.getState().login(session);

      expect(loadPreferences).toHaveBeenCalledWith('pref-user');
      loadPreferences.mockRestore();
    });
  });

  describe('logout', () => {
    it('clears session from state', () => {
      const session = createMockSession();
      useAuthStore.getState().login(session);
      useAuthStore.getState().logout();

      expect(useAuthStore.getState().session).toBeNull();
    });

    it('clears all user-prefixed entries from sessionStorage', () => {
      const userId = 'user-abc';
      sessionStorage.setItem(`${userId}:auth_session`, 'data');
      sessionStorage.setItem(`${userId}:some_cache`, 'cached');
      sessionStorage.setItem('other-user:data', 'should remain');

      const session = createMockSession({ userId });
      useAuthStore.setState({ session });
      useAuthStore.getState().logout();

      expect(sessionStorage.getItem(`${userId}:auth_session`)).toBeNull();
      expect(sessionStorage.getItem(`${userId}:some_cache`)).toBeNull();
      expect(sessionStorage.getItem('other-user:data')).toBe('should remain');
    });

    it('clears all user-prefixed entries from localStorage', () => {
      const userId = 'user-xyz';
      localStorage.setItem(`${userId}:preferences`, '{}');
      localStorage.setItem(`${userId}:activities_cache`, '[]');
      localStorage.setItem('another-user:preferences', 'should remain');

      const session = createMockSession({ userId });
      useAuthStore.setState({ session });
      useAuthStore.getState().logout();

      expect(localStorage.getItem(`${userId}:preferences`)).toBeNull();
      expect(localStorage.getItem(`${userId}:activities_cache`)).toBeNull();
      expect(localStorage.getItem('another-user:preferences')).toBe('should remain');
    });
  });

  describe('updateTokens', () => {
    it('updates token fields in the session', () => {
      const session = createMockSession();
      useAuthStore.getState().login(session);

      const newExpiry = Date.now() + 7200_000;
      useAuthStore.getState().updateTokens({
        accessToken: 'new-access',
        tokenSecret: 'new-secret',
        refreshToken: 'new-refresh',
        expiresAt: newExpiry,
      });

      const updated = useAuthStore.getState().session!;
      expect(updated.accessToken).toBe('new-access');
      expect(updated.tokenSecret).toBe('new-secret');
      expect(updated.refreshToken).toBe('new-refresh');
      expect(updated.expiresAt).toBe(newExpiry);
      // Non-token fields preserved
      expect(updated.userId).toBe(session.userId);
      expect(updated.displayName).toBe(session.displayName);
    });

    it('persists updated tokens to sessionStorage', () => {
      const session = createMockSession({ userId: 'persist-user' });
      useAuthStore.getState().login(session);

      useAuthStore.getState().updateTokens({
        accessToken: 'updated-access',
        tokenSecret: 'updated-secret',
        refreshToken: 'updated-refresh',
        expiresAt: 999999999,
      });

      const stored = JSON.parse(sessionStorage.getItem('persist-user:auth_session')!);
      expect(stored.accessToken).toBe('updated-access');
    });

    it('does nothing if no session is active', () => {
      useAuthStore.getState().updateTokens({
        accessToken: 'x',
        tokenSecret: 'x',
        refreshToken: 'x',
        expiresAt: 0,
      });

      expect(useAuthStore.getState().session).toBeNull();
    });
  });

  describe('checkSession', () => {
    it('loads a valid session from sessionStorage', () => {
      const session = createMockSession({ userId: 'check-user' });
      sessionStorage.setItem('check-user:auth_session', JSON.stringify(session));

      useAuthStore.getState().checkSession();

      expect(useAuthStore.getState().session).toEqual(session);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('sets session to null if no persisted session exists', () => {
      useAuthStore.getState().checkSession();

      expect(useAuthStore.getState().session).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('clears expired sessions and sets an error', () => {
      const expiredSession = createMockSession({
        userId: 'expired-user',
        expiresAt: Date.now() - 1000, // expired 1 second ago
      });
      sessionStorage.setItem('expired-user:auth_session', JSON.stringify(expiredSession));

      useAuthStore.getState().checkSession();

      expect(useAuthStore.getState().session).toBeNull();
      expect(useAuthStore.getState().error).toContain('expired');
      expect(sessionStorage.getItem('expired-user:auth_session')).toBeNull();
    });
  });

  describe('isSessionExpired', () => {
    it('returns true if no session exists', () => {
      expect(useAuthStore.getState().isSessionExpired()).toBe(true);
    });

    it('returns false for a session that has not expired', () => {
      const session = createMockSession({ expiresAt: Date.now() + 60_000 });
      useAuthStore.getState().login(session);

      expect(useAuthStore.getState().isSessionExpired()).toBe(false);
    });

    it('returns true for a session that has expired', () => {
      const session = createMockSession({ expiresAt: Date.now() - 1000 });
      useAuthStore.setState({ session });

      expect(useAuthStore.getState().isSessionExpired()).toBe(true);
    });
  });

  describe('clearError', () => {
    it('resets the error state to null', () => {
      useAuthStore.setState({ error: 'Something went wrong' });
      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('multi-user isolation', () => {
    it('different users do not see each others sessions', () => {
      const userA = createMockSession({ userId: 'user-A', displayName: 'Alice' });
      const userB = createMockSession({ userId: 'user-B', displayName: 'Bob' });

      // User A logs in
      useAuthStore.getState().login(userA);
      expect(sessionStorage.getItem('user-A:auth_session')).not.toBeNull();

      // User A logs out, user B logs in
      useAuthStore.getState().logout();
      useAuthStore.getState().login(userB);

      // User A's data is cleared, user B's exists
      expect(sessionStorage.getItem('user-A:auth_session')).toBeNull();
      expect(sessionStorage.getItem('user-B:auth_session')).not.toBeNull();
      expect(useAuthStore.getState().session?.userId).toBe('user-B');
    });

    it('logout clears only the current user data', () => {
      // Simulate leftover data from another user
      sessionStorage.setItem('other-user:auth_session', 'other-data');
      localStorage.setItem('other-user:preferences', '{}');

      const session = createMockSession({ userId: 'current-user' });
      sessionStorage.setItem('current-user:auth_session', JSON.stringify(session));
      localStorage.setItem('current-user:activities_cache', '[]');

      useAuthStore.setState({ session });
      useAuthStore.getState().logout();

      // Current user data cleared
      expect(sessionStorage.getItem('current-user:auth_session')).toBeNull();
      expect(localStorage.getItem('current-user:activities_cache')).toBeNull();

      // Other user data preserved
      expect(sessionStorage.getItem('other-user:auth_session')).toBe('other-data');
      expect(localStorage.getItem('other-user:preferences')).toBe('{}');
    });
  });
});
