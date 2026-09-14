import { useEffect, useMemo } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from 'react';

/** CSS custom properties aren't in the DOM typings — this widens style objects that set one. */
type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;

/** Spec §10 — child-surface controls are never smaller than 80px. */
export const MIN_TOUCH_TARGET_PX = 80;

export function TouchTarget({
  children,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...rest}
      style={{
        minInlineSize: MIN_TOUCH_TARGET_PX,
        minBlockSize: MIN_TOUCH_TARGET_PX,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export type RatingValue = 'PRESENT' | 'PARTIALLY_PRESENT' | 'ABSENT';

export function RatingBar({
  value,
  onChange,
  labels,
}: {
  value: RatingValue | null;
  onChange: (v: RatingValue) => void;
  labels: Record<RatingValue, string>;
}) {
  const options: RatingValue[] = ['PRESENT', 'PARTIALLY_PRESENT', 'ABSENT'];
  return (
    <div style={{ display: 'flex', gap: '1rem' }} role="radiogroup" dir="rtl">
      {options.map((option) => (
        <TouchTarget
          key={option}
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </TouchTarget>
      ))}
    </div>
  );
}

/*
 * ==================== M7 design-system components (§2.4) ====================
 * These are markup + behaviour only. Every class name below (`.stat-card`,
 * `.avatar`, `.empty-state`, …) is styled once, per-app, in that app's own
 * stylesheet (`apps/web/src/styles/app.css` §"M7 shared components") — this
 * package stays framework-and-CSS-free per §3.6/§5.1, and `apps/admin` gets the
 * same look by defining the same class names.
 */

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  /** Small line above the title — e.g. today's date. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="page-header-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({
  icon,
  label,
  value,
  trend,
}: {
  icon: string;
  label: string;
  value: string | number;
  /** Positive = up-trend, negative = down-trend, omitted = no trend shown. */
  trend?: number;
}) {
  return (
    <div className="stat-card fade-in">
      <span className="stat-card-icon" aria-hidden>
        {icon}
      </span>
      <span className="stat-card-value">{value}</span>
      <span className="stat-card-label">{label}</span>
      {trend !== undefined && (
        <span className={`stat-card-trend ${trend >= 0 ? 'up' : 'down'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

function colorFromName(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

export function Avatar({
  name,
  photoUrl,
  size = 44,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const bg = useMemo(() => colorFromName(name), [name]);
  return (
    <span
      className="avatar"
      style={{ '--avatar-size': `${size}px`, background: photoUrl ? undefined : bg } as StyleWithVars}
      aria-hidden={!!photoUrl}
      title={name}
    >
      {photoUrl ? <img src={photoUrl} alt={name} /> : initialsOf(name)}
    </span>
  );
}

export function ProgressRing({
  percent,
  size = 64,
  color = 'var(--accent)',
}: {
  percent: number;
  size?: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = Math.round(size / 8);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}%`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset var(--dur-celebrate, 550ms) var(--ease-out, ease)' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size / 4.5} fontWeight={700}>
        {clamped}%
      </text>
    </svg>
  );
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state fade-in">
      <span className="empty-state-icon" aria-hidden>
        {icon}
      </span>
      <h3>{title}</h3>
      {description && <p className="muted">{description}</p>}
      {action}
    </div>
  );
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="search" className="search-input" {...props} />;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="filter-chips" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`filter-chip${opt.value === value ? ' active' : ''}`}
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}

const CONFETTI_COLORS = ['#e0602f', '#2b3a67', '#d99a2e', '#2f8f5b', '#f08d5e'];

/** CSS-only confetti (§2.5 — no animation library added). */
export function ConfettiBurst({ pieces = 24 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.round((i / pieces) * 100 + (Math.random() * 8 - 4)),
        delay: Math.random() * 150,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [pieces],
  );
  return (
    <div className="confetti-burst" aria-hidden>
      {items.map((it, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            insetInlineStart: `${it.left}%`,
            background: it.color,
            animationDelay: `${it.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function MascotBubble({ face = '🦊', children }: { face?: string; children: ReactNode }) {
  return (
    <div className="mascot-bubble">
      <span className="mascot-face" aria-hidden>
        {face}
      </span>
      <p>{children}</p>
    </div>
  );
}

export interface ShellNavItem {
  key: string;
  label: string;
  icon: string;
}

/**
 * M7 — the persistent app chrome for the teacher shell (§11.2, §2.1 of the M7
 * doc). Deliberately wraps only the three browsing/management screens (Home,
 * Children, Reports) — the assessment session (`SessionRunner`) and the
 * practice game surface both put the iPad in front of a child mid-exercise and
 * stay full-bleed and chrome-free, exactly like before M7 (no navigation a
 * child can wander into). This is markup + behaviour only; every class is
 * styled once in `apps/web/src/styles/app.css` ("app shell"), matching the
 * pattern every other §2.4 component already follows.
 */
export function AppShell({
  brand = 'הגן שלי',
  title,
  nav,
  active,
  onNavigate,
  userName,
  onLogout,
  topbarActions,
  children,
}: {
  brand?: string;
  title: string;
  nav: ShellNavItem[];
  active: string;
  onNavigate: (key: string) => void;
  userName?: string;
  onLogout: () => void;
  topbarActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <span className="shell-brand-mark" aria-hidden>
            {brand.slice(0, 1)}
          </span>
          <span>{brand}</span>
        </div>

        {userName && (
          <div className="shell-user">
            <Avatar name={userName} size={35} />
            <div className="shell-user-info">
              <span className="shell-user-name">{userName}</span>
              <button type="button" className="shell-user-logout" onClick={onLogout}>
                יציאה
              </button>
            </div>
          </div>
        )}

        <nav className="shell-nav" aria-label="ניווט ראשי">
          {nav.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`shell-nav-item${item.key === active ? ' active' : ''}`}
              aria-current={item.key === active ? 'page' : undefined}
              onClick={() => onNavigate(item.key)}
            >
              <span className="shell-nav-icon" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <h1>{title}</h1>
          {topbarActions && <div className="shell-topbar-actions">{topbarActions}</div>}
        </header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}

export function SyncBadge({ pending, syncing }: { pending: number; syncing: boolean }) {
  if (pending === 0) return null;
  return (
    <span className={`sync-badge${syncing ? ' syncing' : ''}`} role="status">
      <span className="sync-badge-dot" aria-hidden />
      {syncing ? 'מסנכרן…' : `${pending} ממתין לסנכרון`}
    </span>
  );
}
