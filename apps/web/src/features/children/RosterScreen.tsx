import { useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { AgeGroup, ChildListItem, ChildStatus } from '@kga/contracts';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChevronNext,
  ChildrenIcon,
  EmptyState,
  ErrorState,
  FilterChips,
  FlagIcon,
  PageHeader,
  PlusIcon,
  ScoreBar,
  SearchInput,
  Skeleton,
  Td,
  Th,
  TableScroller,
  Toast,
  cn,
} from '@kga/ui';
import { listSubdomains } from '../../shared/api/endpoints';
import { queryKeys, useChildren, useCreateSession, useToggleWatch } from '../../shared/api/queries';
import { useDebounced } from '../../shared/use-debounced';
import {
  AGE_GROUP_SHORT,
  STATUS_LABELS,
  STATUS_TONE,
  ageLabel,
  relativeTime,
} from '../../shared/format';
import { ChildDialog } from './ChildDialog';

type AgeFilter = 'ALL' | AgeGroup;
type StatusFilter = 'ALL' | ChildStatus;

const AGE_FILTERS: { value: AgeFilter; label: string }[] = [
  { value: 'ALL', label: 'כל הגילאים' },
  { value: 'AGE_3_4', label: '3–4' },
  { value: 'AGE_4_5', label: '4–5' },
  { value: 'AGE_5_6', label: '5–6' },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'הכול' },
  { value: 'NEEDS_ATTENTION', label: 'דורשים תשומת לב' },
  { value: 'IN_PROGRESS', label: 'אבחון פעיל' },
  { value: 'NOT_STARTED', label: 'טרם החלו' },
  { value: 'ON_TRACK', label: 'מתקדמים יפה' },
];

/**
 * The roster.
 *
 * Filtering and paging happen on the server; this screen holds only the filter
 * values themselves. Each row shows where the child stands, because a list of
 * names with no state is a list a teacher has to open one by one to use.
 */
