import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getVsGroup } from './api';
import { ExportButtons, RATING_COLOR, RATING_LABELS, useAsync } from './shared';

/** Spec §7 view 2 — the child's latest rating per subdomain against the cohort. */
export function VsGroupReport({ childId }: { childId: string }) {
  const state = useAsync(() => getVsGroup(childId), [childId]);

  if (state.status === 'loading') return <p className="muted">טוען…</p>;
  if (state.status === 'error') return <p className="error-text">{state.message}</p>;

  const { childName, rows } = state.data;
  if (rows.length === 0) {
    return <p className="muted">אין עדיין תוצאות עבור {childName}.</p>;
  }

  const chart = rows.map((r) => ({
    name: r.subdomainName,
    childRating: r.childRating,
    [RATING_LABELS.PRESENT]: r.distribution.PRESENT,
    [RATING_LABELS.PARTIALLY_PRESENT]: r.distribution.PARTIALLY_PRESENT,
    [RATING_LABELS.ABSENT]: r.distribution.ABSENT,
  }));

  return (
    <div className="report-body">
      <h2>{childName} — מול קבוצת הגן</h2>
      <p className="muted">
        העמודות מציגות את התפלגות הדירוג האחרון של כל ילדי הגן בכל תת-תחום. הנקודה מסמנת את הדירוג של{' '}
        {childName}.
      </p>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart} margin={{ top: 8, left: 8, right: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" stroke="var(--text)" reversed />
            <YAxis stroke="var(--text)" allowDecimals={false} orientation="right" />
            <Tooltip
              contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            />
            <Legend />
            <Bar dataKey={RATING_LABELS.PRESENT} stackId="d" fill={RATING_COLOR.PRESENT} />
            <Bar
              dataKey={RATING_LABELS.PARTIALLY_PRESENT}
              stackId="d"
              fill={RATING_COLOR.PARTIALLY_PRESENT}
            />
            <Bar dataKey={RATING_LABELS.ABSENT} stackId="d" fill={RATING_COLOR.ABSENT} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="report-table">
        <thead>
          <tr>
            <th>תת-תחום</th>
            <th>{childName}</th>
            <th>קיים</th>
            <th>קיים חלקית</th>
            <th>לא קיים</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.subdomainId}>
              <td>{r.subdomainName}</td>
              <td style={{ color: RATING_COLOR[r.childRating], fontWeight: 700 }}>
                {RATING_LABELS[r.childRating]}
              </td>
              <td>{r.distribution.PRESENT}</td>
              <td>{r.distribution.PARTIALLY_PRESENT}</td>
              <td>{r.distribution.ABSENT}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ExportButtons basePath={`/reports/children/${childId}/vs-group/export`} />
    </div>
  );
}
