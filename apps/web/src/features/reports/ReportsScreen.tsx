import { useEffect, useState } from 'react';
import type { Child } from '@kga/contracts';
import { listChildren } from '../sessions/api';
import { ProgressionReport } from './ProgressionReport';
import { VsGroupReport } from './VsGroupReport';
import { PatternsReport } from './PatternsReport';

type View = 'progression' | 'vsGroup' | 'patterns';

const TABS: { key: View; label: string }[] = [
  { key: 'progression', label: 'התקדמות ילד/ה' },
  { key: 'vsGroup', label: 'ילד/ה מול הקבוצה' },
  { key: 'patterns', label: 'קיבוץ הגן' },
];

/**
 * M4 — the three §12 reporting views. Kept on local-state view switching (as in
 * M3); React Router arrives with the admin app (M6) when there are deep links
 * worth having.
 */
export function ReportsScreen() {
  const [view, setView] = useState<View>('progression');
  const [children, setChildren] = useState<Child[] | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listChildren()
      .then((rows) => {
        setChildren(rows);
        setChildId((prev) => prev ?? rows[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'שגיאה'));
  }, []);

  const needsChild = view === 'progression' || view === 'vsGroup';

  return (
    <div className="reports">
      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab ${view === tab.key ? 'tab-active' : ''}`}
            onClick={() => setView(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error && <p className="error-text">{error}</p>}

      {needsChild && (
        <label className="picker">
          ילד/ה:
          <select value={childId ?? ''} onChange={(e) => setChildId(e.target.value)}>
            {children?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>
      )}

      {needsChild && !childId && children && <p className="muted">אין ילדים רשומים בגן.</p>}
      {view === 'progression' && childId && <ProgressionReport childId={childId} />}
      {view === 'vsGroup' && childId && <VsGroupReport childId={childId} />}
      {view === 'patterns' && <PatternsReport />}
    </div>
  );
}
