import { useState } from 'react';
import { LoginScreen } from './features/auth/LoginScreen';
import { ContentBrowser } from './features/content/ContentBrowser';
import { StaffBrowser } from './features/staff/StaffBrowser';
import { useAuth } from './shared/auth/AuthProvider';

/**
 * apps/admin (M6, §14). Two surfaces gated by role (§13.1): schema-generated
 * content management (CONTENT_EDITOR, §14.1–14.3) and staff / kindergarten
 * management (KINDERGARTEN_ADMIN / NETWORK_ADMIN, §14.4). Views switch by local
 * state — React Router lands if the surface grows deep links.
 */
export default function App() {
  const { status, user, logout } = useAuth();

  const canContent = user?.role === 'CONTENT_EDITOR';
  const canStaff = user?.role === 'KINDERGARTEN_ADMIN' || user?.role === 'NETWORK_ADMIN';
  const [tab, setTab] = useState<'content' | 'staff'>(canContent ? 'content' : 'staff');

  if (status === 'loading') return <p className="pad">טוען…</p>;
  if (status === 'anon') return <LoginScreen />;

  const active = canContent && canStaff ? tab : canContent ? 'content' : 'staff';

  return (
    <div className="shell">
      <header className="shell-head">
        <h1>{active === 'content' ? 'ניהול תוכן' : 'ניהול צוות וגנים'}</h1>
        <div className="row">
          {canContent && canStaff && (
            <div className="tabs" style={{ border: 'none', margin: 0 }}>
              <button
                type="button"
                className={`tab ${active === 'content' ? 'tab-active' : ''}`}
                onClick={() => setTab('content')}
              >
                תוכן
              </button>
              <button
                type="button"
                className={`tab ${active === 'staff' ? 'tab-active' : ''}`}
                onClick={() => setTab('staff')}
              >
                צוות
              </button>
            </div>
          )}
          <span className="muted">{user?.displayName}</span>
          <button type="button" className="btn-ghost" onClick={logout}>
            יציאה
          </button>
        </div>
      </header>
      <main className="shell-main">
        {active === 'content' ? <ContentBrowser /> : <StaffBrowser />}
      </main>
    </div>
  );
}
