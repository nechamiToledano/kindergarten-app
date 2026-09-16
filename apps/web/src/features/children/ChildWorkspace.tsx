import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { ChildOverview } from '@kga/contracts';
import {
  AlertIcon,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckIcon,
  ChevronNext,
  ClockIcon,
  DomainGlyph,
  EmptyState,
  ErrorState,
  FlagIcon,
  PlayIcon,
  ProgressRing,
  ScoreBar,
  Skeleton,
  SparkIcon,
  Tabs,
  buttonClass,
  cn,
} from '@kga/ui';
import { useChildOverview, useProgression, useToggleWatch } from '../../shared/api/queries';
import {
  AGE_GROUP_LABELS,
  RATING_LABELS,
  RATING_TONE,
  STATUS_LABELS,
  STATUS_TONE,
  ageLabel,
  formatDate,
  relativeTime,
} from '../../shared/format';
import { RatingTally } from '../dashboard/DashboardScreen';
import { NewAssessmentButton } from '../sessions/NewAssessmentDialog';
import { ChildDialog } from './ChildDialog';
import { ProgressionChart } from '../reports/LazyProgressionChart';

type WorkspaceTab = 'overview' | 'progress' | 'sessions';

/**
 * The child workspace.
 *
 * This screen did not exist: a teacher could start an assessment for a child and
 * read a report about them, but there was nowhere that answered "how is this
 * child doing?" in one place. It is the centre of the product now, and the
 * destination of every child link elsewhere in the app.
 *
 * Everything on it comes from a single overview request; the progress tab adds
 * one more only when it is opened.
 */
