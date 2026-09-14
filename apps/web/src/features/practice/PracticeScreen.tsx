import { useEffect, useState } from 'react';
import type { Child, Domain, Rating, SubdomainForPlay } from '@kga/contracts';
import { Avatar, PageHeader } from '@kga/ui';
import { useOutbox } from '../../shared/outbox/OutboxProvider';
import { GamePlayer, type SubdomainRunResult } from '../sessions/GamePlayer';
import {
  completeSession,
  createSession,
  getSubdomainForPlay,
  listChildren,
  listDomains,
  listSubdomains,
} from '../sessions/api';

type Stage =
  | { kind: 'setup' }
  | { kind: 'error'; message: string }
  | { kind: 'playing'; subdomain: SubdomainForPlay; sessionId: string | null }
  | { kind: 'done'; result: SubdomainRunResult; subdomainName: string; saved: boolean };

const RATING_LABELS: Record<Rating, string> = {
  PRESENT: 'קיים',
  PARTIALLY_PRESENT: 'קיים חלקית',
  ABSENT: 'לא קיים',
};

/**
 * M7 §3.3 — free-play mode, mapped onto the existing engine rather than a new
 * screen per game type: any subdomain from any age group, run through the same
 * `GamePlayer` (§8) M2 already built. "שמור תוצאה" defaults off; when on, a
 * `Session` with `mode: PRACTICE` is created so it never shows up in a §12
 * assessment report.
 */
export function PracticeScreen({ onExit }: { onExit: () => void }) {
  const { queue } = useOutbox();
  const [stage, setStage] = useState<Stage>({ kind: 'setup' });

  const [children, setChildren] = useState<Child[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [subdomainStubs, setSubdomainStubs] = useState<{ id: string; name: string }[]>([]);
  const [childId, setChildId] = useState<string>('');
  const [domainId, setDomainId] = useState<string>('');
  const [subdomainId, setSubdomainId] = useState<string>('');
  const [saveResult, setSaveResult] = useState(false);

  useEffect(() => {
    listChildren().then(setChildren).catch(() => setChildren([]));
    listDomains().then(setDomains).catch(() => setDomains([]));
  }, []);

  useEffect(() => {
    if (!domainId) return setSubdomainStubs([]);
    listSubdomains(domainId).then(setSubdomainStubs).catch(() => setSubdomainStubs([]));
  }, [domainId]);

  const canSave = saveResult && !!childId;

  const start = async () => {
    if (!subdomainId) return;
    try {
      const subdomain = await getSubdomainForPlay(subdomainId);
      let sessionId: string | null = null;
      if (canSave) {
        const session = await createSession(childId, 'PRACTICE');
        sessionId = session.id;
      }
      setStage({ kind: 'playing', subdomain, sessionId });
    } catch (err) {
      setStage({ kind: 'error', message: err instanceof Error ? err.message : 'שגיאה' });
    }
  };

  const handleComplete = async (result: SubdomainRunResult) => {
    if (stage.kind !== 'playing') return;
    const subdomainName = stage.subdomain.name;
    if (stage.sessionId) {
      await queue({
        clientId: crypto.randomUUID(),
        sessionId: stage.sessionId,
        subdomainId: result.subdomainId,
        subdomainVersionId: stage.subdomain.subdomainVersionId,
        attemptsCount: result.attemptsCount,
        rating: result.rating,
        teacherNote: result.teacherNote,
        rawAnswers: result.rawAnswers,
      });
      try {
        await completeSession(stage.sessionId);
      } catch {
        /* best-effort, same as SessionRunner (§11.5) */
      }
    }
    setStage({ kind: 'done', result, subdomainName, saved: !!stage.sessionId });
  };

  if (stage.kind === 'error') {
    return (
      <div className="pad">
        <p className="error-text">{stage.message}</p>
        <button type="button" className="btn-primary" onClick={onExit}>
          חזרה
        </button>
      </div>
    );
  }

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
        }}
        onComplete={(r) => void handleComplete(r)}
      />
    );
  }

  if (stage.kind === 'done') {
    return (
      <div className="pad summary">
        <h1>משחק חופשי הסתיים</h1>
        <div className="card">
          <p style={{ fontSize: 40 }}>{stage.result.rating === 'PRESENT' ? '🎉' : '👍'}</p>
          <p>
            {stage.subdomainName} · {RATING_LABELS[stage.result.rating]}
          </p>
          <p className="muted">
            {stage.saved ? '✓ נשמר כתרגול (לא נכלל בדוחות האבחון)' : 'תרגול הדגמה — לא נשמר'}
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn-primary" onClick={() => setStage({ kind: 'setup' })}>
            עוד סבב
          </button>
          <button type="button" className="btn-ghost" onClick={onExit}>
            חזרה לבית
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pad">
      <PageHeader title="משחקים חופשיים" subtitle="תרגול ללא לחץ — כל תת-תחום, מכל קבוצת גיל" />

      <div className="dialog" style={{ inlineSize: 'min(560px, 100%)', boxShadow: 'none', border: '1px solid var(--border)' }}>
        <label>
          ילד/ה (אופציונלי — נדרש כדי לשמור תוצאה)
          <select value={childId} onChange={(e) => setChildId(e.target.value)} className="search-input" style={{ inlineSize: '100%' }}>
            <option value="">— תרגול הדגמה, ללא שיוך —</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>

        {childId && (
          <div className="row">
            <Avatar name={children.find((c) => c.id === childId)?.displayName ?? ''} photoUrl={children.find((c) => c.id === childId)?.photoUrl} />
          </div>
        )}

        <label>
          תחום
          <select value={domainId} onChange={(e) => { setDomainId(e.target.value); setSubdomainId(''); }} className="search-input" style={{ inlineSize: '100%' }}>
            <option value="">בחרו תחום</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          תת-תחום
          <select value={subdomainId} onChange={(e) => setSubdomainId(e.target.value)} className="search-input" style={{ inlineSize: '100%' }} disabled={!domainId}>
            <option value="">בחרו תת-תחום</option>
            {subdomainStubs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mode-toggle" style={{ flexDirection: 'row-reverse', justifyContent: 'flex-end' }}>
          <input
            type="checkbox"
            checked={saveResult}
            onChange={(e) => setSaveResult(e.target.checked)}
            disabled={!childId}
          />
          שמירת תוצאה (מסומן כתרגול, לא נכלל בדוחות)
        </label>

        <div className="row">
          <button type="button" className="btn-primary" disabled={!subdomainId} onClick={() => void start()}>
            התחלה
          </button>
          <button type="button" className="btn-ghost" onClick={onExit}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
