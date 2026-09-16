import { Link } from 'react-router';
import type { AttentionItem, KindergartenSummary, OpenSession, RecentSession } from '@kga/contracts';
import {
  AlertIcon,
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  ChevronNext,
  ClockIcon,
  DomainGlyph,
  EmptyState,
  ErrorState,
  PageHeader,
  ScoreBar,
  Skeleton,
  SparkIcon,
  TrendIcon,
  UsersGroupIcon,
} from '@kga/ui';
import { useKindergartenSummary } from '../../shared/api/queries';
import { useAuth } from '../../shared/auth/AuthProvider';
import { AGE_GROUP_SHORT, relativeTime } from '../../shared/format';

/**
 * The dashboard.
 *
 * Its rule: every tile either states where the kindergarten stands or points at
 * something to do. Nothing is here for symmetry — the panel that would have been
 * a fourth decorative card is the attention list, which is the only part of this
 * screen a teacher acts on directly.
 */
export function DashboardScreen() {
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch } = useKindergartenSummary();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'בוקר טוב';
    if (hour < 17) return 'צהריים טובים';
    return 'ערב טוב';
  })();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="סקירה כללית"
        description={`${greeting}, ${user?.displayName.split(' ')[0] ?? ''} · תמונת המצב של הגן`}
      />

      {isError && (
        <ErrorState
          message={error instanceof Error ? error.message : 'לא הצלחנו לטעון את נתוני הגן'}
          onRetry={() => void refetch()}
        />
      )}

      {isPending && <DashboardSkeleton />}

      {data && (
        <>
          <StatRow summary={data} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DomainOverview domains={data.domains} />
            </div>
            <AttentionPanel attention={data.attention} notStarted={data.notStarted} />
          </div>

          {data.openSessions.length > 0 && <OpenSessionsPanel sessions={data.openSessions} />}

          <ActivityFeed sessions={data.recentSessions} />
        </>
      )}
    </div>
  );
}

