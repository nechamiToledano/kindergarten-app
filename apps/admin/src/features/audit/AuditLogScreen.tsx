import { useEffect, useState } from 'react';
import type { AuditLogEntry } from '@kga/contracts';
import { auditApi } from './api';

const PAGE_SIZE = 50;

/** M11 — network-wide change log: every mutation any admin surface can make, in one place. */
export function AuditLogScreen() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    auditApi
      .list({ entity: entity || undefined, action: action || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'));
  }, [entity, action, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="browser">
      <div className="row audit-filters">
        <input
          placeholder="סינון לפי ישות (למשל Subdomain, User)"
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
        />
        <input
          placeholder="סינון לפי פעולה (למשל update)"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <p className="error-text">{error}</p>}
      {!items && <p className="muted">טוען…</p>}

      {items && (
        <table className="audit-table">
          <thead>
            <tr>
              <th>מתי</th>
              <th>מי</th>
              <th>פעולה</th>
              <th>ישות</th>
              <th>פרטים</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString('he-IL')}</td>
                <td>{e.actorName ?? '—'}</td>
                <td>{e.action}</td>
                <td>
                  {e.entity}
                  {e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ''}
                </td>
                <td>
                  {e.metadata ? <code>{JSON.stringify(e.metadata)}</code> : '—'}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  אין רשומות תואמות.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div className="row pager">
        <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          הקודם
        </button>
        <span className="muted">
          עמוד {page} מתוך {pageCount}
        </span>
        <button
          type="button"
          className="btn-ghost"
          disabled={page >= pageCount}
          onClick={() => setPage((p) => p + 1)}
        >
          הבא
        </button>
      </div>
    </div>
  );
}
