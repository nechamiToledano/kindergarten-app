import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { cn } from './primitives.js';

/**
 * Theme: dark by default, light on request. Stored per device, because a
 * tablet in a classroom is set once and left. The choice is applied to <html>
 * as `data-theme`, which theme.css and the play surface key off.
 *
 * Each app's index.html runs the same read before first paint, so a
 * light-theme user never gets a dark flash.
 */
export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'kga-theme';

export function getTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#24494A' : '#121513');
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: the choice still applies for this session.
    }
    setThemeState(next);
  }, []);

  return [theme, setTheme];
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/** A two-option switch with both choices visible, so the current mode is never ambiguous. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const options: { value: Theme; label: string; icon: ReactNode }[] = [
    { value: 'dark', label: 'מצב כהה', icon: <MoonIcon /> },
    { value: 'light', label: 'מצב בהיר', icon: <SunIcon /> },
  ];

  return (
    <div
      role="group"
      aria-label="ערכת נושא"
      className={cn('inline-flex rounded-full border border-border bg-secondary p-0.5', className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={theme === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => setTheme(option.value)}
          className={cn(
            'grid size-9 place-items-center rounded-full transition-colors',
            theme === option.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
