import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorState, Field, Input, TelemMark } from '@kga/ui';
import { ApiError } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthProvider';
import './login-screen.css';

/**
 * Sign in.
 *
 * Still crossed once a morning and still fast on a tablet keyboard — but a
 * login is also the first thing a new teacher sees of the product, so it gets
 * to be warm. The decoration is confined to this screen; see login-screen.css
 * for why it doesn't leak into the calm, static rest of the app.
 */
export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ email, password });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? // The server answers a wrong password and a rate-limit block
            // differently; passing its message through keeps "try again in 40s"
            // from being flattened into "login failed".
            err.message
          : 'ההתחברות נכשלה. בדקו את החיבור לאינטרנט.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      {/* Soft, slow-drifting colour field. Purely decorative, so it's inert to
          assistive tech and never competes with the form for attention. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="login-blob absolute -top-24 -start-20 size-72 rounded-full bg-accent/70 blur-3xl"
        />
        <div
          className="login-blob login-blob-delay absolute -bottom-28 -end-16 size-80 rounded-full bg-partial-soft blur-3xl"
        />
        <div
          className="login-blob absolute top-1/3 end-1/4 size-56 rounded-full bg-info-soft blur-3xl opacity-70"
        />

        {/* A few gentle kindergarten motifs — a sun, a cloud, a building block —
            kept in the brand palette so they read as friendly rather than a
            children's app. */}
        <svg
          className="login-float absolute start-[8%] top-[14%] size-10 text-partial opacity-60 sm:size-12"
          style={{ ['--login-float-rot' as string]: '-6deg' }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4.5" />
          <path
            strokeLinecap="round"
            d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M19.07 4.93l-1.77 1.77M6.7 17.3l-1.77 1.77M19.07 19.07l-1.77-1.77M6.7 6.7 4.93 4.93"
          />
        </svg>
        <svg
          className="login-float absolute end-[10%] top-[20%] size-14 text-info opacity-50 sm:size-16"
          style={{ animationDelay: '-2.4s', ['--login-float-rot' as string]: '3deg' }}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M7 17a4.5 4.5 0 0 1-.5-8.97A5.5 5.5 0 0 1 17.4 9.03 4 4 0 0 1 17 17H7Z" />
        </svg>
        <svg
          className="login-float absolute bottom-[16%] start-[12%] size-9 text-present opacity-55 sm:size-11"
          style={{ animationDelay: '-1.1s', ['--login-float-rot' as string]: '8deg' }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <path strokeLinecap="round" d="M9 4v16M4 9h5M4 15h5" />
        </svg>
      </div>

      <Card className="animate-in relative w-full max-w-sm overflow-hidden rounded-2xl p-7 shadow-float">
        {/* A warm cap on the card itself, echoing the blobs behind it. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-accent/60 to-transparent"
          aria-hidden
        />

        <div className="relative mb-6 flex flex-col items-center gap-3 text-center">
          <span className="login-badge flex size-14 items-center justify-center">
            <TelemMark className="size-14" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold">תלם</h1>
            <p className="text-sm text-muted-foreground">
              בוקר טוב! מערכת אבחון והתפתחות לגני ילדים
            </p>
          </div>
        </div>

        <form className="relative flex flex-col gap-4" onSubmit={submit}>
          <Field label="דוא״ל" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </Field>

          <Field label="סיסמה" htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>

          {error && <ErrorState message={error} />}

          <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
            כניסה
          </Button>
        </form>

        <p className="relative mt-6 text-center text-xs text-muted-foreground">
          הגישה מיועדת לצוות הגן בלבד · הנתונים מוצפנים בתעבורה ובאחסון
        </p>
      </Card>
    </main>
  );
}
