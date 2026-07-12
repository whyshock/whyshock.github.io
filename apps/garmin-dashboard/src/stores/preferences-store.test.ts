import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePreferencesStore } from './preferences-store';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function resetStore() {
  usePreferencesStore.setState({
    unitSystem: 'metric',
    theme: 'system',
    defaultDateRange: 7,
    resolvedTheme: 'light',
    currentUserId: null,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('preferences-store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Default preferences', () => {
    it('should have correct default values', () => {
      const state = usePreferencesStore.getState();
      expect(state.unitSystem).toBe('metric');
      expect(state.theme).toBe('system');
      expect(state.defaultDateRange).toBe(7);
      expect(state.currentUserId).toBeNull();
    });

    it('should resolve system theme to light when prefers-color-scheme is light', () => {
      // jsdom defaults to not matching dark, so system → light
      const state = usePreferencesStore.getState();
      expect(state.resolvedTheme).toBe('light');
    });

    it('should resolve system theme to dark when prefers-color-scheme is dark', () => {
      // Mock matchMedia to return dark preference
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      // Re-trigger loadPreferences to pick up the mocked media query
      usePreferencesStore.getState().loadPreferences('test-user');
      const state = usePreferencesStore.getState();
      expect(state.resolvedTheme).toBe('dark');
    });
  });

  describe('Theme changes', () => {
    it('should update theme to dark and apply class on html', () => {
      usePreferencesStore.getState().setTheme('dark');

      const state = usePreferencesStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should update theme to light and remove dark class', () => {
      // First set dark
      usePreferencesStore.getState().setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Then set light
      usePreferencesStore.getState().setTheme('light');

      const state = usePreferencesStore.getState();
      expect(state.theme).toBe('light');
      expect(state.resolvedTheme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should resolve system theme based on matchMedia', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      usePreferencesStore.getState().setTheme('system');

      const state = usePreferencesStore.getState();
      expect(state.theme).toBe('system');
      expect(state.resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('System theme detection', () => {
    it('should listen for system theme changes when theme is system', async () => {
      let changeHandler: (() => void) | null = null;

      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: false, // start with light
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_event: string, handler: () => void) => {
          changeHandler = handler;
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      usePreferencesStore.getState().setTheme('system');

      // Now simulate the media query changing to dark
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      // Fire the change handler if it was registered
      if (changeHandler) {
        (changeHandler as () => void)();
      }

      const state = usePreferencesStore.getState();
      expect(state.resolvedTheme).toBe('dark');
    });
  });

  describe('Persistence', () => {
    it('should persist preferences to localStorage under userId key', () => {
      usePreferencesStore.getState().loadPreferences('user-123');
      usePreferencesStore.getState().setTheme('dark');

      const stored = localStorage.getItem('user-123:preferences');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.theme).toBe('dark');
      expect(parsed.unitSystem).toBe('metric');
      expect(parsed.defaultDateRange).toBe(7);
    });

    it('should load persisted preferences for a user', () => {
      // Pre-populate localStorage
      localStorage.setItem(
        'user-456:preferences',
        JSON.stringify({
          unitSystem: 'imperial',
          theme: 'light',
          defaultDateRange: 30,
        }),
      );

      usePreferencesStore.getState().loadPreferences('user-456');

      const state = usePreferencesStore.getState();
      expect(state.unitSystem).toBe('imperial');
      expect(state.theme).toBe('light');
      expect(state.defaultDateRange).toBe(30);
      expect(state.currentUserId).toBe('user-456');
    });

    it('should use defaults when no persisted preferences exist', () => {
      usePreferencesStore.getState().loadPreferences('new-user');

      const state = usePreferencesStore.getState();
      expect(state.unitSystem).toBe('metric');
      expect(state.theme).toBe('system');
      expect(state.defaultDateRange).toBe(7);
      expect(state.currentUserId).toBe('new-user');
    });

    it('should persist unitSystem changes', () => {
      usePreferencesStore.getState().loadPreferences('user-789');
      usePreferencesStore.getState().setUnitSystem('imperial');

      const stored = JSON.parse(localStorage.getItem('user-789:preferences')!);
      expect(stored.unitSystem).toBe('imperial');
    });

    it('should persist dateRange changes', () => {
      usePreferencesStore.getState().loadPreferences('user-789');
      usePreferencesStore.getState().setDateRange(90);

      const stored = JSON.parse(localStorage.getItem('user-789:preferences')!);
      expect(stored.defaultDateRange).toBe(90);
    });

    it('should not persist when no user is loaded', () => {
      usePreferencesStore.getState().setTheme('dark');

      // No userId prefix key should exist
      expect(localStorage.length).toBe(0);
    });
  });

  describe('clearPreferences', () => {
    it('should reset to defaults on clear', () => {
      usePreferencesStore.getState().loadPreferences('user-123');
      usePreferencesStore.getState().setTheme('dark');
      usePreferencesStore.getState().setUnitSystem('imperial');

      usePreferencesStore.getState().clearPreferences();

      const state = usePreferencesStore.getState();
      expect(state.theme).toBe('system');
      expect(state.unitSystem).toBe('metric');
      expect(state.defaultDateRange).toBe(7);
      expect(state.currentUserId).toBeNull();
    });

    it('should remove dark class on clear when system prefers light', () => {
      usePreferencesStore.getState().setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      usePreferencesStore.getState().clearPreferences();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('Multiple user isolation', () => {
    it('should load different preferences for different users', () => {
      localStorage.setItem(
        'user-A:preferences',
        JSON.stringify({ unitSystem: 'metric', theme: 'dark', defaultDateRange: 7 }),
      );
      localStorage.setItem(
        'user-B:preferences',
        JSON.stringify({ unitSystem: 'imperial', theme: 'light', defaultDateRange: 90 }),
      );

      usePreferencesStore.getState().loadPreferences('user-A');
      expect(usePreferencesStore.getState().theme).toBe('dark');
      expect(usePreferencesStore.getState().unitSystem).toBe('metric');

      usePreferencesStore.getState().loadPreferences('user-B');
      expect(usePreferencesStore.getState().theme).toBe('light');
      expect(usePreferencesStore.getState().unitSystem).toBe('imperial');
      expect(usePreferencesStore.getState().defaultDateRange).toBe(90);
    });
  });
});
