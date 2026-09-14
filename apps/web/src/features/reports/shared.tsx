import { useEffect, useState } from 'react';
import type { ExportFormat, Rating } from '@kga/contracts';
import { downloadExport } from './api';

export const RATING_LABELS: Record<Rating, string> = {
  PRESENT: 'קיים',
  PARTIALLY_PRESENT: 'קיים חלקית',
  ABSENT: 'לא קיים',
};

/** Ordinal score for charting (§12 progression view). */
export const RATING_SCORE: Record<Rating, number> = {
  ABSENT: 0,
  PARTIALLY_PRESENT: 1,
  PRESENT: 2,
};

export const RATING_COLOR: Record<Rating, string> = {
  PRESENT: '#2f8f5b',
  PARTIALLY_PRESENT: '#c17f1f',
  ABSENT: '#b23a3a',
};

export const CHART_PALETTE = ['#ff806c', '#5592c6', '#69c0ac', '#e7ba55', '#b23a3a', '#263a4a'];

export function scoreToLabel(value: number): string {
  if (value <= 0) return RATING_LABELS.ABSENT;
  if (value >= 2) return RATING_LABELS.PRESENT;
  return RATING_LABELS.PARTIALLY_PRESENT;
}

type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

/**
 * Minimal fetch-on-deps helper. §11.1 names TanStack Query; the reports screens
 * are read-only and low-traffic, so the M3 "keep the dependency surface small"
 * call stands — TanStack Query lands with the admin app (M6) when mutations and
 * cross-screen cache sharing actually pay for it.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    fn()
      .then((data) => {
        if (alive) setState({ status: 'ready', data });
      })
      .catch((err) => {
        if (alive)
          setState({ status: 'error', message: err instanceof Error ? err.message : 'שגיאה' });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

/** Shared PDF / Excel export controls (§12). `basePath` is the report endpoint. */
export function ExportButtons({ basePath }: { basePath: string }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (format: ExportFormat) => {
    setBusy(format);
    setError(null);
    try {
      await downloadExport(basePath, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאת ייצוא');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="row export-row">
      <button type="button" className="btn-ghost" disabled={busy !== null} onClick={() => run('pdf')}>
        {busy === 'pdf' ? 'מייצא…' : 'ייצוא PDF'}
      </button>
      <button
        type="button"
        className="btn-ghost"
        disabled={busy !== null}
        onClick={() => run('xlsx')}
      >
        {busy === 'xlsx' ? 'מייצא…' : 'ייצוא Excel'}
      </button>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
