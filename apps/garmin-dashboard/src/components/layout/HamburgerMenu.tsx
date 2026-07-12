import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

// ─── Navigation Links ─────────────────────────────────────────────────────────

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/activities', label: 'Activities' },
  { to: '/daily-summary', label: 'Daily Summary' },
  { to: '/training', label: 'Training' },
  { to: '/insights', label: 'Insights' },
  { to: '/performance', label: 'Performance' },
] as const;

// ─── HamburgerMenu Component ──────────────────────────────────────────────────

/**
 * Mobile navigation menu visible below 768px.
 * Provides a hamburger button with minimum 44x44px touch target
 * and a slide-out overlay menu with navigation links.
 *
 * Accessibility features:
 * - aria-expanded on trigger button
 * - aria-controls linking button to panel
 * - Focus trap while menu is open
 * - Close on Escape key
 * - Close on click outside
 */
export function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = 'mobile-navigation-menu';

  const close = useCallback(() => {
    setIsOpen(false);
    // Return focus to the trigger button
    buttonRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  // Focus trap: keep focus within the menu when open
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const focusableElements = menu.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element when menu opens
    firstElement.focus();

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabTrap);
    return () => document.removeEventListener('keydown', handleTabTrap);
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      {/* Hamburger Button - 44x44px minimum touch target */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-(--color-text-primary) hover:bg-(--color-bg-tertiary) focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:outline-none"
      >
        {isOpen ? <CloseIcon /> : <HamburgerIcon />}
      </button>

      {/* Overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Slide-out menu panel */}
      <div
        ref={menuRef}
        id={menuId}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 left-0 z-50 h-full w-72 transform bg-(--color-bg-primary) shadow-xl transition-transform duration-200 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Menu header with close button */}
        <div className="flex items-center justify-between border-b border-(--color-border) p-4">
          <span className="text-lg font-semibold text-(--color-text-primary)">Menu</span>
          <button
            type="button"
            onClick={close}
            aria-label="Close navigation menu"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-(--color-text-secondary) hover:bg-(--color-bg-tertiary) focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:outline-none"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Navigation links */}
        <nav aria-label="Mobile navigation">
          <ul className="flex flex-col gap-1 p-4" role="list">
            {NAV_LINKS.map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={close}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center rounded-lg px-4 py-3 text-base font-medium transition-colors duration-150
                    ${
                      isActive
                        ? 'bg-(--color-primary)/10 text-(--color-primary)'
                        : 'text-(--color-text-secondary) hover:bg-(--color-bg-tertiary) hover:text-(--color-text-primary)'
                    }`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M6 18L18 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
