import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '@/stores/data-store';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NavigationBar } from './NavigationBar';
import { HamburgerMenu } from './HamburgerMenu';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LayoutProps {
  children: ReactNode;
}

// ─── Layout Component ─────────────────────────────────────────────────────────

/**
 * Main layout wrapper for all protected routes.
 * Contains:
 * - Header with app title, user display name, theme toggle, and sign-out button
 * - Desktop sidebar navigation (≥1024px)
 * - Mobile hamburger menu (<768px)
 * - Main content area rendering the route outlet
 * - Footer with copyright info
 *
 * Responsive breakpoints:
 * - <768px: hamburger menu, no sidebar
 * - 768px-1023px: hamburger menu (compact), no sidebar
 * - ≥1024px: full sidebar navigation
 */
export function Layout({ children }: LayoutProps) {
  const userProfile = useDataStore((state) => state.userProfile);
  const clearData = useDataStore((state) => state.clearData);
  const navigate = useNavigate();

  const handleClearData = async () => {
    await clearData();
    navigate('/upload');
  };

  return (
    <div className="flex min-h-screen flex-col bg-(--color-bg-primary)">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-(--color-border) bg-(--color-bg-primary) px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          {/* Hamburger menu for mobile/tablet */}
          <HamburgerMenu />

          {/* App title */}
          <h1 className="text-lg font-bold text-(--color-text-primary) lg:text-xl">
            Garmin Fitness Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* User display name */}
          {userProfile && (
            <span className="hidden text-sm text-(--color-text-secondary) sm:inline">
              {userProfile.displayName}
            </span>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Clear data / re-upload button */}
          <button
            type="button"
            onClick={handleClearData}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-(--color-text-secondary) hover:bg-(--color-bg-tertiary) hover:text-(--color-text-primary) focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:outline-none lg:min-h-0 lg:min-w-0"
            aria-label="Clear data and re-upload"
          >
            <SignOutIcon className="h-5 w-5 sm:mr-1.5" />
            <span className="hidden sm:inline">Re-upload</span>
          </button>
        </div>
      </header>

      {/* Body: sidebar + main content */}
      <div className="flex flex-1">
        {/* Desktop navigation sidebar */}
        <NavigationBar />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-(--spacing-page)">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-(--color-border) px-4 py-4 text-center text-xs text-(--color-text-muted) lg:px-6">
        <p>© {new Date().getFullYear()} Garmin Fitness Dashboard. All rights reserved.</p>
        <p className="mt-1">v0.1.0</p>
      </footer>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M13 3h3a1 1 0 011 1v12a1 1 0 01-1 1h-3M8 15l5-5-5-5M13 10H3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
