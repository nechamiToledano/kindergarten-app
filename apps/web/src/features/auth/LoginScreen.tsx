import { useState, type FormEvent } from 'react';
import { ApiError } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthProvider';

/**
 * M7 follow-up — replaces the plain `.card.login-card` (M3) with a dedicated
 * `.login-screen` treatment: a soft gradient backdrop (§2.2 `--gradient-soft`)
 * behind a floating card, matching the brand mark used in `AppShell`. No
 * behaviour changes — same `login()` call, same demo-account defaults.
 */
export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('teacher@demo.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ההתחברות נכשלה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-panel">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden />
          <h1>אבחון גני ילדים</h1>
          <p>כניסת גננת — הגן שלך, במקום אחד</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            דוא״ל
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            סיסמה
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? 'מתחבר…' : 'כניסה'}
          </button>
        </form>

        <p className="login-foot">כל הנתונים שמורים ומוצפנים · לגננות ולצוות הגן בלבד</p>
      </div>
    </div>
  );
}
