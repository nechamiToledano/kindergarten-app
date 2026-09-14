import { useState, type FormEvent } from 'react';
import { ApiError } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthProvider';

export function LoginScreen() {
  const { login, wrongRole } = useAuth();
  const [email, setEmail] = useState('editor@demo.dev');
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
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'ההתחברות נכשלה',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-screen">
      <form className="card login-card" onSubmit={submit}>
        <h1>ניהול תוכן</h1>
        <p className="muted">אבחון גני ילדים — עורך תוכן</p>
        <label>
          דוא״ל
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          סיסמה
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {wrongRole && !error && (
          <p className="error-text">גישה מוגבלת לעורכי תוכן בלבד.</p>
        )}
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'מתחבר…' : 'כניסה'}
        </button>
      </form>
    </div>
  );
}
