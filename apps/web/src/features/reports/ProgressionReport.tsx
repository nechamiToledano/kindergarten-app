import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getProgression } from './api';
import {
  CHART_PALETTE,
  ExportButtons,
  RATING_LABELS,
  RATING_SCORE,
  scoreToLabel,
  useAsync,
} from './shared';

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });

/** Spec §7 view 1 — one child's rating per subdomain over successive sessions. */
export function ProgressionReport({ childId }: { childId: string }) {
  const state = useAsync(() => getProgression(childId), [childId]);

  if (state.status === 'loading') return <p className="muted">טוען…</p>;
  if (state.status === 'error') return <p className="error-text">{state.message}</p>;

  const { childName, points } = state.data;
  if (points.length === 0) {
    return <p className="muted">אין עדיין תוצאות עבור {childName}.</p>;
  }

  const subdomains = [...new Set(points.map((p) => p.subdomainName))];
  const sessionOrder: { id: string; startedAt: string }[] = [];
  for (const p of points) {
    if (!sessionOrder.some((s) => s.id === p.sessionId)) {
      sessionOrder.push({ id: p.sessionId, startedAt: p.startedAt });
    }
  }
  const rows = sessionOrder.map((session) => {
    const row: Record<string, number | string> = { name: dateLabel(session.startedAt) };
    for (const p of points) {
      if (p.sessionId === session.id) row[p.subdomainName] = RATING_SCORE[p.rating];
    }
    return row;
  });

  return (
    <div className="report-body">
      <h2>{childName} — התקדמות לאורך זמן</h2>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={rows} margin={{ top: 8, left: 8, right: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" stroke="var(--text)" reversed />
            <YAxis
              stroke="var(--text)"
              domain={[0, 2]}
              ticks={[0, 1, 2]}
              width={90}
              orientation="right"
              tickFormatter={scoreToLabel}
            />
            <Tooltip
              formatter={(value, name) => [scoreToLabel(Number(value)), String(name)]}
              contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            />
            <Legend />
            {subdomains.map((sub, i) => (
              <Line
                key={sub}
                type="stepAfter"
                dataKey={sub}
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={2}
                connectNulls
                dot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="report-table">
        <thead>
          <tr>
            <th>תת-תחום</th>
            <th>תאריך</th>
            <th>דירוג</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={`${p.sessionId}:${p.subdomainId}`}>
              <td>{p.subdomainName}</td>
              <td>{dateLabel(p.startedAt)}</td>
              <td>{RATING_LABELS[p.rating]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ExportButtons basePath={`/reports/children/${childId}/progression/export`} />
    </div>
  );
}
