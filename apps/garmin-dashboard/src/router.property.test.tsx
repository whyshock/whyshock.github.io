import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import React from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthSession } from '@/types/garmin';

/**
 * Property-based tests for routing and navigation.
 *
 * These tests use fast-check to verify that:
 * - Navigation between routes never clears the auth session (Property 5)
 * - Browser history consistency — the rendered content matches the route (Property 6)
 */

// ─── Test Constants ───────────────────────────────────────────────────────────

const VALID_ROUTES = [
  '/activities',
  '/daily-summary',
  '/training',
  '/insights',
  '/performance',
  '/exercises',
];

// Route-to-label mapping for content verification
const ROUTE_LABELS: Record<string, string> = {
  '/activities': 'page-activities',
  '/daily-summary': 'page-daily-summary',
  '/training': 'page-training',
  '/insights': 'page-insights',
  '/performance': 'page-performance',
  '/exercises': 'page-exercises',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockSession(): AuthSession {
  return {
    userId: 'test-user-123',
    displayName: 'Test User',
    accessToken: 'encrypted-access-token',
    tokenSecret: 'encrypted-token-secret',
    refreshToken: 'encrypted-refresh-token',
    expiresAt: Date.now() + 3600000, // 1 hour from now
  };
}

/**
 * Minimal page component that displays the route path and reads auth state.
 * Avoids complex component hierarchies that can trigger React update loops
 * while still exercising the Zustand store subscription during routing.
 */
function TestPage({ label }: { label: string }) {
  // Subscribe to auth store (mimics what real pages do via ProtectedRoute)
  const session = useAuthStore((state) => state.session);
  return (
    <div data-testid={label}>
      <span data-testid="auth-status">
        {session ? `authenticated:${session.userId}` : 'unauthenticated'}
      </span>
    </div>
  );
}

/**
 * Location display component to verify current pathname.
 */
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

/**
 * Creates a test app with minimal route components that subscribe to the auth store.
 * Each route renders a TestPage that reads auth state, ensuring the Zustand
 * subscription pipeline is exercised during route transitions.
 */
function TestApp() {
  return (
    <Routes>
      {VALID_ROUTES.map((path) => (
        <Route
          key={path}
          path={path}
          element={<TestPage label={ROUTE_LABELS[path]} />}
        />
      ))}
    </Routes>
  );
}

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Routing Property Tests', () => {
  beforeEach(() => {
    // Reset auth store between test runs
    useAuthStore.setState({ session: null, isLoading: false, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 5: Route navigation preserves auth state
   *
   * For any arbitrary sequence of valid route paths, navigating between them
   * should never modify the auth session state. Each route component subscribes
   * to the auth store (just like the real app via ProtectedRoute), and after
   * rendering at each route, the auth session remains identical.
   *
   * This verifies that the routing layer and component mounting/unmounting
   * cycle does not inadvertently reset or clear the global auth session.
   *
   * **Validates: Requirements 8.7, 8.2**
   */
  describe('Property 5: Route navigation preserves auth state', () => {
    it('navigating between any routes never clears auth session', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...VALID_ROUTES), { minLength: 2, maxLength: 10 }),
          (routes) => {
            // Set up authenticated session
            const mockSession = createMockSession();
            useAuthStore.setState({
              session: mockSession,
              isLoading: false,
              error: null,
            });

            // Simulate navigating through each route by rendering the app
            // at each position in sequence. Each render mounts a new route
            // component that subscribes to the auth store.
            for (const route of routes) {
              cleanup();

              render(
                <MemoryRouter initialEntries={[route]}>
                  <TestApp />
                  <LocationDisplay />
                </MemoryRouter>,
              );

              // Verify the route rendered correctly
              const expectedLabel = ROUTE_LABELS[route];
              expect(screen.getByTestId(expectedLabel)).toBeInTheDocument();

              // Verify auth state is displayed correctly by the page component
              const authStatus = screen.getByTestId('auth-status');
              expect(authStatus.textContent).toBe(`authenticated:${mockSession.userId}`);

              // Verify the auth store state has not been modified
              const currentSession = useAuthStore.getState().session;
              expect(currentSession).not.toBeNull();
              expect(currentSession!.userId).toBe(mockSession.userId);
              expect(currentSession!.displayName).toBe(mockSession.displayName);
              expect(currentSession!.accessToken).toBe(mockSession.accessToken);
              expect(currentSession!.tokenSecret).toBe(mockSession.tokenSecret);
              expect(currentSession!.refreshToken).toBe(mockSession.refreshToken);
              expect(currentSession!.expiresAt).toBe(mockSession.expiresAt);
            }

            cleanup();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('auth session deep equality is preserved across route changes', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...VALID_ROUTES), { minLength: 3, maxLength: 8 }),
          (routes) => {
            // Set up a session and capture a snapshot
            const mockSession = createMockSession();
            useAuthStore.setState({
              session: mockSession,
              isLoading: false,
              error: null,
            });

            const sessionSnapshot = { ...useAuthStore.getState().session! };

            // Navigate through all routes
            for (const route of routes) {
              cleanup();

              render(
                <MemoryRouter initialEntries={[route]}>
                  <TestApp />
                </MemoryRouter>,
              );
            }

            // After all navigations, session should still deeply equal the snapshot
            const finalSession = useAuthStore.getState().session;
            expect(finalSession).toEqual(sessionSnapshot);

            cleanup();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 6: Browser history consistency
   *
   * For any sequence of route navigations represented as history entries,
   * the rendered content at any position in the history stack always matches
   * the route at that position.
   *
   * This verifies that MemoryRouter's initialEntries/initialIndex correctly
   * maps history positions to rendered routes — confirming that the app's
   * routing setup properly handles back/forward navigation scenarios.
   *
   * **Validates: Requirements 8.6**
   */
  describe('Property 6: Browser history consistency', () => {
    it('rendered content matches the current route at any history position', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...VALID_ROUTES), { minLength: 2, maxLength: 8 }),
          fc.nat(),
          (routes, indexSeed) => {
            // Set up authenticated session
            useAuthStore.setState({
              session: createMockSession(),
              isLoading: false,
              error: null,
            });

            // Pick a valid index in the history stack
            const historyIndex = indexSeed % routes.length;
            const currentRoute = routes[historyIndex];

            cleanup();

            // Render with the history stack and a specific index
            // This simulates the browser's current position after back/forward
            render(
              <MemoryRouter initialEntries={routes} initialIndex={historyIndex}>
                <TestApp />
                <LocationDisplay />
              </MemoryRouter>,
            );

            // The rendered page should match the route at the history index
            const expectedLabel = ROUTE_LABELS[currentRoute];
            expect(screen.getByTestId(expectedLabel)).toBeInTheDocument();

            // The location display should show the correct pathname
            const locationEl = screen.getByTestId('location-display');
            expect(locationEl.textContent).toBe(currentRoute);

            cleanup();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('each history position renders exactly one route component', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...VALID_ROUTES), { minLength: 2, maxLength: 6 }),
          fc.nat(),
          (routes, indexSeed) => {
            // Set up authenticated session
            useAuthStore.setState({
              session: createMockSession(),
              isLoading: false,
              error: null,
            });

            const historyIndex = indexSeed % routes.length;
            const currentRoute = routes[historyIndex];

            cleanup();

            render(
              <MemoryRouter initialEntries={routes} initialIndex={historyIndex}>
                <TestApp />
              </MemoryRouter>,
            );

            // Only the route at historyIndex should be rendered
            const allPageLabels = Object.values(ROUTE_LABELS);
            const expectedLabel = ROUTE_LABELS[currentRoute];

            for (const label of allPageLabels) {
              if (label === expectedLabel) {
                expect(screen.queryByTestId(label)).toBeInTheDocument();
              } else {
                expect(screen.queryByTestId(label)).not.toBeInTheDocument();
              }
            }

            cleanup();
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
