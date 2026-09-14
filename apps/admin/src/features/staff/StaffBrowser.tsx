import { useEffect, useState } from 'react';
import type { Kindergarten, Role, User } from '@kga/contracts';
import { useAuth } from '../../shared/auth/AuthProvider';
import { staffApi } from './api';

const ROLE_LABEL: Record<Role, string> = {
  TEACHER: 'גננת',
  KINDERGARTEN_ADMIN: 'מנהל/ת גן',
  NETWORK_ADMIN: 'מנהל/ת רשת',
  CONTENT_EDITOR: 'עורך/ת תוכן',
};

const blankForm = { email: '', displayName: '', role: 'TEACHER' as Role, kindergartenId: '', password: '' };

export function StaffBrowser() {
  const { user } = useAuth();
  const assignableRoles: Role[] =
    user?.role === 'NETWORK_ADMIN'
      ? ['TEACHER', 'KINDERGARTEN_ADMIN', 'NETWORK_ADMIN']
      : ['TEACHER', 'KINDERGARTEN_ADMIN'];

  const [users, setUsers] = useState<User[] | null>(null);
  const [kgs, setKgs] = useState<Kindergarten[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const kgName = (id: string | null) => kgs.find((k) => k.id === id)?.name ?? '—';

  function load() {
    setUsers(null);
    staffApi.listUsers().then(setUsers).catch((e) => setError(errMsg(e)));
  }

  useEffect(() => {
    load();
    staffApi.listKindergartens().then(setKgs).catch(() => undefined);
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await staffApi.createUser({
        email: form.email,
        displayName: form.displayName,
        role: form.role,
        kindergartenId: form.role === 'NETWORK_ADMIN' ? null : form.kindergartenId || null,
        password: form.password,
      });
      setForm(blankForm);
      load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(u: User, role: Role) {
    try {
      await staffApi.updateUser(u.id, { role });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function changeKg(u: User, kindergartenId: string) {
    try {
      await staffApi.updateUser(u.id, { kindergartenId: kindergartenId || null });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function resetPassword(u: User) {
    const password = window.prompt(`סיסמה חדשה ל${u.displayName} (לפחות 8 תווים)`);
    if (!password) return;
    try {
      await staffApi.updateUser(u.id, { password });
      setEditing(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function deactivate(u: User) {
    if (!window.confirm(`להשבית את ${u.displayName}?`)) return;
    try {
      await staffApi.deactivateUser(u.id);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function addKindergarten() {
    const name = window.prompt('שם הגן החדש');
    if (!name) return;
    try {
      const kg = await staffApi.createKindergarten(name);
      setKgs((prev) => [...prev, kg]);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="browser">
      {error && <p className="error-text">{error}</p>}

      <section className="col">
        <div className="col-head">
          <h2>גנים</h2>
          {user?.role === 'NETWORK_ADMIN' && (
            <button type="button" className="btn-ghost" onClick={addKindergarten}>
              + גן
            </button>
          )}
        </div>
        <ul className="list">
          {kgs.map((k) => (
            <li key={k.id}>
              <span className="list-main">{k.name}</span>
              <button
                type="button"
                className="link"
                onClick={async () => {
                  const name = window.prompt('שם חדש', k.name);
                  if (name && name !== k.name) {
                    await staffApi.renameKindergarten(k.id, name);
                    setKgs((p) => p.map((x) => (x.id === k.id ? { ...x, name } : x)));
                  }
                }}
              >
                שנה שם
              </button>
            </li>
          ))}
          {kgs.length === 0 && <li className="muted">אין גנים.</li>}
        </ul>
      </section>

      <section className="col" style={{ marginBlockStart: '1.5rem' }}>
        <div className="col-head">
          <h2>צוות</h2>
        </div>

        <fieldset className="sf-object">
          <legend>הוספת איש צוות</legend>
          <div className="sf">
            <label className="sf-field">
              <span className="sf-label">דוא״ל</span>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="sf-field">
              <span className="sf-label">שם</span>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </label>
            <label className="sf-field">
              <span className="sf-label">תפקיד</span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            {form.role !== 'NETWORK_ADMIN' && (
              <label className="sf-field">
                <span className="sf-label">גן</span>
                <select
                  value={form.kindergartenId}
                  onChange={(e) => setForm({ ...form, kindergartenId: e.target.value })}
                >
                  <option value="">בחר גן…</option>
                  {kgs.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="sf-field">
              <span className="sf-label">סיסמה ראשונית</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !form.email || !form.displayName || form.password.length < 8}
              onClick={submit}
            >
              {busy ? 'שומר…' : 'הוסף'}
            </button>
          </div>
        </fieldset>

        {!users && <p className="muted">טוען…</p>}
        <ul className="list" style={{ marginBlockStart: '1rem' }}>
          {users?.map((u) => (
            <li key={u.id}>
              <div className="list-main" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <strong>{u.displayName}</strong>
                <span className="muted">{u.email}</span>
                {editing === u.id ? (
                  <div className="row">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                    >
                      {assignableRoles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <select
                      value={u.kindergartenId ?? ''}
                      onChange={(e) => changeKg(u, e.target.value)}
                    >
                      <option value="">— ללא גן —</option>
                      {kgs.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="link" onClick={() => resetPassword(u)}>
                      אפס סיסמה
                    </button>
                  </div>
                ) : (
                  <span className="muted">
                    {ROLE_LABEL[u.role]} · {kgName(u.kindergartenId)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="link"
                onClick={() => setEditing(editing === u.id ? null : u.id)}
              >
                {editing === u.id ? 'סגור' : 'ערוך'}
              </button>
              <button type="button" className="link danger" onClick={() => deactivate(u)}>
                השבת
              </button>
            </li>
          ))}
          {users?.length === 0 && <li className="muted">אין אנשי צוות בתחום שלך.</li>}
        </ul>
      </section>
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'שגיאה';
}
