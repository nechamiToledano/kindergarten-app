import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { SubdomainForPlay } from '@kga/contracts';
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
  LibraryIcon,
  Select,
  Skeleton,
  Switch,
} from '@kga/ui';
import { createSession, getSubdomainForPlay } from '../../shared/api/endpoints';
import { useChildren, useDomains, useSubdomains } from '../../shared/api/queries';
import { useOutbox } from '../../shared/outbox/OutboxProvider';
import { AGE_GROUP_LABELS, GAME_TYPE_LABELS, RATING_LABELS } from '../../shared/format';
import { GamePlayer, type SubdomainRunResult } from '../sessions/GamePlayer';

type Stage =
  | { kind: 'setup' }
  | { kind: 'playing'; subdomain: SubdomainForPlay; sessionId: string | null }
  | { kind: 'done'; result: SubdomainRunResult; subdomainName: string; saved: boolean };

/**
 * Free play.
 *
 * Any game from the catalogue, outside the diagnostic flow. Saving is off by
 * default and, when on, writes a PRACTICE session — which every report filters
 * out, so a child replaying a game they enjoy can never move a screening figure.
 *
 * This screen used to fall back to a bundled fixture when the catalogue came
 * back empty, which meant an API failure looked like content. It now says the
 * catalogue is empty, because that is the fact the teacher needs.
 */
export function PracticeScreen() {
  const navigate = useNavigate();
  const { queue } = useOutbox();
  const [stage, setStage] = useState<Stage>({ kind: 'setup' });

  const [childId, setChildId] = useState('');
  const [domainId, setDomainId] = useState('');
  const [subdomainId, setSubdomainId] = useState('');
  const [saveResult, setSaveResult] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const childrenQuery = useChildren({ pageSize: 100 });
  const domainsQuery = useDomains();
  const subdomainsQuery = useSubdomains({ domainId: domainId || undefined }, !!domainId);

  const playable = useMemo(
    () => (subdomainsQuery.data ?? []).filter((item) => item.playable),
    [subdomainsQuery.data],
  );

  const canSave = saveResult && !!childId;

  const start = async () => {
    if (!subdomainId) return;
    setStarting(true);
    setError(null);
    try {
      const subdomain = await getSubdomainForPlay(subdomainId);
      let sessionId: string | null = null;
      if (canSave) {
        const session = await createSession({
          childId,
          mode: 'PRACTICE',
          plan: [subdomainId],
        });
        sessionId = session.id;
      }
      setStage({ kind: 'playing', subdomain, sessionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'המשחק לא נטען');
    } finally {
      setStarting(false);
    }
  };

  const handleComplete = async (result: SubdomainRunResult) => {
    if (stage.kind !== 'playing') return;
    const { subdomain, sessionId } = stage;
    if (sessionId) {
      await queue({
        clientId: crypto.randomUUID(),
        sessionId,
        subdomainId: subdomain.id,
        subdomainVersionId: subdomain.subdomainVersionId,
        attemptsCount: result.attemptsCount,
        rating: result.rating,
        teacherNote: result.teacherNote,
        rawAnswers: result.rawAnswers,
      });
    }
    setStage({
      kind: 'done',
      result,
      subdomainName: subdomain.name,
      saved: !!sessionId,
    });
  };

  if (stage.kind === 'playing') {
    return (
      <GamePlayer
        key={stage.subdomain.id}
        subdomain={{
          id: stage.subdomain.id,
          name: stage.subdomain.name,
          teacherInstruction: stage.subdomain.teacherInstruction,
          childInstruction: stage.subdomain.childInstruction,
          gameConfig: stage.subdomain.gameConfig,
          demoConfig: stage.subdomain.demoConfig,
        }}
        onComplete={handleComplete}
      />
    );
  }

  if (stage.kind === 'done') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <h1 className="font-display text-xl font-semibold">{stage.subdomainName}</h1>
          <Badge tone="neutral">{RATING_LABELS[stage.result.rating]}</Badge>
          <p className="text-sm text-muted-foreground">
            {stage.saved
              ? 'התוצאה נשמרה כתרגול ולא תיכלל בדוחות האבחון.'
              : 'התוצאה לא נשמרה — זהו משחק חופשי בלבד.'}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setStage({ kind: 'setup' })}>משחק נוסף</Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              חזרה למערכת
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-4 md:p-6">
      <Card>
        <CardHeader
          title="משחק חופשי"
          description="כל משחק מהקטלוג, ללא קשר לתהליך האבחון"
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              יציאה
            </Button>
          }
        />
        <CardBody className="flex flex-col gap-4">
          {domainsQuery.isPending && <Skeleton className="h-11 rounded-lg" />}

          {domainsQuery.data && domainsQuery.data.length === 0 && (
            <EmptyState
              icon={<LibraryIcon />}
              title="אין תוכן בקטלוג"
              description="עורכת התוכן צריכה לפרסם משחקים לפני שאפשר לשחק."
              className="border-0"
            />
          )}

          {domainsQuery.data && domainsQuery.data.length > 0 && (
            <>
              <Field label="תחום" htmlFor="practice-domain">
                <Select
                  id="practice-domain"
                  value={domainId}
                  onChange={(event) => {
                    setDomainId(event.target.value);
                    setSubdomainId('');
                  }}
                >
                  <option value="">בחרו תחום</option>
                  {domainsQuery.data.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {domainId && subdomainsQuery.isPending && <Skeleton className="h-11 rounded-lg" />}

              {domainId && subdomainsQuery.data && (
                <Field
                  label="משחק"
                  htmlFor="practice-subdomain"
                  hint={
                    playable.length === 0
                      ? 'אין משחקים שפורסמו בתחום הזה.'
                      : `${playable.length} משחקים זמינים`
                  }
                >
                  <Select
                    id="practice-subdomain"
                    value={subdomainId}
                    onChange={(event) => setSubdomainId(event.target.value)}
                    disabled={playable.length === 0}
                  >
                    <option value="">בחרו משחק</option>
                    {playable.map((subdomain) => (
                      <option key={subdomain.id} value={subdomain.id}>
                        {subdomain.name} · {GAME_TYPE_LABELS[subdomain.gameType] ?? subdomain.gameType}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <div className="rounded-xl bg-secondary/50 p-3">
                <Switch
                  checked={saveResult}
                  onChange={setSaveResult}
                  label="שמירת התוצאה עבור ילד/ה"
                />
                {saveResult && (
                  <div className="mt-3">
                    <Field label="ילד/ה" htmlFor="practice-child">
                      <Select
                        id="practice-child"
                        value={childId}
                        onChange={(event) => setChildId(event.target.value)}
                      >
                        <option value="">בחרו ילד/ה</option>
                        {childrenQuery.data?.items.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.displayName} · {AGE_GROUP_LABELS[child.currentAgeGroup]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <p className="mt-2 text-xs text-muted-foreground">
                      תוצאות תרגול נשמרות בנפרד ואינן נכללות באף דוח אבחון.
                    </p>
                  </div>
                )}
              </div>

              {childId && childrenQuery.data && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Avatar
                    name={
                      childrenQuery.data.items.find((c) => c.id === childId)?.displayName ?? ''
                    }
                    size={28}
                  />
                  {childrenQuery.data.items.find((c) => c.id === childId)?.displayName}
                </div>
              )}

              {error && <ErrorState message={error} />}

              <Button
                size="lg"
                loading={starting}
                disabled={!subdomainId || (saveResult && !childId)}
                onClick={() => void start()}
              >
                מתחילים לשחק
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