export function RosterScreen() {
  const [search, setSearch] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ChildListItem | 'new' | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'absent' } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [planning, setPlanning] = useState(false);

  const debouncedSearch = useDebounced(search, 250);
  const query = {
    search: debouncedSearch || undefined,
    ageGroup: ageGroup === 'ALL' ? undefined : ageGroup,
    status: status === 'ALL' ? undefined : status,
    page,
    pageSize: 25,
  };

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useChildren(query);
  const toggleWatch = useToggleWatch();
  const createSession = useCreateSession();
  const queryClient = useQueryClient();

  // A child with an open sitting already has somewhere to resume — offering to
  // plan a second one on top of it would just leave two open at once.
  const selectable = (child: ChildListItem) => !child.openSessionId;
  const selectableOnPage = (data?.items ?? []).filter(selectable);
  const allOnPageSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((child) => selected.has(child.id));

  const toggleSelected = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    setSelected((previous) => {
      if (allOnPageSelected) {
        const next = new Set(previous);
        for (const child of selectableOnPage) next.delete(child.id);
        return next;
      }
      const next = new Set(previous);
      for (const child of selectableOnPage) next.add(child.id);
      return next;
    });
  };

  /**
   * Plans a full assessment (every playable subdomain for the child's age
   * band, the same default `NewAssessmentDialog` starts from) for every
   * selected child, without opening the runner for any of them — the point is
   * to queue a class's worth of sittings up front, then work through them one
   * at a time from the dashboard's open-sessions list.
   */
  const planSelected = async () => {
    const targets = (data?.items ?? []).filter((child) => selected.has(child.id));
    if (targets.length === 0) return;
    setPlanning(true);

    let created = 0;
    let skipped = 0;
    try {
      for (const child of targets) {
        const subdomains = await queryClient.fetchQuery({
          queryKey: queryKeys.subdomains({ ageGroup: child.currentAgeGroup }),
          queryFn: () => listSubdomains({ ageGroup: child.currentAgeGroup }),
          staleTime: 10 * 60_000,
        });
        const plan = subdomains.filter((s) => s.playable).map((s) => s.id);
        if (plan.length === 0) {
          skipped += 1;
          continue;
        }
        await createSession.mutateAsync({ childId: child.id, mode: 'ASSESSMENT', plan });
        created += 1;
      }
    } finally {
      setPlanning(false);
      setSelected(new Set());
      setToast({
        message:
          skipped === 0
            ? `נפתחו ${created} אבחונים חדשים`
            : `נפתחו ${created} אבחונים · ${skipped} דולגו (אין תוכן לקבוצת הגיל)`,
        tone: 'neutral',
      });
    }
  };

  const resetTo = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = debouncedSearch !== '' || ageGroup !== 'ALL' || status !== 'ALL';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="ילדי הגן"
        description={
          data ? `${data.total} ילדים רשומים` : 'ניהול פרופילים, מעקב והתחלת אבחון'
        }
        actions={
          <Button onClick={() => setDialog('new')}>
            <PlusIcon className="size-4" />
            הוספת ילד/ה
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            className="min-w-56 flex-1 sm:max-w-xs"
            placeholder="חיפוש לפי שם…"
            value={search}
            onChange={(event) => resetTo(setSearch)(event.target.value)}
            aria-label="חיפוש ילד/ה"
          />
          <FilterChips options={AGE_FILTERS} value={ageGroup} onChange={resetTo(setAgeGroup)} />
        </div>
        <FilterChips options={STATUS_FILTERS} value={status} onChange={resetTo(setStatus)} />
      </div>

      {selected.size > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-sm font-medium">{selected.size} ילדים נבחרו</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              ביטול הבחירה
            </Button>
            <Button size="sm" loading={planning} onClick={() => void planSelected()}>
              תכנון אבחון לילדים שנבחרו
            </Button>
          </div>
        </Card>
      )}

      {isError && (
        <ErrorState
          message={error instanceof Error ? error.message : 'טעינת הרשימה נכשלה'}
          onRetry={() => void refetch()}
        />
      )}

      {isPending && <RosterSkeleton />}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={<ChildrenIcon />}
          title={filtered ? 'לא נמצאו ילדים תואמים' : 'אין עדיין ילדים בגן'}
          description={
            filtered
              ? 'נסו לשנות את החיפוש או את הסינון.'
              : 'הוסיפו את הילד/ה הראשון/ה כדי להתחיל.'
          }
          action={
            !filtered && (
              <Button onClick={() => setDialog('new')}>
                <PlusIcon className="size-4" />
                הוספת ילד/ה
              </Button>
            )
          }
        />
      )}

      {data && data.items.length > 0 && (
        <Card className={cn('overflow-hidden p-1', isPlaceholderData && 'opacity-60')}>
          <TableScroller>
            <thead>
              <tr>
                <Th className="w-10">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={allOnPageSelected}
                    disabled={selectableOnPage.length === 0}
                    onChange={toggleSelectPage}
                    aria-label="בחירת כל הילדים בעמוד"
                  />
                </Th>
                <Th>ילד/ה</Th>
                <Th>גיל</Th>
                <Th>סטטוס</Th>
                <Th className="w-48">כיסוי האבחון</Th>
                <Th>אבחון אחרון</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((child) => (
                <tr key={child.id} className="transition-colors hover:bg-secondary/60">
                  <Td>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.has(child.id)}
                      disabled={!selectable(child)}
                      title={!selectable(child) ? 'יש כבר אבחון פתוח לילד/ה זה/זו' : undefined}
                      onChange={() => toggleSelected(child.id)}
                      aria-label={`בחירת ${child.displayName}`}
                    />
                  </Td>
                  <Td>
                    <Link
                      to={`/children/${child.id}`}
                      className="flex items-center gap-3 font-medium"
                    >
                      <Avatar name={child.displayName} photoUrl={child.photoUrl} size={36} />
                      <span className="flex items-center gap-1.5">
                        {child.displayName}
                        {child.watch && (
                          <FlagIcon
                            className="size-3.5 text-absent"
                            aria-label="מסומן/ת למעקב"
                          />
                        )}
                      </span>
                    </Link>
                  </Td>
                  <Td className="tabular whitespace-nowrap text-muted-foreground">
                    {ageLabel(child.birthDate)} · {AGE_GROUP_SHORT[child.currentAgeGroup]}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[child.status]} dot>
                      {STATUS_LABELS[child.status]}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ScoreBar
                        value={child.coveragePct}
                        className="w-24"
                        label={`כיסוי ${child.coveragePct}%`}
                      />
                      <span className="tabular text-xs whitespace-nowrap text-muted-foreground">
                        {child.assessedCount}/{child.applicableCount}
                      </span>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {child.lastSessionAt ? relativeTime(child.lastSessionAt) : '—'}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title={child.watch ? 'ביטול סימון למעקב' : 'סימון למעקב'}
                        aria-label={child.watch ? 'ביטול סימון למעקב' : 'סימון למעקב'}
                        disabled={toggleWatch.isPending}
                        onClick={() => {
                          toggleWatch.mutate(
                            { id: child.id, watch: !child.watch },
                            {
                              onSuccess: () =>
                                setToast({
                                  message: child.watch
                                    ? `${child.displayName} הוסר/ה מהמעקב`
                                    : `${child.displayName} סומן/ה למעקב`,
                                  tone: 'neutral',
                                }),
                              onError: (err) =>
                                setToast({
                                  message: err instanceof Error ? err.message : 'העדכון נכשל',
                                  tone: 'absent',
                                }),
                            },
                          );
                        }}
                        className={cn(
                          'rounded-md p-1.5 transition-colors',
                          child.watch
                            ? 'text-absent hover:bg-absent-soft'
                            : 'text-muted-foreground hover:bg-secondary',
                        )}
                      >
                        <FlagIcon className="size-4" />
                      </button>
                      <Link
                        to={`/children/${child.id}`}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
                        aria-label={`פתיחת הפרופיל של ${child.displayName}`}
                      >
                        <ChevronNext className="size-4" />
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableScroller>
        </Card>
      )}

      {data && pageCount > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="tabular text-sm text-muted-foreground">
            עמוד {data.page} מתוך {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              הקודם
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              הבא
            </Button>
          </div>
        </div>
      )}

      {dialog && (
        <ChildDialog
          child={dialog === 'new' ? null : dialog}
          onClose={() => setDialog(null)}
          onSaved={(name, created) => {
            setDialog(null);
            setToast({ message: created ? `${name} נוסף/ה בהצלחה` : 'העדכון נשמר', tone: 'neutral' });
          }}
        />
      )}

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />
      )}
    </div>
  );
}

function RosterSkeleton() {
  return (
    <Card className="flex flex-col gap-2 p-4">
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </Card>
  );
}
