import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { AgeGroup, SubdomainLevel } from '@kga/contracts';
import {
  Badge,
  Button,
  Card,
  DomainGlyph,
  EmptyState,
  ErrorState,
  FilterChips,
  LibraryIcon,
  PageHeader,
  PlayIcon,
  SearchInput,
  Skeleton,
  Td,
  Th,
  TableScroller,
} from '@kga/ui';
import { useDomains, useSubdomains } from '../../shared/api/queries';
import { useDebounced } from '../../shared/use-debounced';
import { AGE_GROUP_SHORT, GAME_TYPE_LABELS, LEVEL_LABELS } from '../../shared/format';

type AgeFilter = 'ALL' | AgeGroup;
type LevelFilter = 'ALL' | SubdomainLevel;

/**
 * The content catalogue, as the teacher sees it.
 *
 * Read-only here on purpose: authoring lives in the content-editor app, and a
 * teacher's question is "what will this child actually be asked to do", not "how
 * do I change it". It reads the same rows the runner plays, so what is listed is
 * what exists.
 */
export function LibraryScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeFilter>('ALL');
  const [level, setLevel] = useState<LevelFilter>('ALL');
  const [domainId, setDomainId] = useState<'ALL' | string>('ALL');

  const debouncedSearch = useDebounced(search, 250);
  const domainsQuery = useDomains();
  const { data, isPending, isError, error, refetch } = useSubdomains({
    search: debouncedSearch || undefined,
    ageGroup: ageGroup === 'ALL' ? undefined : ageGroup,
    level: level === 'ALL' ? undefined : level,
    domainId: domainId === 'ALL' ? undefined : domainId,
  });

  const domainOptions = [
    { value: 'ALL', label: 'כל התחומים' },
    ...(domainsQuery.data ?? []).map((domain) => ({ value: domain.id, label: domain.name })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="ספריית המשחקים"
        description={
          data
            ? `${data.length} תת-תחומים בקטלוג`
            : 'התוכן שממנו נבנים האבחונים, לפי תחום, גיל ורמה'
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            className="min-w-56 flex-1 sm:max-w-xs"
            placeholder="חיפוש משחק…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="חיפוש בקטלוג"
          />
          <FilterChips
            value={ageGroup}
            onChange={setAgeGroup}
            options={[
              { value: 'ALL' as AgeFilter, label: 'כל הגילאים' },
              { value: 'AGE_3_4' as AgeFilter, label: '3–4' },
              { value: 'AGE_4_5' as AgeFilter, label: '4–5' },
              { value: 'AGE_5_6' as AgeFilter, label: '5–6' },
            ]}
          />
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
        </div>
        <FilterChips value={domainId} onChange={setDomainId} options={domainOptions} />
      </div>

      {isError && (
        <ErrorState
          message={error instanceof Error ? error.message : 'הקטלוג לא נטען'}
          onRetry={() => void refetch()}
        />
      )}

      {isPending && <Skeleton className="h-64 rounded-xl" />}

      {data && data.length === 0 && (
        <EmptyState
          icon={<LibraryIcon />}
          title="לא נמצאו משחקים תואמים"
          description="נסו לשנות את הסינון או את החיפוש."
        />
      )}

      {data && data.length > 0 && (
        <Card className="overflow-hidden p-1">
          <TableScroller>
            <thead>
              <tr>
                <Th>משחק</Th>
                <Th>תחום</Th>
                <Th>גילאים</Th>
                <Th>רמה</Th>
                <Th>סוג משחק</Th>
                <Th>מצב</Th>
                <Th>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((subdomain) => (
                <tr key={subdomain.id} className="transition-colors hover:bg-secondary/60">
                  <Td className="font-medium">{subdomain.name}</Td>
                  <Td>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <DomainGlyph
                        icon={domainsQuery.data?.find((d) => d.id === subdomain.domainId)?.icon}
                        className="size-4"
                      />
                      {subdomain.domainName}
                    </span>
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {subdomain.ageGroups.map((group) => (
                        <Badge key={group} tone="neutral">
                          {AGE_GROUP_SHORT[group]}
                        </Badge>
                      ))}
                    </span>
                  </Td>
                  <Td className="text-muted-foreground">{LEVEL_LABELS[subdomain.level]}</Td>
                  <Td className="text-muted-foreground">
                    {GAME_TYPE_LABELS[subdomain.gameType] ?? subdomain.gameType}
                  </Td>
                  <Td>
                    {/* A subdomain without a published version cannot be played;
                        the catalogue says so rather than letting an assessment
                        dead-end on it. */}
                    <Badge tone={subdomain.playable ? 'present' : 'neutral'} dot>
                      {subdomain.playable ? 'פעיל' : 'טרם פורסם'}
                    </Badge>
                  </Td>
                  <Td>
                    {subdomain.playable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`תצוגה מקדימה — ${subdomain.name}`}
                        onClick={() => navigate(`/library/preview/${subdomain.id}`)}
                      >
                        <PlayIcon className="size-4" />
                        תצוגה מקדימה
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableScroller>
        </Card>
      )}
    </div>
  );
}
