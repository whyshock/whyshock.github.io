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

// ─── NavigationBar Component ──────────────────────────────────────────────────

/**
 * Desktop sidebar navigation visible at ≥1024px viewport width.
 * Renders a vertical list of route links with active state highlighting.
 */
export function NavigationBar() {
  return (
    <nav
      aria-label="Main navigation"
      className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-(--color-border) lg:bg-(--color-bg-secondary)"
    >
      <ul className="flex flex-col gap-1 p-4" role="list">
        {NAV_LINKS.map(({ to, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-150
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
  );
}
