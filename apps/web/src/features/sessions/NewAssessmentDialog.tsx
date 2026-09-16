import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { SubdomainSummary } from '@kga/contracts';
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DomainGlyph,
  ErrorState,
  Field,
  FilterChips,
  PlusIcon,
  Select,
  Skeleton,
  cn,
} from '@kga/ui';
import { useChildren, useCreateSession, useDomains, useSubdomains } from '../../shared/api/queries';
import { AGE_GROUP_LABELS, LEVEL_LABELS } from '../../shared/format';

type LevelFilter = 'ALL' | 1 | 2 | 3;

/**
 * Planning an assessment.
 *
 * The plan is chosen here and written with the session, so the runner knows what
 * it is running before it starts. The catalogue is filtered by the child's own
 * age band on the server — the dialog never sees content that does not apply to
 * them, which is what stops a teacher accidentally screening a three-year-old on
 * five-year-old material.
 */
export function NewAssessmentButton({ presetChildId }: { presetChildId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        אבחון חדש
      </Button>
      {open && (
        <NewAssessmentDialog presetChildId={presetChildId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function NewAssessmentDialog({
  presetChildId,
  onClose,
}: {
  presetChildId?: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [childId, setChildId] = useState(presetChildId ?? '');
  const [level, setLevel] = useState<LevelFilter>('ALL');
  const [excludedDomains, setExcludedDomains] = useState<Set<string>>(new Set());

  // A large roster would page here; the picker asks for a generous single page
  // and falls back to typing a name, rather than silently truncating.
  const childrenQuery = useChildren({ pageSize: 100 });
  const domainsQuery = useDomains();
  const createSession = useCreateSession();

  const child = childrenQuery.data?.items.find((item) => item.id === childId);
  const ageGroup = child?.currentAgeGroup;

  const subdomainsQuery = useSubdomains(
    { ageGroup, ...(level !== 'ALL' && { level }) },
    !!ageGroup,
  );

  // Memoised so the two derivations below have a stable dependency; `?? []`
  // inline creates a new array identity on every render.
  const available = useMemo(() => subdomainsQuery.data ?? [], [subdomainsQuery.data]);

  const byDomain = useMemo(() => {
    const groups = new Map<string, SubdomainSummary[]>();
    for (const subdomain of available) {
      if (!subdomain.playable) continue;
      const bucket = groups.get(subdomain.domainId);
      if (bucket) bucket.push(subdomain);
      else groups.set(subdomain.domainId, [subdomain]);
    }
    return groups;
  }, [available]);

  const plan = useMemo(
    () =>
      available
        .filter((subdomain) => subdomain.playable && !excludedDomains.has(subdomain.domainId))
        .map((subdomain) => subdomain.id),
    [available, excludedDomains],
  );

  const toggleDomain = (domainId: string) => {
    setExcludedDomains((previous) => {
      const next = new Set(previous);
      if (next.has(domainId)) next.delete(domainId);
      else next.add(domainId);
      return next;
    });
  };

  const start = () => {
    if (!childId || plan.length === 0) return;
    createSession.mutate(
      { childId, mode: 'ASSESSMENT', plan },
      { onSuccess: (session) => navigate(`/run/${session.id}`) },
    );
  };

  const domainsWithContent = (domainsQuery.data ?? []).filter((domain) =>
    byDomain.has(domain.id),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title="אבחון חדש"
      description="בחרו ילד/ה ואת תחומי ההערכה. המערכת מתאימה את המשחקים לקבוצת הגיל."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button
            onClick={start}
            loading={createSession.isPending}
            disabled={!childId || plan.length === 0}
          >
            התחלת האבחון
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!presetChildId && (
          <Field label="ילד/ה" htmlFor="assessment-child">
            <Select
              id="assessment-child"
              value={childId}
              onChange={(event) => setChildId(event.target.value)}
            >
              <option value="">בחרו ילד/ה מהגן</option>
              {childrenQuery.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName} · {AGE_GROUP_LABELS[item.currentAgeGroup]}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {child && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
            <Avatar name={child.displayName} photoUrl={child.photoUrl} size={40} />
            <div className="min-w-0">
              <p className="font-medium">{child.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {AGE_GROUP_LABELS[child.currentAgeGroup]} · הוערכו {child.assessedCount} מתוך{' '}
                {child.applicableCount}
              </p>
            </div>
          </div>
        )}

        {child && (
          <Field
            label="רמת קושי"
            hint="תוכן שטרם דורג מופיע כרמה בסיסית עד שעורכת התוכן מדרגת אותו."
          >
            <FilterChips
              value={level}
              onChange={setLevel}
              options={[
                { value: 'ALL' as LevelFilter, label: 'כל הרמות' },
                { value: 1 as LevelFilter, label: LEVEL_LABELS[1] },
                { value: 2 as LevelFilter, label: LEVEL_LABELS[2] },
                { value: 3 as LevelFilter, label: LEVEL_LABELS[3] },
              ]}
            />
          </Field>
        )}

        {child && subdomainsQuery.isPending && <Skeleton className="h-24 rounded-xl" />}

        {child && subdomainsQuery.isError && (
          <ErrorState
            message="קטלוג התוכן לא נטען"
            onRetry={() => void subdomainsQuery.refetch()}
          />
        )}

        {child && subdomainsQuery.data && (
          <Field label="תחומי הערכה">
            {domainsWithContent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                אין תוכן זמין לקבוצת הגיל הזו ברמה שנבחרה.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {domainsWithContent.map((domain) => {
                    const included = !excludedDomains.has(domain.id);
                    const count = byDomain.get(domain.id)?.length ?? 0;
                    return (
                      <button
                        key={domain.id}
                        type="button"
                        aria-pressed={included}
                        onClick={() => toggleDomain(domain.id)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                          included
                            ? 'border-primary/30 bg-accent text-accent-foreground'
                            : 'border-border bg-card text-muted-foreground hover:bg-secondary',
                        )}
                      >
                        <DomainGlyph icon={domain.icon} className="size-4" />
                        {domain.name}
                        <Badge tone="neutral" className="px-1.5 py-0">
                          {count}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
                <p className="tabular text-sm text-muted-foreground">
                  {plan.length} משחקים ייכללו באבחון
                </p>
              </div>
            )}
          </Field>
        )}

        {createSession.isError && (
          <ErrorState
            message={
              createSession.error instanceof Error
                ? createSession.error.message
                : 'פתיחת האבחון נכשלה'
            }
          />
        )}
      </div>
    </Dialog>
  );
}
