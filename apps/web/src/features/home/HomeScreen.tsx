import { PageHeader, StatCard } from '@kga/ui';
import { RATING_COLOR, RATING_LABELS, useAsync } from '../reports/shared';
import { useAuth } from '../../shared/auth/AuthProvider';
import { getKindergartenSummary } from './api';

const TODAY = new Date().toLocaleDateString('he-IL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * M7 §3.1 — the new landing screen between login and the roster. Everything
 * here reads data the `reports` module already computes (§12); this screen is
 * a concentration, not new business logic.
 */
export function HomeScreen({
  onOpenChildren,
  onOpenReports,
  onOpenPractice,
}: {
  onOpenChildren: () => void;
  onOpenReports: () => void;
  onOpenPractice: () => void;
}) {
  const { user } = useAuth();
  const state = useAsync(getKindergartenSummary, []);

  return (
    <div>
      <PageHeader
        eyebrow={TODAY}
        title={`שלום, ${user?.displayName ?? 'גננת'} 👋`}
        subtitle="הנה תמונת המצב של הגן להיום."
        actions={
          <button type="button" className="btn-primary" onClick={onOpenChildren}>
            + אבחון חדש
          </button>
        }
      />

      {state.status === 'loading' && <p className="muted">טוען…</p>}
      {state.status === 'error' && <p className="error-text">{state.message}</p>}

      {state.status === 'ready' && (
        <div className="stat-grid">
          <StatCard icon="🧒" label="ילדים בגן" value={state.data.childrenCount} />
          <StatCard icon="📅" label="סשנים השבוע" value={state.data.sessionsThisWeek} />
          <StatCard icon="✅" label="אובחנו החודש" value={`${state.data.diagnosedPctThisMonth}%`} />
          <StatCard
            icon="🎯"
            label="הכי מאתגר החודש"
            value={state.data.topChallengeDomain ?? '—'}
          />
        </div>
      )}

      <div className="action-grid">
        <button type="button" className="action-card" onClick={onOpenChildren}>
          <span className="action-icon" aria-hidden>
            🧒
          </span>
          <span className="action-label">אבחון חדש</span>
        </button>
        <button type="button" className="action-card alt" onClick={onOpenChildren}>
          <span className="action-icon" aria-hidden>
            📋
          </span>
          <span className="action-label">ילדים</span>
        </button>
        <button type="button" className="action-card tertiary" onClick={onOpenPractice}>
          <span className="action-icon" aria-hidden>
            🎮
          </span>
          <span className="action-label">משחקים חופשיים</span>
        </button>
        <button type="button" className="action-card quaternary" onClick={onOpenReports}>
          <span className="action-icon" aria-hidden>
            📊
          </span>
          <span className="action-label">דוחות</span>
        </button>
      </div>

      {state.status === 'ready' && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>פעילות אחרונה</h2>
              <p>הסשנים האחרונים בגן</p>
            </div>
          </div>
          {state.data.recentSessions.length === 0 && (
            <p className="muted">עדיין אין סשנים בגן.</p>
          )}
          <ul className="summary-list">
            {state.data.recentSessions.map((s) => (
              <li key={s.sessionId}>
                <span>
                  {s.childName}
                  {s.domainName ? ` · ${s.domainName}` : ''}
                </span>
                <span className="row">
                  <span className="muted">{new Date(s.startedAt).toLocaleDateString('he-IL')}</span>
                  {s.rating && (
                    <span
                      className="badge"
                      style={{ borderColor: RATING_COLOR[s.rating], color: RATING_COLOR[s.rating] }}
                    >
                      {RATING_LABELS[s.rating]}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
