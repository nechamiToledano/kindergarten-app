import { useEffect, useState, type ReactNode } from 'react';
import { Avatar, cn } from './primitives.js';
import { TelemMark } from './icons.js';

/**
 * The teacher shell.
 *
 * Deliberately wraps only the browsing and management screens. The assessment
 * runner and the practice surface stay full-bleed and chrome-free: both put the
 * iPad in front of a child mid-exercise, and a navigation rail is exactly the
 * thing a four-year-old will tap.
 */

export interface NavItem {
  key: string;
  label: string;
  /** A 20px lucide-style icon. Not mirrored — see the RTL note on the rail. */
  icon: ReactNode;
  badge?: number;
}

/**
 * The sidebar, and the RTL problem it exists to solve.
 *
 * The redesign prototype put the icon and label in a plain flex row and relied
 * on the document direction to place them. That is not enough: the row reverses,
 * but the icon ends up optically adrift from the label because the icon box and
 * the text have different side bearings, and the active indicator — drawn on the
 * left edge in the LTR design — stays on the wrong side of the item entirely.
 *
 * So: the icon sits in a fixed 20px box that is never mirrored (an ear, an eye,
 * a chart are objects and read the same in both directions), gap and padding are
 * logical properties, and the active marker is pinned with `inset-inline-start`
 * so it lands against the reading edge — the right-hand side in Hebrew. Anything
 * that genuinely encodes direction, like the chevron on a row, carries
 * `.flip-rtl` and turns around on its own.
 */
function SidebarItem({
  item,
  active,
  collapsed,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'relative flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-2 w-[3px] rounded-full bg-primary"
          style={{ insetInlineStart: 0 }}
        />
      )}
      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="tabular ms-auto rounded-full bg-secondary px-2 py-0.5 text-xs">
          {item.badge}
        </span>
      )}
    </button>
  );
}

export function AppShell({
  brand,
  brandSubtitle,
  nav,
  footerNav = [],
  active,
  onNavigate,
  user,
  onLogout,
  breadcrumb,
  title,
  description,
  actions,
  statusSlot,
  children,
}: {
  brand: string;
  brandSubtitle?: string;
  nav: NavItem[];
  footerNav?: NavItem[];
  active: string;
  onNavigate: (key: string) => void;
  user?: { name: string; role: string; kindergarten?: string | null };
  onLogout: () => void;
  breadcrumb?: ReactNode;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Sync state and similar ambient indicators, shown in the top bar. */
  statusSlot?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Navigating closes the drawer — on a phone the shell is an overlay, and
  // leaving it open over the screen you just asked for is disorienting.
  useEffect(() => {
    setMobileOpen(false);
  }, [active]);

  const rail = (inDrawer: boolean) => (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col gap-1 border-sidebar-border bg-sidebar p-3',
        // The border is on the inline end — the left edge in Hebrew — so the rail
        // always separates itself from the content, whichever side it is on.
        'border-e',
        inDrawer ? 'w-64' : collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('flex shrink-0 items-center gap-2.5 px-1 py-2', collapsed && !inDrawer && 'justify-center')}>
        <span className="flex size-9 shrink-0 items-center justify-center">
          <TelemMark className="size-8" />
        </span>
        {(!collapsed || inDrawer) && (
          <span className="grid min-w-0 text-start leading-tight">
            <span className="font-brand truncate text-xl font-light tracking-wide text-sidebar-foreground">
              {brand}
            </span>
            {brandSubtitle && (
              <span className="truncate text-xs font-light text-muted-foreground">
                {brandSubtitle}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Its own scroll region: a long nav list scrolls in place instead of
          carrying the logo and the user card off the top and bottom of the rail. */}
      <nav aria-label="ניווט ראשי" className="scrollbar-thin mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {nav.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            active={item.key === active}
            collapsed={collapsed && !inDrawer}
            onSelect={() => onNavigate(item.key)}
          />
        ))}
      </nav>

      <div className="mt-auto flex shrink-0 flex-col gap-0.5 pt-3">
        {footerNav.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            active={item.key === active}
            collapsed={collapsed && !inDrawer}
            onSelect={() => onNavigate(item.key)}
          />
        ))}

        {user && (
          <div
            className={cn(
              'mt-1 flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-card p-2',
              collapsed && !inDrawer && 'justify-center border-0 bg-transparent p-1',
            )}
          >
            <Avatar name={user.name} size={32} />
            {(!collapsed || inDrawer) && (
              <>
                <span className="grid min-w-0 flex-1 text-start leading-tight">
                  <span className="truncate text-sm font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.role}
                    {user.kindergarten ? ` · ${user.kindergarten}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="התנתקות"
                  title="התנתקות"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <LogoutIcon />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    // Fixed to the viewport height so the rail and the content area each own
    // their own scroll region, instead of both scrolling together as one long
    // page — the sidebar stays put while a long report or roster scrolls.
    <div className="flex h-dvh bg-background">
      <div className="hidden md:flex">{rail(false)}</div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/25 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="h-full w-64 shadow-float"
            style={{ marginInlineStart: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            {rail(true)}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="פתיחת תפריט"
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary md:hidden"
          >
            <MenuIcon />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'הרחבת תפריט' : 'כיווץ תפריט'}
            className="hidden rounded-md p-2 text-muted-foreground hover:bg-secondary md:block"
          >
            <MenuIcon />
          </button>

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {breadcrumb}
            {title && !breadcrumb && (
              <h1 className="font-display truncate text-lg font-semibold leading-tight">
                {title}
              </h1>
            )}
          </div>

          {statusSlot}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>

        <main className="flex-1 p-4 md:p-6">
          {title && breadcrumb === undefined && description && (
            <div className="mb-6 hidden md:block">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

/** Pending results waiting on the outbox — ambient, never blocking. */
export function SyncBadge({ pending, syncing }: { pending: number; syncing: boolean }) {
  if (pending === 0) return null;
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-xs font-medium text-info"
    >
      <span
        className={cn('size-1.5 rounded-full bg-info', syncing && 'animate-pulse')}
        aria-hidden
      />
      {syncing ? 'מסנכרן…' : `${pending} ממתין לסנכרון`}
    </span>
  );
}

/* Inline icons — the shell must not depend on an icon package. */

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 flip-rtl"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" />
      <path d="m16 17 5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
