import { useState } from 'react';
import type { Child } from '@kga/contracts';
import { AppShell, SyncBadge, type ShellNavItem } from '@kga/ui';
import { LoginScreen } from './features/auth/LoginScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { RosterScreen } from './features/children/RosterScreen';
import { PracticeScreen } from './features/practice/PracticeScreen';
import { ReportsScreen } from './features/reports/ReportsScreen';
import { SessionRunner } from './features/sessions/SessionRunner';
import { useAuth } from './shared/auth/AuthProvider';
import { useOutbox } from './shared/outbox/OutboxProvider';

type ShellView = 'home' | 'roster' | 'reports';

const NAV: ShellNavItem[] = [
  { key: 'home', label: 'בית', icon: '🏠' },
  { key: 'roster', label: 'ילדים', icon: '🧒' },
  { key: 'reports', label: 'דוחות', icon: '📊' },
];

const TITLES: Record<ShellView, string> = {
  home: 'בית',
  roster: 'ילדי הגן',
  reports: 'דוחות',
};

/**
 * M7 follow-up — the teacher's three browsing/management screens (Home,
 * Children, Reports) now render inside a persistent `AppShell` (sidebar +
 * topbar), instead of each drawing its own back/home/logout buttons. Practice
 * mode and an active assessment session (`SessionRunner`) are deliberately
 * kept OUTSIDE the shell: both eventually put the iPad in front of a child,
 * and the shell's own nav is exactly the kind of "place a child could wander
 * into mid-exercise" that §11.2 rules out for the play surface. Still no
 * router (§2.5 of the M7 doc) — three shell views and local state remain the
 * simplest thing that works at this size.
 */
export default function App() {
  const { user, status, logout } = useAuth();
  const { pending, syncing } = useOutbox();
  const [activeChild, setActiveChild] = useState<Child | null>(null);
  const [view, setView] = useState<'home' | 'roster' | 'reports' | 'practice'>('home');

  if (status === 'loading') return <p className="pad">טוען…</p>;
  if (status === 'anon') return <LoginScreen />;

  if (activeChild) {
    return <SessionRunner child={activeChild} onExit={() => setActiveChild(null)} />;
  }

  if (view === 'practice') {
    return <PracticeScreen onExit={() => setView('home')} />;
  }

  const shellView = view as ShellView;

  return (
    <AppShell
      title={TITLES[shellView]}
      nav={NAV}
      active={shellView}
      onNavigate={(key) => setView(key as ShellView)}
      userName={user?.displayName}
      onLogout={logout}
      topbarActions={
        <>
          <SyncBadge pending={pending} syncing={syncing} />
          {shellView !== 'roster' && (
            <button type="button" className="btn-primary" onClick={() => setView('roster')}>
              + אבחון חדש
            </button>
          )}
        </>
      }
    >
      {shellView === 'home' && (
        <HomeScreen
          onOpenChildren={() => setView('roster')}
          onOpenReports={() => setView('reports')}
          onOpenPractice={() => setView('practice')}
        />
      )}
      {shellView === 'roster' && <RosterScreen onPick={setActiveChild} />}
      {shellView === 'reports' && <ReportsScreen />}
    </AppShell>
  );
}
