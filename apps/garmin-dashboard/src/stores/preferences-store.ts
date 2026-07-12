import { create } from 'zustand';
import type { ThemeMode, UnitSystem, DateRangeOption, UserPreferences } from '@/types/garmin';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreferencesState extends UserPreferences {
  /** The resolved theme (never 'system', always 'light' or 'dark') */
  resolvedTheme: 'light' | 'dark';
  /** Currently loaded user ID (null if no user loaded) */
  currentUserId: string | null;
}

interface PreferencesActions {
  setTheme: (theme: ThemeMode) => void;
  setUnitSystem: (unitSystem: UnitSystem) => void;
  setDateRange: (dateRange: DateRangeOption) => void;
  loadPreferences: (userId: string) => void;
  clearPreferences: () => void;
}

type PreferencesStore = PreferencesState & PreferencesActions;

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PREFERENCES: UserPreferences = {
  unitSystem: 'metric',
  theme: 'system',
  defaultDateRange: 7,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStorageKey(userId: string): string {
  return `${userId}:preferences`;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

function applyThemeToDocument(resolvedTheme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (resolvedTheme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

function persistPreferences(userId: string, preferences: UserPreferences): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(preferences));
  } catch {
    // localStorage might be full or unavailable; silently fail
  }
}

function loadPersistedPreferences(userId: string): UserPreferences | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as UserPreferences;
  } catch {
    return null;
  }
}

// ─── Media Query Listener ─────────────────────────────────────────────────────

let mediaQueryCleanup: (() => void) | null = null;

function setupSystemThemeListener(store: { getState: () => PreferencesStore }): void {
  cleanupSystemThemeListener();

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    const state = store.getState();
    if (state.theme === 'system') {
      const resolved = getSystemTheme();
      applyThemeToDocument(resolved);
      usePreferencesStore.setState({ resolvedTheme: resolved });
    }
  };

  mediaQuery.addEventListener('change', handler);
  mediaQueryCleanup = () => mediaQuery.removeEventListener('change', handler);
}

function cleanupSystemThemeListener(): void {
  if (mediaQueryCleanup) {
    mediaQueryCleanup();
    mediaQueryCleanup = null;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePreferencesStore = create<PreferencesStore>((set, get) => {
  // Set up system theme listener after store creation
  const storeRef = { getState: get };
  if (typeof window !== 'undefined') {
    // Defer setup to ensure store is fully initialized
    queueMicrotask(() => setupSystemThemeListener(storeRef));
  }

  return {
    // State
    ...DEFAULT_PREFERENCES,
    resolvedTheme: resolveTheme(DEFAULT_PREFERENCES.theme),
    currentUserId: null,

    // Actions
    setTheme: (theme: ThemeMode) => {
      const resolved = resolveTheme(theme);
      applyThemeToDocument(resolved);

      set({ theme, resolvedTheme: resolved });

      const { currentUserId } = get();
      if (currentUserId) {
        const state = get();
        persistPreferences(currentUserId, {
          unitSystem: state.unitSystem,
          theme,
          defaultDateRange: state.defaultDateRange,
        });
      }

      // Re-setup listener if switching to/from system
      if (theme === 'system') {
        setupSystemThemeListener({ getState: get });
      }
    },

    setUnitSystem: (unitSystem: UnitSystem) => {
      set({ unitSystem });

      const { currentUserId } = get();
      if (currentUserId) {
        const state = get();
        persistPreferences(currentUserId, {
          unitSystem,
          theme: state.theme,
          defaultDateRange: state.defaultDateRange,
        });
      }
    },

    setDateRange: (defaultDateRange: DateRangeOption) => {
      set({ defaultDateRange });

      const { currentUserId } = get();
      if (currentUserId) {
        const state = get();
        persistPreferences(currentUserId, {
          unitSystem: state.unitSystem,
          theme: state.theme,
          defaultDateRange,
        });
      }
    },

    loadPreferences: (userId: string) => {
      const persisted = loadPersistedPreferences(userId);
      const prefs = persisted ?? DEFAULT_PREFERENCES;
      const resolved = resolveTheme(prefs.theme);

      applyThemeToDocument(resolved);

      set({
        ...prefs,
        resolvedTheme: resolved,
        currentUserId: userId,
      });

      // Ensure system theme listener is active if theme is 'system'
      if (prefs.theme === 'system') {
        setupSystemThemeListener({ getState: get });
      }
    },

    clearPreferences: () => {
      cleanupSystemThemeListener();

      const resolved = resolveTheme(DEFAULT_PREFERENCES.theme);
      applyThemeToDocument(resolved);

      set({
        ...DEFAULT_PREFERENCES,
        resolvedTheme: resolved,
        currentUserId: null,
      });
    },
  };
});

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Hook to access all user preferences */
export function usePreferences() {
  const unitSystem = usePreferencesStore((state) => state.unitSystem);
  const theme = usePreferencesStore((state) => state.theme);
  const defaultDateRange = usePreferencesStore((state) => state.defaultDateRange);
  const resolvedTheme = usePreferencesStore((state) => state.resolvedTheme);
  return { unitSystem, theme, defaultDateRange, resolvedTheme };
}

/** Hook to access only the theme-related state */
export function useTheme() {
  const theme = usePreferencesStore((state) => state.theme);
  const resolvedTheme = usePreferencesStore((state) => state.resolvedTheme);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  return { theme, resolvedTheme, setTheme };
}
