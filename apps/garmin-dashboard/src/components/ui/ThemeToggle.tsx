import { useTheme } from '@/stores/preferences-store';
import type { ThemeMode } from '@/types/garmin';

// ─── Icons ────────────────────────────────────────────────────────────────────

function SunIcon({ className }: { className?: string }) {
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
      <circle cx="10" cy="10" r="4" fill="currentColor" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
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
        d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"
        fill="currentColor"
      />
    </svg>
  );
}

function SystemIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 16h6M10 13v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Theme Toggle Component ───────────────────────────────────────────────────

const THEME_OPTIONS: { value: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: SystemIcon },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg bg-(--color-bg-tertiary) p-1"
      role="radiogroup"
      aria-label="Theme selection"
    >
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        const isSelected = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${label} theme`}
            onClick={() => setTheme(value)}
            className={`
              inline-flex min-h-[44px] min-w-[44px] items-center justify-center
              rounded-md px-3 py-2 text-sm font-medium
              transition-colors duration-150 ease-in-out
              focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:outline-none
              ${
                isSelected
                  ? 'bg-(--color-bg-primary) text-(--color-text-primary) shadow-sm'
                  : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'
              }
            `}
          >
            <Icon className="h-5 w-5" />
            <span className="ml-1.5 hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
