import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { GameConfig, Rating, RawAnswer } from '@kga/contracts';
import {
  initialSessionState,
  sessionReducer,
  type SessionState,
} from '@kga/game-engine';
import { ConfettiBurst, RatingBar, type RatingValue } from '@kga/ui';
import { AssetPreloader } from '../../shared/assets/AssetPreloader';
import { useAudioUnlock } from '../../shared/audio/AudioUnlockProvider';
import { engineRegistry, gameComponents } from '../../games/registry';

export interface PlayableSubdomain {
  id: string;
  name: string;
  teacherInstruction: string;
  childInstruction: string;
  gameConfig: GameConfig;
}

export interface SubdomainRunResult {
  subdomainId: string;
  rating: Rating;
  teacherNote: string | null;
  attemptsCount: number;
  rawAnswers: RawAnswer[];
}

const RATING_LABELS: Record<RatingValue, string> = {
  PRESENT: 'קיים',
  PARTIALLY_PRESENT: 'קיים חלקית',
  ABSENT: 'לא קיים',
};

function promptAudioUrl(config: GameConfig): string | null {
  return 'promptAudioUrl' in config ? config.promptAudioUrl : null;
}

const surface: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1.5rem',
  padding: '2rem',
  background: 'var(--gradient-paper)',
  textAlign: 'center',
};

export function GamePlayer({
  subdomain,
  onComplete,
}: {
  subdomain: PlayableSubdomain;
  onComplete: (result: SubdomainRunResult) => void;
}) {
  const { config, plugin } = useMemo(() => {
    const cfg = subdomain.gameConfig;
    return { config: cfg, plugin: engineRegistry.get(cfg.gameType) };
  }, [subdomain]);

  const assets = useMemo(() => plugin.assetsOf(config), [plugin, config]);
  const Component = gameComponents[config.gameType];

  const { unlock, play } = useAudioUnlock();
  const [state, dispatch] = useReducer(sessionReducer, undefined, initialSessionState);
  const [note, setNote] = useState('');
  const [pendingRating, setPendingRating] = useState<RatingValue | null>(null);

  // ChildInstruction — play the prompt (after the teacher's Start gesture), then advance.
  useEffect(() => {
    if (state.phase !== 'ChildInstruction') return;
    let cancelled = false;
    const url = promptAudioUrl(config);
    const done = () => {
      if (!cancelled) dispatch({ type: 'CHILD_AUDIO_FINISHED' });
    };
    if (url) play(url).then(done, done);
    else done();
    return () => {
      cancelled = true;
    };
  }, [state.phase, config, play]);

  // Feedback phases tick forward on a timer.
  useEffect(() => {
    if (state.phase === 'WrongFeedback') {
      const t = setTimeout(() => dispatch({ type: 'CONTINUE_AFTER_WRONG' }), 1600);
      return () => clearTimeout(t);
    }
    if (state.phase === 'CorrectFeedback' || state.phase === 'Exhausted') {
      const t = setTimeout(() => dispatch({ type: 'ADVANCE' }), 1200);
      return () => clearTimeout(t);
    }
  }, [state.phase]);

  // Done — hand the result up once.
  const completedRef = useRef(false);
  useEffect(() => {
    if (state.phase !== 'Done' || !state.rating || completedRef.current) return;
    completedRef.current = true;
    onComplete({
      subdomainId: subdomain.id,
      rating: state.rating,
      teacherNote: state.teacherNote,
      attemptsCount: state.attempts,
      rawAnswers: state.rawAnswers,
    });
  }, [state.phase]);

  const handleAnswer = useCallback(
    (value: unknown) => {
      const outcome = plugin.score(config as never, value);
      dispatch({
        type: 'ANSWER',
        correct: outcome.correct,
        value: outcome.detail ? { value, ...outcome.detail } : value,
        at: new Date().toISOString(),
      });
    },
    [plugin, config],
  );

  const start = () => {
    unlock();
    dispatch({ type: 'START' });
  };

  const confirmRating = () => {
    if (!pendingRating) return;
    dispatch({
      type: 'RATE',
      rating: pendingRating,
      teacherNote: state.phase === 'RatingFailure' && note.trim() ? note.trim() : null,
    });
  };

  return renderPhase();

  function renderPhase() {
    switch (state.phase) {
      case 'TeacherInstruction':
        return (
          <div style={surface}>
            <h2>{subdomain.name}</h2>
            <p style={{ maxInlineSize: 640, fontSize: 20 }}>{subdomain.teacherInstruction}</p>
            <button type="button" onClick={start} className="game-submit-btn">
              התחלה
            </button>
          </div>
        );

      case 'ChildInstruction':
        return (
          <div style={surface}>
            <p style={{ fontSize: 26 }}>{subdomain.childInstruction}</p>
            <p aria-hidden style={{ fontSize: 40 }}>🔊</p>
          </div>
        );

      case 'Playing':
        return (
          <div style={surface}>
            <AssetPreloader assets={assets}>
              <Component config={config as never} disabled={false} onAnswer={handleAnswer} />
            </AssetPreloader>
          </div>
        );

      case 'WrongFeedback':
        return (
          <div style={surface} className="feedback wrong shake">
            <p style={{ fontSize: 64 }}>❌</p>
            <p style={{ fontSize: 24 }}>ננסה שוב</p>
          </div>
        );

      case 'CorrectFeedback':
        return (
          <div style={surface} className="feedback correct">
            <ConfettiBurst pieces={16} />
            <p style={{ fontSize: 64 }}>✅</p>
          </div>
        );

      case 'Exhausted':
        return (
          <div style={surface}>
            <p style={{ fontSize: 48 }}>👍</p>
            <p style={{ fontSize: 22 }}>עוברים הלאה</p>
          </div>
        );

      case 'RatingSuccess':
      case 'RatingFailure':
        return (
          <div style={surface}>
            <h2>דירוג — {subdomain.name}</h2>
            <p style={{ fontSize: 16, color: 'var(--text)' }}>
              {state.attempts} ניסיונות · הגננת מדרגת תמיד ידנית (§8)
            </p>
            <RatingBar value={pendingRating} onChange={setPendingRating} labels={RATING_LABELS} />
            {state.phase === 'RatingFailure' && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="הערת גננת (רק לאחר שלושה כישלונות)"
                rows={3}
                style={{ inlineSize: 'min(560px, 90vw)', fontSize: 16, padding: 8 }}
              />
            )}
            <button type="button" onClick={confirmRating} disabled={!pendingRating} className="game-submit-btn">
              שמירה
            </button>
          </div>
        );

      case 'Done':
        return (
          <div style={surface}>
            <p style={{ fontSize: 48 }}>✔️</p>
            <p>הדירוג נשמר</p>
          </div>
        );

      default:
        return null;
    }
  }
}

export type { SessionState };
