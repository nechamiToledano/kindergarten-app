import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import {
  AppShell,
  AssessmentIcon,
  ChildrenIcon,
  DashboardIcon,
  LibraryIcon,
  ReportsIcon,
  Spinner,
  SyncBadge,
  type NavItem,
} from '@kga/ui';
import { LoginScreen } from './features/auth/LoginScreen';
import { DashboardScreen } from './features/dashboard/DashboardScreen';
import { RosterScreen } from './features/children/RosterScreen';
import { ChildWorkspace } from './features/children/ChildWorkspace';
import { LibraryScreen } from './features/library/LibraryScreen';
import { LibraryPreviewScreen } from './features/library/LibraryPreviewScreen';
import { ReportsScreen } from './features/reports/ReportsScreen';
import { SessionRunner } from './features/sessions/SessionRunner';
import { PracticeScreen } from './features/practice/PracticeScreen';
import { NewAssessmentButton } from './features/sessions/NewAssessmentDialog';
import { useAuth } from './shared/auth/AuthProvider';
import { useOutbox } from './shared/outbox/OutboxProvider';

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'גננת',
  KINDERGARTEN_ADMIN: 'מנהלת גן',
  NETWORK_ADMIN: 'מנהלת רשת',
  CONTENT_EDITOR: 'עורכת תוכן',
};

const NAV: NavItem[] = [
  { key: '/', label: 'סקירה כללית', icon: <DashboardIcon /> },
  { key: '/children', label: 'ילדי הגן', icon: <ChildrenIcon /> },
  { key: '/reports', label: 'דוחות ותובנות', icon: <ReportsIcon /> },
  { key: '/library', label: 'ספריית המשחקים', icon: <LibraryIcon /> },
];

const FOOTER_NAV: NavItem[] = [
  { key: '/practice', label: 'משחק חופשי', icon: <AssessmentIcon /> },
];

/**
 * Routing.
 *
 * The app previously switched screens with a `useState` in this component, which
 * meant no URL for a child, no back button, and no way to return to where you
 * were after the iPad reloaded the PWA. The child workspace in particular is
 * only a place you can send someone if it has an address.
 *
 * The runner and the practice surface are routed *outside* the shell: both hand
 * the iPad to a child, and the navigation rail is the one thing that must not be
 * reachable while they hold it.
 */
export default function App() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-3 text-muted-foreground">
        <Spinner className="size-5" />
        טוען…
      </div>
    );
  }

  if (status === 'anon') return <LoginScreen />;

  return (
    <Routes>
      {/* Chrome-free surfaces — a child is holding the device. */}
      <Route path="/run/:sessionId" element={<SessionRunner />} />
      <Route path="/practice" element={<PracticeScreen />} />
      <Route path="/library/preview/:subdomainId" element={<LibraryPreviewScreen />} />
      <Route path="*" element={<ShellRoutes />} />
    </Routes>
  );

  function ShellRoutes() {
    const active =
      NAV.map((item) => item.key)
        .filter((key) => key !== '/')
        .find((key) => location.pathname.startsWith(key)) ?? '/';

    return (
      <AppShell
        brand="תלם"
        brandSubtitle="תובנות להתפתחות מדויקת"
        nav={NAV}
        footerNav={FOOTER_NAV}
        active={active}
        onNavigate={(key) => navigate(key)}
        user={
          user
            ? { name: user.displayName, role: ROLE_LABELS[user.role] ?? user.role }
            : undefined
        }
        onLogout={logout}
        statusSlot={<OutboxStatus />}
        actions={<NewAssessmentButton />}
        title={NAV.find((item) => item.key === active)?.label}
      >
        <Routes>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/children" element={<RosterScreen />} />
          <Route path="/children/:childId" element={<ChildWorkspace />} />
          <Route path="/reports" element={<ReportsScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    );
  }
}

function OutboxStatus() {
  const { pending, syncing } = useOutbox();
  return <SyncBadge pending={pending} syncing={syncing} />;
}
