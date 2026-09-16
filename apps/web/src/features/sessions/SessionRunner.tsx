import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { SessionPlanItem } from '@kga/contracts';
import {
  Badge,
  Button,
  Card,
  CheckIcon,
  Dialog,
  ErrorState,
  MinusIcon,
  Spinner,
  Toast,
  cn,
} from '@kga/ui';
import { getPlanContent } from '../../shared/api/endpoints';
import {
  useAbandonSession,
  useCompleteSession,
  useSession,
  useSkipPlanItem,
} from '../../shared/api/queries';
import { useOutbox } from '../../shared/outbox/OutboxProvider';
import { RATING_LABELS, RATING_TONE } from '../../shared/format';
import { GamePlayer, type SubdomainRunResult } from './GamePlayer';

/**
 * The assessment runner.
 *
 * Two audiences share one device here, and the screen is built around keeping
 * them apart. While a game is on, the surface is the child's: full-bleed, no
 * navigation, nothing to wander into. Between games it is the teacher's: where
 * they are in the plan, what is left, and the controls to skip, pause or finish.
 *
 * There is no exit affordance during play — leaving is a deliberate act from the
 * teacher's panel, because a child will tap anything on the screen.
 */
export function SessionRunner() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { queue, pending, syncing, flush } = useOutbox();

  const [playing, setPlaying] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const onActionError = (err: unknown, fallback: string) =>
    setToast(err instanceof Error ? err.message : fallback);

  const sessionQuery = useSession(sessionId);
  const session = sessionQuery.data;

  const planIds = useMemo(
    () => session?.plan.map((item) => item.subdomainId) ?? [],
    [session],
  );

  // One request for the whole plan, issued as soon as the session is known, so
  // the first game is already resolved when the teacher taps start.
  const contentQuery = useQuery({
    queryKey: ['plan-content', sessionId, planIds.join(',')],
    queryFn: () => getPlanContent(planIds),
    enabled: planIds.length > 0,
    staleTime: Infinity,
  });

  const completeSession = useCompleteSession();
  const abandonSession = useAbandonSession();
  const skipItem = useSkipPlanItem();

  const contentById = useMemo(
    () => new Map((contentQuery.data ?? []).map((item) => [item.id, item])),
    [contentQuery.data],
  );

  const handleComplete = useCallback(
    async (result: SubdomainRunResult) => {
      const content = contentById.get(result.subdomainId);
      if (!content || !sessionId) return;

      // Straight to the outbox: the rating is safe on the device before any
      // network call, and sync happens in the background.
      await queue({
        clientId: crypto.randomUUID(),
        sessionId,
        subdomainId: result.subdomainId,
        subdomainVersionId: content.subdomainVersionId,
        attemptsCount: result.attemptsCount,
        rating: result.rating,
        teacherNote: result.teacherNote,
        rawAnswers: result.rawAnswers,
      });

      setPlaying(null);
      void sessionQuery.refetch();
    },
    [contentById, queue, sessionId, sessionQuery],
  );

  // contentQuery is disabled while planIds is empty, so it never leaves
  // "pending" on its own — an empty plan (a session from before per-item
  // plans existed) must not be mistaken for content still loading.
  if (sessionQuery.isPending || (planIds.length > 0 && contentQuery.isPending)) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-3 text-muted-foreground">
        <Spinner className="size-5" />
        טוען אבחון…
      </div>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState
          message={
            sessionQuery.error instanceof Error ? sessionQuery.error.message : 'האבחון לא נטען'
          }
          onRetry={() => void sessionQuery.refetch()}
        />
        <Button className="mt-4" variant="outline" onClick={() => navigate('/children')}>
          חזרה לרשימת הילדים
        </Button>
      </div>
    );
  }

  // A session with no plan items predates per-item plans and can never be
  // run — without this it reads as "0 of 0 done", which the progress bar
  // and the finished-card below would otherwise show as a completed sitting.
  if (session.plan.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState message="לאבחון הזה אין תחנות מתוכננות ולא ניתן להמשיך אותו." />
        <Button className="mt-4" variant="outline" onClick={() => navigate(`/children/${session.childId}`)}>
          חזרה לפרופיל
        </Button>
      </div>
    );
  }

  /* ── The child's surface ─────────────────────────────────────────────── */
  if (playing) {
    const content = contentById.get(playing);
    if (content) {
      return (
        <GamePlayer
          key={content.id}
          subdomain={{
            id: content.id,
            name: content.name,
            teacherInstruction: content.teacherInstruction,
            childInstruction: content.childInstruction,
            gameConfig: content.gameConfig,
          }}
          onComplete={handleComplete}
        />
      );
    }
  }

  /* ── The teacher's surface ───────────────────────────────────────────── */
  const { progress } = session;
  const next = session.plan.find((item) => item.status === 'PENDING');
  const finished = progress.pending === 0;
  const closed = !!session.completedAt || !!session.abandonedAt;

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">אבחון בתהליך</p>
          <h1 className="font-display truncate text-xl font-semibold">{session.childName}</h1>
        </div>
        <Button variant="ghost" onClick={() => setConfirmExit(true)}>
          {closed ? 'סגירה' : 'יציאה'}
        </Button>
      </header>

      <Card className="p-5">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">התקדמות</span>
          <span className="tabular text-sm text-muted-foreground">
            {progress.done + progress.skipped} מתוך {progress.total}
          </span>
        </div>
        {/* Done and skipped are shown apart: a plan that was half skipped is not
            the same thing as one that was half completed. */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="bg-present transition-[width] duration-500"
            style={{ inlineSize: `${(progress.done / progress.total) * 100}%` }}
          />
          <div
            className="bg-muted-foreground/40 transition-[width] duration-500"
            style={{ inlineSize: `${(progress.skipped / progress.total) * 100}%` }}
          />
        </div>
        <p className="tabular mt-2 text-xs text-muted-foreground">
          {progress.done} הושלמו · {progress.skipped} דולגו · {progress.pending} ממתינים
        </p>
      </Card>

      {!closed && next && (
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <p className="text-sm text-muted-foreground">התחנה הבאה</p>
            <h2 className="font-display text-lg font-semibold">{next.subdomainName}</h2>
            <p className="text-sm text-muted-foreground">{next.domainName}</p>
          </div>
          <p className="rounded-lg bg-secondary/60 p-3 text-sm">
            {contentById.get(next.subdomainId)?.teacherInstruction ??
              'הוראות ההפעלה יוצגו במסך הפתיחה.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              onClick={() => setPlaying(next.subdomainId)}
              disabled={!contentById.has(next.subdomainId)}
            >
              מעבירים לילד/ה
            </Button>
            <Button
              variant="ghost"
              loading={skipItem.isPending}
              onClick={() =>
                sessionId &&
                skipItem.mutate(
                  { id: sessionId, subdomainId: next.subdomainId },
                  { onError: (err) => onActionError(err, 'הדילוג נכשל') },
                )
              }
            >
              דילוג על תחנה זו
            </Button>
          </div>
          {!contentById.has(next.subdomainId) && (
            <p className="text-sm text-destructive">
              המשחק הזה אינו זמין כרגע. דלגו עליו כדי להמשיך.
            </p>
          )}
        </Card>
      )}

      {!closed && finished && (
        <Card className="flex flex-col gap-3 p-5 text-center">
          <h2 className="font-display text-lg font-semibold">סיימתם את כל התחנות</h2>
          <p className="text-sm text-muted-foreground">
            {pending === 0
              ? 'כל התוצאות נשמרו.'
              : `${pending} תוצאות ממתינות לסנכרון${syncing ? ' (מסנכרן…)' : ''}.`}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {pending > 0 && (
              <Button variant="outline" onClick={() => void flush()}>
                סנכרון עכשיו
              </Button>
            )}
            <Button
              loading={completeSession.isPending}
              onClick={() =>
                sessionId &&
                completeSession.mutate(sessionId, {
                  onSuccess: () => navigate(`/children/${session.childId}`),
                  onError: (err) => onActionError(err, 'סיום האבחון נכשל'),
                })
              }
            >
              סיום האבחון
            </Button>
          </div>
        </Card>
      )}

      <PlanList plan={session.plan} activeId={next?.subdomainId} />

      <Dialog
        open={confirmExit}
        onClose={() => setConfirmExit(false)}
        title={closed ? 'חזרה לפרופיל' : 'יציאה מהאבחון'}
        description={
          closed
            ? undefined
            : 'התוצאות שכבר נרשמו נשמרות. התחנות שנותרו יסומנו כדילוג, כדי שהאבחון לא יישאר פתוח לנצח.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmExit(false)}>
              חזרה לאבחון
            </Button>
            {closed ? (
              <Button onClick={() => navigate(`/children/${session.childId}`)}>לפרופיל</Button>
            ) : (
              <Button
                variant="danger"
                loading={abandonSession.isPending}
                onClick={() =>
                  sessionId &&
                  abandonSession.mutate(sessionId, {
                    onSuccess: () => navigate(`/children/${session.childId}`),
                    onError: (err) => onActionError(err, 'הסיום המוקדם נכשל'),
                  })
                }
              >
                סיום מוקדם
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {progress.pending} תחנות טרם בוצעו.
        </p>
      </Dialog>

      {toast && <Toast message={toast} tone="absent" onDone={() => setToast(null)} />}
    </div>
  );
}

function PlanList({ plan, activeId }: { plan: SessionPlanItem[]; activeId?: string }) {
  return (
    <Card className="p-2">
      <ul className="flex flex-col">
        {plan.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5',
              item.subdomainId === activeId && 'bg-accent/60',
            )}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs',
                item.status === 'DONE' && 'bg-present-soft text-present',
                item.status === 'SKIPPED' && 'bg-secondary text-muted-foreground',
                item.status === 'PENDING' && 'border border-border text-muted-foreground',
              )}
            >
              {item.status === 'DONE' ? (
                <CheckIcon className="size-3.5" />
              ) : item.status === 'SKIPPED' ? (
                <MinusIcon className="size-3.5" />
              ) : (
                <span className="tabular">{item.orderIndex + 1}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.subdomainName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {item.domainName}
              </span>
            </span>
            {item.rating && (
              <Badge tone={RATING_TONE[item.rating]}>{RATING_LABELS[item.rating]}</Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
