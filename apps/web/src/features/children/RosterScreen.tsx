import { useCallback, useEffect, useState } from 'react';
import type { Child } from '@kga/contracts';
import { Avatar, EmptyState, FilterChips, SearchInput, Toast } from '@kga/ui';
import { deleteChild, listChildren } from '../sessions/api';
import { ChildDialog } from './ChildDialog';

type AgeFilter = 'ALL' | 'AGE_3_4' | 'AGE_4_5' | 'AGE_5_6';

const AGE_FILTERS: { value: AgeFilter; label: string }[] = [
  { value: 'ALL', label: 'הכל' },
  { value: 'AGE_3_4', label: '3-4' },
  { value: 'AGE_4_5', label: '4-5' },
  { value: 'AGE_5_6', label: '5-6' },
];

export function RosterScreen({ onPick }: { onPick: (child: Child) => void }) {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('ALL');
  const [dialogChild, setDialogChild] = useState<Child | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<Child | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(() => {
    listChildren(search || undefined, ageFilter === 'ALL' ? undefined : ageFilter)
      .then(setChildren)
      .catch((err) => setError(err instanceof Error ? err.message : 'שגיאה'));
  }, [search, ageFilter]);

  useEffect(() => {
    const t = setTimeout(reload, 200); // light debounce on search
    return () => clearTimeout(t);
  }, [reload]);

  const handleSaved = (child: Child) => {
    setDialogChild(null);
    setToast(dialogChild === 'new' ? `${child.displayName} נוסף/ה בהצלחה` : 'העדכון נשמר');
    reload();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteChild(confirmDelete.id);
      setToast(`${confirmDelete.displayName} הוסר/ה`);
      setConfirmDelete(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'המחיקה נכשלה');
      setConfirmDelete(null);
    }
  };

  return (
    <div className="roster">
      <div className="toolbar">
        <SearchInput
          placeholder="חיפוש לפי שם…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterChips options={AGE_FILTERS} value={ageFilter} onChange={setAgeFilter} />
        <button type="button" className="btn-primary" onClick={() => setDialogChild('new')}>
          + הוספת ילד/ה
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!children && !error && <p className="muted">טוען…</p>}

      {children && children.length === 0 && (
        <EmptyState
          icon="🧒"
          title={search || ageFilter !== 'ALL' ? 'לא נמצאו ילדים תואמים' : 'אין ילדים עדיין'}
          description={
            search || ageFilter !== 'ALL' ? 'נסו לשנות את החיפוש או הסינון.' : 'הוסיפו את הילד/ה הראשון/ה בגן.'
          }
          action={
            !search && ageFilter === 'ALL' ? (
              <button type="button" className="btn-primary" onClick={() => setDialogChild('new')}>
                + הוספת ילד/ה
              </button>
            ) : undefined
          }
        />
      )}

      <ul className="child-list">
        {children?.map((child) => (
          <li key={child.id}>
            <div className="child-row">
              <span className="child-row-main">
                <Avatar name={child.displayName} photoUrl={child.photoUrl} />
                <button type="button" className="child-row-name" onClick={() => onPick(child)}>
                  <strong>{child.displayName}</strong>
                  <small className="muted">{child.birthDate}</small>
                </button>
              </span>
              <span className="child-row-actions">
                <button type="button" className="btn-ghost btn-ghost-sm" onClick={() => setDialogChild(child)}>
                  עריכה
                </button>
                <button type="button" className="btn-ghost btn-ghost-sm" onClick={() => setConfirmDelete(child)}>
                  מחיקה
                </button>
              </span>
              <button type="button" className="go" onClick={() => onPick(child)}>
                התחל אבחון ←
              </button>
            </div>
          </li>
        ))}
      </ul>

      {dialogChild !== null && (
        <ChildDialog
          child={dialogChild === 'new' ? null : dialogChild}
          onClose={() => setDialogChild(null)}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <div className="dialog-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <h2>מחיקת {confirmDelete.displayName}?</h2>
            <p className="muted">הפעולה הפיכה על ידי צוות התמיכה בלבד — הרשומה לא נמחקת לצמיתות.</p>
            <div className="row">
              <button type="button" className="btn-primary" onClick={() => void handleDelete()}>
                מחיקה
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(null)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
