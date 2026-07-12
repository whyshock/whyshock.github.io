import { create } from 'zustand';
import type { AuthSession } from '@/types/garmin';
import { usePreferencesStore } from '@/stores/preferences-store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (session: AuthSession) => void;
  logout: () => void;
  updateTokens: (params: {
    accessToken: string;
    tokenSecret: string;
    refreshToken: string;
    expiresAt: number;
  }) => void;
  checkSession: () => void;
  isSessionExpired: () => boolean;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSessionStorageKey(userId: string): string {
  return `${userId}:auth_session`;
}

function persistSession(session: AuthSession): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(getSessionStorageKey(session.userId), JSON.stringify(session));
  } catch {
    // sessionStorage might be full or unavailable; silently fail
  }
}

// Load session by known userId (used for direct session restoration)
export function loadPersistedSession(userId: string): AuthSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(getSessionStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

/**
 * Clears all localStorage and sessionStorage entries prefixed with the user's ID.
 * This ensures complete cleanup of user data on sign-out (Req 10.2).
 */
function clearAllUserPrefixedStorage(userId: string): void {
  const prefix = `${userId}:`;

  if (typeof sessionStorage !== 'undefined') {
    const sessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) {
        sessionKeys.push(key);
      }
    }
    for (const key of sessionKeys) {
      sessionStorage.removeItem(key);
    }
  }

  if (typeof localStorage !== 'undefined') {
    const localKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        localKeys.push(key);
      }
    }
    for (const key of localKeys) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Finds any persisted auth session in sessionStorage.
 * Scans all keys to find one matching the pattern `{userId}:auth_session`.
 */
function findPersistedSession(): AuthSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.endsWith(':auth_session')) {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          return JSON.parse(raw) as AuthSession;
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>((set, get) => ({
  // State
  session: null,
  isLoading: false,
  error: null,

  // Actions
  login: (session: AuthSession) => {
    persistSession(session);
    set({ session, isLoading: false, error: null });

    // Load user preferences when a user logs in
    usePreferencesStore.getState().loadPreferences(session.userId);
  },

  logout: () => {
    const { session } = get();
    if (session) {
      clearAllUserPrefixedStorage(session.userId);
    }

    // Clear preferences
    usePreferencesStore.getState().clearPreferences();

    set({ session: null, isLoading: false, error: null });
  },

  updateTokens: ({ accessToken, tokenSecret, refreshToken, expiresAt }) => {
    const { session } = get();
    if (!session) return;

    const updatedSession: AuthSession = {
      ...session,
      accessToken,
      tokenSecret,
      refreshToken,
      expiresAt,
    };

    persistSession(updatedSession);
    set({ session: updatedSession });
  },

  checkSession: () => {
    set({ isLoading: true });

    const session = findPersistedSession();

    if (!session) {
      set({ session: null, isLoading: false });
      return;
    }

    // Check if the session has expired
    const now = Date.now();
    if (now > session.expiresAt) {
      // Session expired — clear it
      clearAllUserPrefixedStorage(session.userId);
      set({ session: null, isLoading: false, error: 'Session expired. Please sign in again.' });
      return;
    }

    set({ session, isLoading: false, error: null });

    // Load user preferences for the restored session
    usePreferencesStore.getState().loadPreferences(session.userId);
  },

  isSessionExpired: () => {
    const { session } = get();
    if (!session) return true;
    return Date.now() > session.expiresAt;
  },

  clearError: () => {
    set({ error: null });
  },
}));
