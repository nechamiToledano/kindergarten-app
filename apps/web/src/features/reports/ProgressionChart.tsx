import { useMemo } from 'react';
import type { ChildProgression } from '@kga/contracts';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, Card, CardBody, CardHeader, EmptyState, TrendIcon, Td, Th, TableScroller } from '@kga/ui';
import { RATING_LABELS, RATING_TONE, formatShortDate, formatDate } from '../../shared/format';

/**
 * Progression over time.
 *
 * Two readings of the same data, because they answer different questions. The
 * line answers "is this child moving?", which is the first thing a teacher wants
 * and the hardest to see in a table. The matrix answers "where, exactly?" — and
 * it keeps the raw ratings visible, because a trend line built from a
 * three-point ordinal scale can flatter or flatten a real finding.
 */
export function ProgressionChart({ data }: { data: ChildProgression }) {
  const matrix = useMemo(() => {
    const bySubdomain = new Map<
      string,
      { name: string; domainName: string; points: ChildProgression['points'] }
    >();
    for (const point of data.points) {
      const entry = bySubdomain.get(point.subdomainId);
      if (entry) entry.points.push(point);
      else
        bySubdomain.set(point.subdomainId, {
          name: point.subdomainName,
          domainName: point.domainName,
          points: [point],
        });
    }
    return [...bySubdomain.entries()]
      .map(([id, entry]) => ({ id, ...entry }))
      .sort(
        (a, b) =>
          a.domainName.localeCompare(b.domainName, 'he') || a.name.localeCompare(b.name, 'he'),
      );
  }, [data.points]);

  if (data.points.length === 0) {
    return (
      <EmptyState
        icon={<TrendIcon />}
        title="אין עדיין נתוני התקדמות"
        description="לאחר האבחון השני יופיע כאן מעקב לאורך זמן."
      />
    );
  }

  const chartData = data.sessionScores.map((score) => ({
    ...score,
    label: formatShortDate(score.startedAt),
  }));

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="מגמה כללית"
          description="ציון ממוצע בכל אבחון. 100 = כל התוצאות ״קיים״."
        />
        <CardBody>
          {chartData.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              דרושים לפחות שני אבחונים כדי להציג מגמה. כרגע יש {chartData.length}.
            </p>
          ) : (
            <div className="h-56 w-full" dir="ltr">
              {/* The chart itself is LTR: recharts lays its axes out physically,
                  and forcing RTL here reverses the time axis so the most recent
                  session appears first. The labels are Hebrew either way. */}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    width={34}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 12,
                      direction: 'rtl',
                      fontSize: 13,
                    }}
                    formatter={(value) => [`${value as number}%`, 'ציון']}
                    labelFormatter={(_, payload) =>
                      payload?.[0] ? formatDate(payload[0].payload.startedAt) : ''
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="scorePct"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: 'var(--color-chart-1)' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden p-1">
        <CardHeader
          title="פירוט לפי תת-תחום"
          description="כל תוצאה שנרשמה, מהישנה לחדשה"
          className="px-4"
        />
        <TableScroller>
          <thead>
            <tr>
              <Th>תת-תחום</Th>
              <Th>תחום</Th>
              <Th>תוצאות</Th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.id}>
                <Td className="font-medium">{row.name}</Td>
                <Td className="text-muted-foreground">{row.domainName}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1.5">
                    {row.points.map((point) => (
                      <Badge
                        key={point.sessionId + point.subdomainVersionId}
                        tone={RATING_TONE[point.rating]}
                        className="gap-1"
                      >
                        {RATING_LABELS[point.rating]}
                        <span className="opacity-60">{formatShortDate(point.startedAt)}</span>
                      </Badge>
                    ))}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableScroller>
      </Card>
    </div>
  );
}
