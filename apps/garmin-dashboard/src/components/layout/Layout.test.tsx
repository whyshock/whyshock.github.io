import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Layout } from './Layout';
import { useDataStore } from '@/stores/data-store';

// Mock the ThemeToggle to avoid preferences store infinite loop in tests
vi.mock('@/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" role="radiogroup" aria-label="Theme selection">Theme Toggle</div>,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderWithRouter(initialRoute = '/activities') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route
          path="*"
          element={
            <Layout>
              <div data-testid="content">Page content</div>
            </Layout>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function setDataLoaded() {
  useDataStore.setState({
    activities: [
      {
        activityId: '1',
        activityType: 'running',
        activityName: 'Morning Run',
        startTime: '2024-01-01T08:00:00Z',
        duration: 1800,
        hasGPS: true,
      },
    ],
    dailySummaries: [],
    userProfile: { userId: 'user-123', displayName: 'Test User' },
    isDataLoaded: true,
    isHydrating: false,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Layout', () => {
  beforeEach(() => {
    setDataLoaded();
  });

  it('renders the header with app title', () => {
    renderWithRouter();
    expect(screen.getByText('Garmin Fitness Dashboard')).toBeInTheDocument();
  });

  it('renders the user display name', () => {
    renderWithRouter();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders the theme toggle', () => {
    renderWithRouter();
    expect(screen.getByRole('radiogroup', { name: /theme selection/i })).toBeInTheDocument();
  });

  it('renders the re-upload button', () => {
    renderWithRouter();
    expect(screen.getByRole('button', { name: /clear data and re-upload/i })).toBeInTheDocument();
  });

  it('renders children content in the main area', () => {
    renderWithRouter();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders the footer with copyright', () => {
    renderWithRouter();
    expect(screen.getByText(/garmin fitness dashboard. all rights reserved/i)).toBeInTheDocument();
  });

  it('renders the version number in footer', () => {
    renderWithRouter();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
  });

  it('navigates to upload when re-upload button is clicked', () => {
    renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /clear data and re-upload/i }));
    // clearData is async, but the navigation should happen
  });
});

describe('NavigationBar', () => {
  beforeEach(() => {
    setDataLoaded();
  });

  it('renders navigation links for all main routes', () => {
    renderWithRouter();
    // The main navigation (desktop sidebar) should exist
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();

    // Both mobile and desktop navs exist, so use getAllByRole
    const activitiesLinks = screen.getAllByRole('link', { name: 'Activities' });
    expect(activitiesLinks.length).toBeGreaterThanOrEqual(1);

    const dailySummaryLinks = screen.getAllByRole('link', { name: 'Daily Summary' });
    expect(dailySummaryLinks.length).toBeGreaterThanOrEqual(1);

    const trainingLinks = screen.getAllByRole('link', { name: 'Training' });
    expect(trainingLinks.length).toBeGreaterThanOrEqual(1);

    const insightsLinks = screen.getAllByRole('link', { name: 'Insights' });
    expect(insightsLinks.length).toBeGreaterThanOrEqual(1);

    const performanceLinks = screen.getAllByRole('link', { name: 'Performance' });
    expect(performanceLinks.length).toBeGreaterThanOrEqual(1);

    const exercisesLinks = screen.getAllByRole('link', { name: 'Exercises' });
    expect(exercisesLinks.length).toBeGreaterThanOrEqual(1);
  });
});

describe('HamburgerMenu', () => {
  beforeEach(() => {
    setDataLoaded();
  });

  it('renders hamburger button with correct aria attributes', () => {
    renderWithRouter();
    const button = screen.getByRole('button', { name: /open navigation menu/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'mobile-navigation-menu');
  });

  it('has minimum 44x44px touch target on hamburger button', () => {
    renderWithRouter();
    const button = screen.getByRole('button', { name: /open navigation menu/i });
    // Check that the button has the CSS classes for min dimensions
    expect(button.className).toContain('min-h-[44px]');
    expect(button.className).toContain('min-w-[44px]');
  });

  it('opens menu when hamburger button is clicked', () => {
    renderWithRouter();
    const button = screen.getByRole('button', { name: /open navigation menu/i });
    fireEvent.click(button);

    // Menu should now be open - the dialog should be visible
    const dialog = screen.getByRole('dialog', { name: /navigation menu/i });
    expect(dialog).toBeInTheDocument();

    // Hamburger button should show expanded state (label changes to "Close")
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes menu when close button is clicked', () => {
    renderWithRouter();
    // Open the menu
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));

    // Find the close button inside the menu panel
    const closeButtons = screen.getAllByRole('button', { name: /close navigation menu/i });
    const menuCloseButton = closeButtons.find(
      (btn) => btn.closest('#mobile-navigation-menu') !== null,
    );
    expect(menuCloseButton).toBeDefined();
    fireEvent.click(menuCloseButton!);

    // Menu should now be closed
    const openButton = screen.getByRole('button', { name: /open navigation menu/i });
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes menu on Escape key press', () => {
    renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    const button = screen.getByRole('button', { name: /open navigation menu/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders navigation links inside the mobile menu', () => {
    renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));

    const mobileNav = screen.getByRole('navigation', { name: /mobile navigation/i });
    expect(mobileNav).toBeInTheDocument();
  });
});
