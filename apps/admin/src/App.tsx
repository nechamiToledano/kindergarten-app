import { useState } from 'react';
import type { Role } from '@kga/contracts';
import { AppShell, LibraryIcon, ReportsIcon, SettingsIcon, UsersGroupIcon, type NavItem } from '@kga/ui';
import { LoginScreen } from './features/auth/LoginScreen';
import { ContentBrowser } from './features/content/ContentBrowser';
import { StaffBrowser } from './features/staff/StaffBrowser';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { AuditLogScreen } from './features/audit/AuditLogScreen';
import { MediaLibraryScreen } from './features/media/MediaLibraryScreen';
import { useAuth } from './shared/auth/AuthProvider';

type Tab = 'content' | 'media' | 'staff' | 'settings' | 'audit';

const TAB_LABEL: Record<Tab, string> = {
  content: 'תוכן',
  media: 'ספריית נכסים',
  staff: 'צוות וגנים',
  settings: 'הגדרות מערכת',
  audit: 'יומן פעולות',
};

const TAB_ICON: Record<Tab, NavItem['icon']> = {
  content: <LibraryIcon />,
  media: <LibraryIcon />,
  staff: <UsersGroupIcon />,
  settings: <SettingsIcon />,
  audit: <ReportsIcon />,
};

const ROLE_LABEL: Record<Role, string> = {
  TEACHER: 'גננת',
  KINDERGARTEN_ADMIN: 'מנהל/ת גן',
  NETWORK_ADMIN: 'מנהל/ת רשת',
  CONTENT_EDITOR: 'עורך/ת תוכן',
};

/**
 * apps/admin (M6, §14; extended M11 — real management; restyled onto @kga/ui).
 * A sidebar console, not a marketing-style centered page: navigation lives in
 * the rail so every surface a role can reach is visible at once. Surfaces
 * gated by role (§13.1): schema-generated content management (CONTENT_EDITOR,
 * §14.1–14.3), staff / kindergarten management (KINDERGARTEN_ADMIN /
 * NETWORK_ADMIN, §14.4), and network-wide system settings + audit log
 * (NETWORK_ADMIN only, M11). Views switch by local state — React Router lands
 * if the surface grows deep links.
 */
export default function App() {
  const { status, user, logout } = useAuth();

  const availableTabs: Tab[] = [
    ...(user?.role === 'CONTENT_EDITOR' ? (['content', 'media'] as const) : []),
    ...(user?.role === 'KINDERGARTEN_ADMIN' || user?.role === 'NETWORK_ADMIN'
      ? (['staff'] as const)
      : []),
    ...(user?.role === 'NETWORK_ADMIN' ? (['settings', 'audit'] as const) : []),
  ];

  const [tab, setTab] = useState<Tab>(availableTabs[0] ?? 'staff');

  if (status === 'loading') return <p className="p-8 text-sm text-muted-foreground">טוען…</p>;
  if (status === 'anon') return <LoginScreen />;

  const active = availableTabs.includes(tab) ? tab : availableTabs[0];

  const nav: NavItem[] = availableTabs.map((t) => ({ key: t, label: TAB_LABEL[t], icon: TAB_ICON[t] }));

  return (
    <AppShell
      brand="מערכת ניהול"
      nav={nav}
      active={active ?? ''}
      onNavigate={(key) => setTab(key as Tab)}
      user={user ? { name: user.displayName, role: ROLE_LABEL[user.role] } : undefined}
      onLogout={logout}
      title={active ? TAB_LABEL[active] : 'ניהול'}
    >
      {active === 'content' && <ContentBrowser />}
      {active === 'media' && <MediaLibraryScreen />}
      {active === 'staff' && <StaffBrowser />}
      {active === 'settings' && <SettingsScreen />}
      {active === 'audit' && <AuditLogScreen />}
      {!active && <p className="text-sm text-muted-foreground">לחשבון זה אין גישה לאף אחד ממסכי הניהול.</p>}
    </AppShell>
  );
}
