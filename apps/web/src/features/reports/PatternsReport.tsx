import { useState } from 'react';
import type { CrossChildPattern } from '@kga/contracts';
import { getPatterns, listReportSubdomains } from './api';
import { ExportButtons, useAsync } from './shared';

const COLUMNS: { key: keyof Omit<CrossChildPattern, 'subdomainId' | 'subdomainName'>; label: string; className: string }[] =
  [
    { key: 'strong', label: 'שולטים', className: 'col-strong' },
    { key: 'partial', label: 'חלקית', className: 'col-partial' },
    { key: 'needsSupport', label: 'זקוקים לתמיכה', className: 'col-support' },
  ];

/** Spec §7 view 3 — every child in the kindergarten grouped for one subdomain. */
export function PatternsReport() {
  const list = useAsync(() => listReportSubdomains(), []);
  const [selected, setSelected] = useState<string | null>(null);

  if (list.status === 'loading') return <p className="muted">טוען…</p>;
  if (list.status === 'error') return <p className="error-text">{list.message}</p>;
  if (list.data.length === 0) {
    return <p className="muted">אין עדיין תוצאות בגן להצגה בדוח זה.</p>;
  }

  const subdomainId = selected ?? list.data[0].subdomainId;

  return (
    <div className="report-body">
      <h2>קיבוץ ילדים לפי תת-תחום</h2>
      <label className="picker">
        תת-תחום:
        <select value={subdomainId} onChange={(e) => setSelected(e.target.value)}>
          {list.data.map((s) => (
            <option key={s.subdomainId} value={s.subdomainId}>
              {s.domainName} — {s.subdomainName} ({s.resultCount})
            </option>
          ))}
        </select>
      </label>
      <PatternGrid subdomainId={subdomainId} />
    </div>
  );
}

function PatternGrid({ subdomainId }: { subdomainId: string }) {
  const state = useAsync(() => getPatterns(subdomainId), [subdomainId]);

  if (state.status === 'loading') return <p className="muted">טוען…</p>;
  if (state.status === 'error') return <p className="error-text">{state.message}</p>;

  const pattern = state.data;
  return (
    <>
      <div className="pattern-cols">
        {COLUMNS.map((col) => {
          const children = pattern[col.key];
          return (
            <div key={col.key} className={`pattern-col ${col.className}`}>
              <h3>
                {col.label} <span className="muted">({children.length})</span>
              </h3>
              <ul>
                {children.map((c) => (
                  <li key={c.id}>{c.displayName}</li>
                ))}
                {children.length === 0 && <li className="muted">—</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <ExportButtons basePath={`/reports/subdomains/${subdomainId}/patterns/export`} />
    </>
  );
}
