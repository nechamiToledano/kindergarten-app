import { useCallback, useEffect, useRef, useState } from 'react';
import type { Child, Domain, Rating, SubdomainForPlay } from '@kga/contracts';
import { useOutbox } from '../../shared/outbox/OutboxProvider';
import { GamePlayer, type SubdomainRunResult } from './GamePlayer';
import {
  completeSession,
  createSession,
  getSubdomainForPlay,
  listDomains,
  listSubdomains,
} from './api';

type Stage =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'picking'; domains: Domain[]; sessionId: string }
  | { kind: 'playing'; subdomains: SubdomainForPlay[]; sessionId: string; domainName: string }
  | { kind: 'done'; results: SubdomainRunResult[]; domainName: string };

const RATING_LABELS: Record<Rating, string> = {
  PRESENT: 'קיים',
  PARTIALLY_PRESENT: 'קיים חלקית',
  ABSENT: 'לא קיים',
};

/**
 * One child through one domain's subdomains. The §8 state machine (inside
 * GamePlayer, shared with M2) drives each subdomain; every result is written
 * straight to the IndexedDB outbox (§11.5) and flushed in the background. M5
 * added the domain picker — the teacher chooses which of the age group's domains
 * to run this sitting.
 */
export function SessionRunner({ child, onExit }: { child: Child; onExit: () => void }) {
  const { queue, pending, syncing, flush } = useOutbox();
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });
  const [current, setCurrent] = useState(0);
  const results = useRef<SubdomainRunResult[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const session = await createSession(child.id);
        const domains = await listDomains(session.ageGroupAtTime);
        if (domains.length === 0) return setStage({ kind: 'empty' });
        setStage({ kind: 'picking', domains, sessionId: session.id });
      } catch (err) {
        setStage({ kind: 'error', message: err instanceof Error ? err.message : 'שגיאה' });
      }
    })();
  }, [child.id]);

  const pickDomain = useCallback(
    async (domain: Domain, sessionId: string) => {
      setStage({ kind: 'loading' });
      try {
        const stubs = await listSubdomains(domain.id);
        if (stubs.length === 0) return setStage({ kind: 'empty' });
        const subdomains = await Promise.all(stubs.map((s) => getSubdomainForPlay(s.id)));
        results.current = [];
        setCurrent(0);
        setStage({ kind: 'playing', subdomains, sessionId, domainName: domain.name });
      } catch (err) {
        setStage({ kind: 'error', message: err instanceof Error ? err.message : 'שגיאה' });
      }
    },
    [],
  );

  const handleComplete = useCallback(
    async (result: SubdomainRunResult) => {
      if (stage.kind !== 'playing') return;
      results.current = [...results.current, result];
      const played = stage.subdomains.find((s) => s.id === result.subdomainId);
      if (played) {
        await queue({
          clientId: crypto.randomUUID(),
          sessionId: stage.sessionId,
          subdomainId: result.subdomainId,
          subdomainVersionId: played.subdomainVersionId,
          attemptsCount: result.attemptsCount,
          rating: result.rating,
          teacherNote: result.teacherNote,
          rawAnswers: result.rawAnswers,
        });
      }

      if (current + 1 < stage.subdomains.length) {
        setCurrent((n) => n + 1);
      } else {
        try {
          await completeSession(stage.sessionId);
        } catch {
          /* completion is best-effort — the outbox flush still delivers the results */
        }
        setStage({ kind: 'done', results: results.current, domainName: stage.domainName });
      }
    },
    [stage, current, queue],
  );

  if (stage.kind === 'loading') return <p className="pad">טוען סשן…</p>;
  if (stage.kind === 'error') return <ExitCard message={stage.message} onExit={onExit} />;
  if (stage.kind === 'empty')
    return <ExitCard message="אין תוכן זמין לקבוצת הגיל של הילד/ה." onExit={onExit} />;

  if (stage.kind === 'picking') {
    return (
      <div className="pad">
        <h1>בחירת תחום — {child.displayName}</h1>
        <p className="muted">בחרו את התחום לאבחון בסשן זה.</p>
        <ul className="domain-list">
          {stage.domains.map((domain) => (
            <li key={domain.id}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void pickDomain(domain, stage.sessionId)}
              >
                {domain.name}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-ghost" onClick={onExit}>
          חזרה לרשימה
        </button>
      </div>
    );
  }

  if (stage.kind === 'done') {
    return (
      <div className="pad summary">
        <h1>הסתיים — {stage.domainName}</h1>
        <p className="muted">
          {child.displayName} · {stage.results.length} תת-תחומים
        </p>
        <ul className="summary-list">
          {stage.results.map((r) => (
            <li key={r.subdomainId}>
              <span>{RATING_LABELS[r.rating]}</span>
              <span className="muted">
                {r.attemptsCount} ניסיונות{r.teacherNote ? ` · "${r.teacherNote}"` : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted">
          {pending === 0
            ? '✓ כל התוצאות נשמרו בשרת'
            : `${pending} תוצאות ממתינות לסנכרון${syncing ? ' (מסנכרן…)' : ''}`}
        </p>
        <div className="row">
          {pending > 0 && (
            <button type="button" className="btn-ghost" onClick={() => void flush()}>
              סנכרן עכשיו
            </button>
          )}
          <button type="button" className="btn-primary" onClick={onExit}>
            חזרה לרשימה
          </button>
        </div>
      </div>
    );
  }

  const subdomain = stage.subdomains[current];
  return (
    <GamePlayer
      key={subdomain.id}
      subdomain={{
        id: subdomain.id,
        name: subdomain.name,
        teacherInstruction: subdomain.teacherInstruction,
        childInstruction: subdomain.childInstruction,
        gameConfig: subdomain.gameConfig,
      }}
      onComplete={handleComplete}
    />
  );
}

function ExitCard({ message, onExit }: { message: string; onExit: () => void }) {
  return (
    <div className="pad">
      <div className="card">
        <p>{message}</p>
        <button type="button" className="btn-primary" onClick={onExit}>
          חזרה
        </button>
      </div>
    </div>
  );
}
