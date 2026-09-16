import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  ReportsIcon,
  ScoreBar,
  Select,
  Skeleton,
  Tabs,
  Td,
  Th,
  TableScroller,
} from '@kga/ui';
import {
  useChildren,
  usePatterns,
  useProgression,
  useReportSubdomains,
  useVsGroup,
} from '../../shared/api/queries';
import { downloadExport } from '../../shared/api/endpoints';
import {
  AGE_GROUP_LABELS,
  RATING_LABELS,
  RATING_TONE,
} from '../../shared/format';
import { ProgressionChart } from './LazyProgressionChart';

type ReportView = 'progression' | 'vsGroup' | 'patterns';

export function ReportsScreen() {
  const [view, setView] = useState<ReportView>('progression');
  const [childId, setChildId] = useState<string>('');
  const childrenQuery = useChildren({ pageSize: 100 });

  useEffect(() => {
    if (!childId && childrenQuery.data?.items.length) {
      setChildId(childrenQuery.data.items[0].id);
    }
  }, [childId, childrenQuery.data]);

  const needsChild = view !== 'patterns';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="דוחות ותובנות"
        description="מעקב אישי, השוואה לקבוצת הגיל, ותמונת מצב של הגן"
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: 'progression', label: 'התקדמות ילד/ה' },
            { value: 'vsGroup', label: 'מול קבוצת הגיל' },
            { value: 'patterns', label: 'קיבוץ הגן' },
          ]}
        />

        {needsChild && (
          <div className="min-w-56">
            <Field label="ילד/ה" htmlFor="report-child">
              <Select
                id="report-child"
                value={childId}
                onChange={(event) => setChildId(event.target.value)}
              >
                {childrenQuery.data?.items.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.displayName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </div>

      {needsChild && childrenQuery.data?.items.length === 0 && (
        <EmptyState
          icon={<ReportsIcon />}
          title="אין ילדים רשומים"
          description="הוסיפו ילדים לגן כדי להפיק דוחות."
        />
      )}

      {view === 'progression' && childId && <ProgressionReport childId={childId} />}
      {view === 'vsGroup' && childId && <VsGroupReport childId={childId} />}
      {view === 'patterns' && <PatternsReport />}
    </div>
  );
}

function ExportRow({ basePath }: { basePath: string }) {
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (format: 'pdf' | 'xlsx') => {
    setBusy(format);
    setError(null);
    try {
      await downloadExport(basePath, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'הייצוא נכשל');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" loading={busy === 'pdf'} onClick={() => void run('pdf')}>
        ייצוא PDF
      </Button>
      <Button size="sm" variant="outline" loading={busy === 'xlsx'} onClick={() => void run('xlsx')}>
        ייצוא Excel
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}

function ProgressionReport({ childId }: { childId: string }) {
  const { data, isPending, isError, error, refetch } = useProgression(childId);

  if (isPending) return <Skeleton className="h-72 rounded-xl" />;
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'הדוח לא נטען'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ExportRow basePath={`/reports/children/${childId}/progression/export`} />
      </div>
      <ProgressionChart data={data} />
    </div>
  );
}

function VsGroupReport({ childId }: { childId: string }) {
  const { data, isPending, isError, error, refetch } = useVsGroup(childId);

  if (isPending) return <Skeleton className="h-72 rounded-xl" />;
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'הדוח לא נטען'}
        onRetry={() => void refetch()}
      />
    );
  }

  if (data.rows.length === 0) {
    return (
      <EmptyState
        icon={<ReportsIcon />}
        title="אין עדיין תוצאות להשוואה"
        description="לאחר האבחון הראשון תופיע כאן השוואה לקבוצת הגיל."
      />
    );
  }

  return (
    <Card className="overflow-hidden p-1">
      <CardHeader
        title={`${data.childName} מול ${AGE_GROUP_LABELS[data.ageGroup]}`}
        description="ההשוואה היא לילדים בקבוצת הגיל של הילד/ה בלבד, לא לכל הגן"
        actions={<ExportRow basePath={`/reports/children/${childId}/vs-group/export`} />}
        className="px-4"
      />
      <TableScroller>
        <thead>
          <tr>
            <Th>תת-תחום</Th>
            <Th>תחום</Th>
            <Th>התוצאה</Th>
            <Th className="w-44">מול הקבוצה</Th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.subdomainId}>
              <Td className="font-medium">{row.subdomainName}</Td>
              <Td className="text-muted-foreground">{row.domainName}</Td>
              <Td>
                <Badge tone={RATING_TONE[row.childRating]}>
                  {RATING_LABELS[row.childRating]}
                </Badge>
              </Td>
              <Td>
                <div className="flex flex-col gap-1">
                  <ScoreBar value={row.cohortScorePct} />
                  {/* A cohort average over one other child is not an average;
                      the size is shown so the number can be read honestly. */}
                  <span className="tabular text-xs text-muted-foreground">
                    ממוצע הקבוצה {row.cohortScorePct}% · {row.cohortSize} ילדים
                  </span>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableScroller>
    </Card>
  );
}

function PatternsReport() {
  const [subdomainId, setSubdomainId] = useState<string>('');
  const listQuery = useReportSubdomains();
  const { data, isPending, isError, error, refetch } = usePatterns(subdomainId || undefined);

  useEffect(() => {
    if (!subdomainId && listQuery.data?.length) {
      setSubdomainId(listQuery.data[0].subdomainId);
    }
  }, [subdomainId, listQuery.data]);

  if (listQuery.isPending) return <Skeleton className="h-72 rounded-xl" />;

  if (!listQuery.data?.length) {
    return (
      <EmptyState
        icon={<ReportsIcon />}
        title="עדיין אין תוצאות בגן"
        description="הדוח הזה מקבץ ילדים לפי תת-תחום, אחרי שנאספו תוצאות."
      />
    );
  }

  const groups = data
    ? [
        { key: 'strong', label: 'שולטים', tone: 'present' as const, children: data.strong },
        { key: 'partial', label: 'בתהליך', tone: 'partial' as const, children: data.partial },
        {
          key: 'needsSupport',
          label: 'זקוקים לתמיכה',
          tone: 'absent' as const,
          children: data.needsSupport,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-64">
          <Field label="תת-תחום" htmlFor="patterns-subdomain">
            <Select
              id="patterns-subdomain"
              value={subdomainId}
              onChange={(event) => setSubdomainId(event.target.value)}
            >
              {listQuery.data.map((item) => (
                <option key={item.subdomainId} value={item.subdomainId}>
                  {item.domainName} · {item.subdomainName} ({item.resultCount})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {subdomainId && (
          <ExportRow basePath={`/reports/subdomains/${subdomainId}/patterns/export`} />
        )}
      </div>

      {isError && (
        <ErrorState
          message={error instanceof Error ? error.message : 'הדוח לא נטען'}
          onRetry={() => void refetch()}
        />
      )}

      {isPending && subdomainId && <Skeleton className="h-56 rounded-xl" />}

      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.key}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {group.label}
                    <Badge tone={group.tone}>{group.children.length}</Badge>
                  </span>
                }
              />
              <CardBody>
                {group.children.length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין ילדים בקבוצה זו.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {group.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          to={`/children/${child.id}`}
                          className="flex items-center gap-2.5 rounded-lg p-1.5 text-sm transition-colors hover:bg-secondary"
                        >
                          <Avatar name={child.displayName} size={28} />
                          {child.displayName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