export function ChildWorkspace() {
  const { childId } = useParams<{ childId: string }>();
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [editing, setEditing] = useState(false);
  const { data, isPending, isError, error, refetch } = useChildOverview(childId);
  const toggleWatch = useToggleWatch();

  if (isPending) return <WorkspaceSkeleton />;

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'הפרופיל לא נטען'}
        onRetry={() => void refetch()}
      />
    );
  }

  const { child } = data;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="מיקום" className="text-sm text-muted-foreground">
        <Link to="/children" className="hover:text-foreground">
          ילדי הגן
        </Link>
        <ChevronNext className="mx-1 inline size-3.5 align-[-2px]" />
        <span className="text-foreground">{child.displayName}</span>
      </nav>

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Avatar name={child.displayName} photoUrl={child.photoUrl} size={64} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-semibold">{child.displayName}</h1>
            <Badge tone={STATUS_TONE[child.status]} dot>
              {STATUS_LABELS[child.status]}
            </Badge>
            {child.watch && (
              <Badge tone="absent">
                <FlagIcon className="size-3" />
                במעקב
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            בן/בת {ageLabel(child.birthDate)} · {AGE_GROUP_LABELS[child.currentAgeGroup]} ·
            נולד/ה ב־{formatDate(child.birthDate)}
          </p>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-center">
            <ProgressRing percent={child.coveragePct} size={58} label="כיסוי האבחון" />
            <p className="mt-1 text-xs text-muted-foreground">כיסוי</p>
          </div>
          <div className="text-center">
            <ProgressRing percent={child.scorePct} size={58} label="ציון ממוצע" />
            <p className="mt-1 text-xs text-muted-foreground">ציון</p>
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <NewAssessmentButton presetChildId={child.id} />
          {child.openSessionId && (
            <Link to={`/run/${child.openSessionId}`} className={buttonClass('outline')}>
              <PlayIcon className="size-4" />
              המשך אבחון פתוח
            </Link>
          )}
          <Button variant="ghost" onClick={() => setEditing(true)}>
            עריכת פרופיל
          </Button>
          <Button
            variant="ghost"
            loading={toggleWatch.isPending}
            onClick={() => toggleWatch.mutate({ id: child.id, watch: !child.watch })}
          >
            <FlagIcon className={cn('size-4', child.watch && 'text-absent')} />
            {child.watch ? 'הסרה מהמעקב' : 'סימון למעקב'}
          </Button>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'תמונת מצב' },
          { value: 'progress', label: 'התקדמות לאורך זמן' },
          { value: 'sessions', label: 'היסטוריית אבחונים', count: data.recentSessions.length },
        ]}
      />

      {tab === 'overview' && <OverviewTab data={data} />}
      {tab === 'progress' && <ProgressTab childId={child.id} />}
      {tab === 'sessions' && <SessionsTab data={data} />}

      {editing && (
        <ChildDialog child={child} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: ChildOverview }) {
  const assessed = data.domains.filter((domain) => domain.assessed > 0);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="עמידה לפי תחום"
          description="על בסיס התוצאה האחרונה בכל תת-תחום, מול התוכן המתאים לקבוצת הגיל"
        />
        <CardBody>
          {assessed.length === 0 ? (
            <EmptyState
              icon={<SparkIcon />}
              title="טרם בוצע אבחון"
              description="לאחר האבחון הראשון תופיע כאן תמונת מצב לפי תחומי התפתחות."
              className="border-0"
            />
          ) : (
            <div className="flex flex-col gap-4">
              {data.domains.map((domain) => (
                <div key={domain.domainId} className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <DomainGlyph icon={domain.icon} className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{domain.domainName}</span>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {domain.assessed > 0 ? `${domain.scorePct}%` : 'טרם הוערך'}
                      </span>
                    </div>
                    {domain.assessed > 0 ? (
                      <ScoreBar value={domain.scorePct} label={domain.domainName} />
                    ) : (
                      <div className="h-2 w-full rounded-full bg-secondary" />
                    )}
                    <p className="tabular mt-1 text-xs text-muted-foreground">
                      {domain.assessed} מתוך {domain.applicable} תת-תחומים
                      {domain.assessed > 0 && (
                        <>
                          {' · '}
                          <RatingTally
                            present={domain.present}
                            partial={domain.partial}
                            absent={domain.absent}
                          />
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <CheckIcon className="size-4 text-present" />
                חוזקות
              </span>
            }
          />
          <CardBody>
            {data.strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">טרם נרשמו תוצאות "קיים".</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.strengths.map((item) => (
                  <li key={item.subdomainId} className="text-sm">
                    <span className="font-medium">{item.subdomainName}</span>
                    <span className="text-muted-foreground"> · {item.domainName}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <AlertIcon className="size-4 text-absent" />
                פערים לתשומת לב
              </span>
            }
          />
          <CardBody>
            {data.gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין כרגע פערים שנרשמו.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.gaps.map((item) => (
                  <li key={item.subdomainId} className="flex items-center gap-2 text-sm">
                    <Badge tone={RATING_TONE[item.rating]}>{RATING_LABELS[item.rating]}</Badge>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{item.subdomainName}</span>
                      <span className="text-muted-foreground"> · {item.domainName}</span>
                    </span>
                    <span
                      className="shrink-0 text-xs text-muted-foreground"
                      title={formatDate(item.at)}
                    >
                      {relativeTime(item.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ProgressTab({ childId }: { childId: string }) {
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

  return <ProgressionChart data={data} />;
}

function SessionsTab({ data }: { data: ChildOverview }) {
  if (data.recentSessions.length === 0) {
    return (
      <EmptyState
        icon={<ClockIcon />}
        title="עדיין לא בוצעו אבחונים"
        description="כאן תופיע היסטוריית הסשנים של הילד/ה."
      />
    );
  }

  return (
    <Card>
      <CardBody className="pt-5">
        <ul className="flex flex-col">
          {data.recentSessions.map((session) => {
            const state = session.completedAt
              ? { tone: 'present' as const, label: 'הושלם' }
              : session.abandonedAt
                ? { tone: 'neutral' as const, label: 'הופסק' }
                : { tone: 'info' as const, label: 'פעיל' };

            return (
              <li
                key={session.sessionId}
                className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0"
              >
                <div className="min-w-40 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" title={formatDate(session.startedAt)}>
                      {formatDate(session.startedAt)}
                    </span>
                    <Badge tone={state.tone} dot>
                      {state.label}
                    </Badge>
                    {session.mode === 'PRACTICE' && <Badge tone="neutral">תרגול</Badge>}
                  </div>
                  <p className="tabular mt-0.5 text-xs text-muted-foreground">
                    {session.done} מתוך {session.total} תת-תחומים
                  </p>
                </div>
                <RatingTally
                  present={session.present}
                  partial={session.partial}
                  absent={session.absent}
                />
                {!session.completedAt && !session.abandonedAt && (
                  <Link
                    to={`/run/${session.sessionId}`}
                    className={buttonClass('outline', 'sm')}
                  >
                    <PlayIcon className="size-4" />
                    המשך
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-10 w-72 rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