function StatRow({ summary }: { summary: KindergartenSummary }) {
  const tiles = [
    {
      label: 'ילדים בגן',
      value: summary.childrenCount,
      sub: 'רשומים כעת',
      icon: <UsersGroupIcon className="size-5" />,
      tone: 'bg-secondary text-foreground',
    },
    {
      label: 'התחילו אבחון',
      value: `${summary.coveragePct}%`,
      sub: `${summary.assessedCount} מתוך ${summary.childrenCount} ילדים`,
      icon: <TrendIcon className="size-5" />,
      tone: 'bg-info-soft text-info',
    },
    {
      label: 'אבחונים השבוע',
      value: summary.sessionsThisWeek,
      sub:
        summary.openSessionCount > 0
          ? `${summary.openSessionCount} עדיין פתוחים`
          : 'אין אבחונים פתוחים',
      icon: <ClockIcon className="size-5" />,
      tone: 'bg-present-soft text-present',
    },
    {
      label: 'דורשים תשומת לב',
      value: summary.attention.length,
      sub:
        summary.attention.length > 0
          ? 'ראו את הרשימה למטה'
          : 'אין ממצאים חריגים',
      icon: <AlertIcon className="size-5" />,
      tone: summary.attention.length > 0 ? 'bg-absent-soft text-absent' : 'bg-present-soft text-present',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="flex items-center gap-4 p-4">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tile.tone}`}>
            {tile.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            <p className="font-display tabular text-2xl leading-tight font-semibold">{tile.value}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{tile.sub}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function DomainOverview({ domains }: { domains: KindergartenSummary['domains'] }) {
  const sorted = [...domains].sort((a, b) => a.scorePct - b.scorePct);

  return (
    <Card className="h-full">
      <CardHeader
        title="מוקדי התפתחות בגן"
        description="ציון ממוצע לפי תחום, מהאבחון האחרון של כל ילד. החלש ביותר למעלה."
      />
      <CardBody>
        {sorted.length === 0 ? (
          <EmptyState
            icon={<SparkIcon />}
            title="עדיין אין תוצאות"
            description="לאחר האבחון הראשון יופיע כאן פילוח לפי תחומי התפתחות."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map((domain) => (
              <div key={domain.domainId} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <DomainGlyph icon={domain.icon} className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{domain.domainName}</span>
                    <span className="tabular shrink-0 text-sm font-semibold">
                      {domain.scorePct}%
                    </span>
                  </div>
                  <ScoreBar value={domain.scorePct} label={domain.domainName} />
                  {/* A percentage from one child is not a kindergarten figure; say so. */}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {domain.childCount} ילדים · {domain.resultCount} תוצאות
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function AttentionPanel({
  attention,
  notStarted,
}: {
  attention: AttentionItem[];
  notStarted: KindergartenSummary['notStarted'];
}) {
  const reasonText = (item: AttentionItem) =>
    item.reason === 'WATCH_FLAG'
      ? 'מסומן/ת למעקב על ידי הצוות'
      : `${item.absentCount} תחומים בקושי מתוך ${item.assessedCount} שהוערכו`;

  return (
    <Card className="h-full">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <AlertIcon className="size-4 text-absent" />
            דורשים תשומת לב
          </span>
        }
        description="ילדים שסומנו למעקב, או עם דפוס חוזר של קושי"
      />
      <CardBody className="flex flex-col gap-1">
        {attention.length === 0 ? (
          <EmptyState
            icon={<SparkIcon />}
            title="הכול תקין"
            description="אין כרגע ילדים הדורשים תשומת לב מיוחדת."
            className="border-0 py-6"
          />
        ) : (
          attention.map((item) => (
            <Link
              key={item.childId}
              to={`/children/${item.childId}`}
              className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-secondary"
            >
              <Avatar name={item.childName} photoUrl={item.photoUrl} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.childName}</p>
                <p className="truncate text-xs text-muted-foreground">{reasonText(item)}</p>
              </div>
              <ChevronNext className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))
        )}

        {notStarted.length > 0 && (
          <div className="mt-2 rounded-xl bg-secondary/60 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              טרם החלו אבחון ({notStarted.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {notStarted.map((child) => (
                <Link
                  key={child.childId}
                  to={`/children/${child.childId}`}
                  className="rounded-full bg-card px-2.5 py-1 text-xs font-medium ring-1 ring-border transition-colors hover:bg-accent"
                >
                  {child.childName.split(' ')[0]} · {AGE_GROUP_SHORT[child.ageGroup]}
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Sittings started and never finished — the one dashboard panel that exists to
 * be clicked, not just read. `openSessionCount` on its own told a teacher a
 * number was wrong; this tells her which child to go back to and how far she
 * already got, so resuming is one tap instead of a trip through the roster.
 */
function OpenSessionsPanel({ sessions }: { sessions: OpenSession[] }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <ClockIcon className="size-4 text-info" />
            אבחונים פתוחים לחזרה
          </span>
        }
        description="אבחונים שהתחילו ולא הושלמו — המשיכו מהנקודה שבה עצרתם"
      />
      <CardBody className="flex flex-col gap-1">
        {sessions.map((session) => (
          <Link
            key={session.sessionId}
            to={`/run/${session.sessionId}`}
            className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-secondary"
          >
            <Avatar name={session.childName} photoUrl={session.childPhotoUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{session.childName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {session.totalCount > 0
                  ? `${session.doneCount} מתוך ${session.totalCount} הושלמו`
                  : 'טרם נרשמו תוצאות'}{' '}
                · נפתח {relativeTime(session.startedAt)}
              </p>
            </div>
            <Badge tone="info">המשך אבחון</Badge>
            <ChevronNext className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}

function ActivityFeed({ sessions }: { sessions: RecentSession[] }) {
  return (
    <Card>
      <CardHeader title="פעילות אחרונה" description="האבחונים האחרונים שבוצעו בגן" />
      <CardBody>
        {sessions.length === 0 ? (
          <EmptyState
            icon={<ClockIcon />}
            title="עדיין לא בוצעו אבחונים"
            description="האבחון הראשון שתתחילו יופיע כאן."
            className="border-0"
          />
        ) : (
          <ul className="flex flex-col">
            {sessions.map((session) => (
              <li key={session.sessionId}>
                <Link
                  to={`/children/${session.childId}`}
                  className="flex items-center gap-3 border-b border-border py-3 last:border-0"
                >
                  <Avatar
                    name={session.childName}
                    photoUrl={session.childPhotoUrl}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{session.childName}</p>
                      <Badge tone={session.completedAt ? 'present' : 'info'} dot>
                        {session.completedAt ? 'הושלם' : 'פעיל'}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {session.domainNames.length > 0
                        ? session.domainNames.join(' · ')
                        : 'טרם נרשמו תוצאות'}
                    </p>
                  </div>
                  <div className="hidden items-center gap-2.5 sm:flex">
                    <RatingTally
                      present={session.present}
                      partial={session.partial}
                      absent={session.absent}
                    />
                  </div>
                  <span className="tabular w-20 shrink-0 text-start text-xs text-muted-foreground">
                    {relativeTime(session.startedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export function RatingTally({
  present,
  partial,
  absent,
}: {
  present: number;
  partial: number;
  absent: number;
}) {
  const entries = [
    { count: present, color: 'bg-present', label: 'קיים' },
    { count: partial, color: 'bg-partial', label: 'קיים חלקית' },
    { count: absent, color: 'bg-absent', label: 'לא קיים' },
  ];
  return (
    <span className="flex items-center gap-2.5">
      {entries.map((entry) => (
        <span
          key={entry.label}
          title={entry.label}
          className="tabular flex items-center gap-1 text-xs text-muted-foreground"
        >
          <span className={`size-2.5 rounded-full ${entry.color}`} aria-hidden />
          {entry.count}
        </span>
      ))}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}
