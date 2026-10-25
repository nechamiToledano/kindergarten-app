import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { GameConfig, Rating, RawAnswer } from '@kga/contracts';
import {
  MAX_ATTEMPTS,
  initialSessionState,
  sessionReducer,
  type SessionState,
} from '@kga/game-engine';
import { ConfettiBurst, RatingBar, type RatingValue } from '@kga/ui';
import { AssetPreloader } from '../../shared/assets/AssetPreloader';
import { isToneUrl } from '../../shared/assets/placeholder';
import { useAudioUnlock } from '../../shared/audio/AudioUnlockProvider';
import { engineRegistry, gameComponents } from '../../games/registry';

export interface PlayableSubdomain {
  id: string;
  name: string;
  teacherInstruction: string;
  childInstruction: string;
  gameConfig: GameConfig;
  demoConfig?: GameConfig | null;
}

export interface SubdomainRunResult {
  subdomainId: string;
  rating: Rating;
  teacherNote: string | null;
  attemptsCount: number;
  rawAnswers: RawAnswer[];
}

const RATING_LABELS: Record<RatingValue, string> = {
  PRESENT: '✓ קיים',
  PRESENT_WITH_SUPPORT: '~ קיים עם תיווך',
  PARTIALLY_PRESENT: '~ קיים חלקית',
  ABSENT: '✕ לא קיים',
};

function promptAudioUrl(config: GameConfig): string | null {
  return 'promptAudioUrl' in config ? config.promptAudioUrl : null;
}

/** The full ordered clip list for a prompt — usually just one url, but a few
 * "which sound came first/last" prompts chain a second real sound after it. */
function promptAudioSequence(config: GameConfig): string[] {
  const first = promptAudioUrl(config);
  if (!first) return [];
  const rest = 'sequenceAudioUrls' in config ? config.sequenceAudioUrls ?? [] : [];
  return [first, ...rest];
}

export function GamePlayer({
  subdomain,
  onComplete,
  onExit,
}: {
  subdomain: PlayableSubdomain;
  onComplete: (result: SubdomainRunResult) => void;
  /** Leaves the game for the screen it was opened from. Shown on every phase. */
  onExit?: () => void;
}) {
  const exitButton = onExit ? (
    <button type="button" className="game-back" onClick={onExit} aria-label="חזרה">
      <span aria-hidden="true">→</span> חזרה
    </button>
  ) : null;
  const { config, plugin } = useMemo(() => {
    const cfg = subdomain.gameConfig;
    return { config: cfg, plugin: engineRegistry.get(cfg.gameType) };
  }, [subdomain]);

  const assets = useMemo(() => plugin.assetsOf(config), [plugin, config]);
  const Component = gameComponents[config.gameType];

  const demoConfig = subdomain.demoConfig ?? null;
  const DemoComponent = demoConfig ? gameComponents[demoConfig.gameType] : null;
  const demoAssets = useMemo(
    () => (demoConfig ? engineRegistry.get(demoConfig.gameType).assetsOf(demoConfig as never) : []),
    [demoConfig],
  );

  const { unlock, play, speak, stop } = useAudioUnlock();

  // The child's (or teacher's) mute choice sticks across games in the session
  // and reloads — it silences spoken instructions only, not the feedback sfx.
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('kga.instructionMuted') === '1';
    } catch {
      return false;
    }
  });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const toggleMuted = () => {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    try {
      localStorage.setItem('kga.instructionMuted', next ? '1' : '0');
    } catch {
      /* storage unavailable — the choice just won't persist */
    }
    if (next) stop();
  };

  // Real speech is a better stand-in than an abstract tone for a subdomain
  // whose human recording hasn't landed yet — speak the instruction text
  // itself instead of the terse tone seed.
  const playPrompt = useCallback(
    (url: string | null) => {
      if (!url || mutedRef.current) return Promise.resolve();
      if (isToneUrl(url)) return speak(subdomain.childInstruction);
      return play(url);
    },
    [play, speak, subdomain.childInstruction],
  );

  // A short silence between chained clips (e.g. drum … bell) so the two
  // sounds read as distinct beats instead of running into each other.
  const playPromptSequence = useCallback(
    async (urls: string[]) => {
      for (const [i, url] of urls.entries()) {
        if (i > 0) await new Promise((resolve) => setTimeout(resolve, 350));
        await playPrompt(url);
      }
    },
    [playPrompt],
  );
  const [state, dispatch] = useReducer(sessionReducer, Boolean(demoConfig), initialSessionState);
  const [note, setNote] = useState('');
  const [pendingRating, setPendingRating] = useState<RatingValue | null>(null);
  const [isPromptPlaying, setIsPromptPlaying] = useState(false);

  // ChildInstruction — play the prompt (after the teacher's Start gesture), then advance.
  useEffect(() => {
    if (state.phase !== 'ChildInstruction') return;
    let cancelled = false;
    const urls = promptAudioSequence(config);
    const done = () => {
      if (!cancelled) {
        setIsPromptPlaying(false);
        dispatch({ type: 'CHILD_AUDIO_FINISHED' });
      }
    };
    setIsPromptPlaying(true);
    if (urls.length) playPromptSequence(urls).then(done, done);
    else done();
    return () => {
      cancelled = true;
    };
  }, [state.phase, config, playPromptSequence]);

  // Feedback phases tick forward on a timer, each cued by its own sound effect
  // (Spec: "תגובה חזותית עם צליל ... לתשובה נכונה או שגויה").
  useEffect(() => {
    if (state.phase === 'WrongFeedback') {
      void play('/assets/audio/sfx-wrong.wav');
      const t = setTimeout(() => dispatch({ type: 'CONTINUE_AFTER_WRONG' }), 1600);
      return () => clearTimeout(t);
    }
    if (state.phase === 'CorrectFeedback') {
      const lastAnswer = state.rawAnswers[state.rawAnswers.length - 1]?.value;
      const feedbackAudioUrl =
        lastAnswer && typeof lastAnswer === 'object' && 'feedbackAudioUrl' in lastAnswer
          ? (lastAnswer as { feedbackAudioUrl?: string }).feedbackAudioUrl
          : undefined;
      void play('/assets/audio/sfx-correct.wav');
      if (feedbackAudioUrl) void playPrompt(feedbackAudioUrl);
      const t = setTimeout(() => dispatch({ type: 'ADVANCE' }), feedbackAudioUrl ? 2200 : 1200);
      return () => clearTimeout(t);
    }
    if (state.phase === 'Exhausted') {
      const t = setTimeout(() => dispatch({ type: 'ADVANCE' }), 1200);
      return () => clearTimeout(t);
    }
  }, [state.phase, state.rawAnswers, play, playPrompt]);

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
          <main className="game-screen game-screen-centered">
            <div className="game-topbar"><span className="game-topbar-start">{exitButton}<span className="game-brand">משחקים ולומדים</span></span><span className="game-step">הכנה למשחק</span></div>
            <div className="game-hero-card">
              <span className="game-hero-icon" aria-hidden="true">🎈</span>
              <span className="game-kicker">תרגול אישי</span>
              <h1>{subdomain.name}</h1>
              <div className="teacher-note">
                <span className="teacher-note-label">להנחיה</span>
                <p>{subdomain.teacherInstruction}</p>
              </div>
              <button type="button" onClick={start} className="game-submit-btn game-submit-btn-lg">מתחילים לשחק</button>
            </div>
          </main>
        );

      case 'Demo':
        return (
          <main className="game-screen game-screen-centered">
            <div className="game-topbar"><span className="game-topbar-start">{exitButton}<span className="game-brand">משחקים ולומדים</span></span><span className="game-step">דוגמה</span></div>
            <div className="game-instruction-corner">
              <div className="game-instruction-pill">בואו נראה דוגמה ביחד</div>
            </div>
            <div className="game-play-card">
              {demoConfig && DemoComponent && (
                <AssetPreloader assets={demoAssets}>
                  <DemoComponent config={demoConfig as never} disabled={false} onAnswer={() => dispatch({ type: 'DEMO_DONE' })} />
                </AssetPreloader>
              )}
            </div>
            <button
              type="button"
              className="game-submit-btn"
              onClick={() => dispatch({ type: 'DEMO_DONE' })}
            >
              עברנו על הדוגמה, בואו ננסה
            </button>
          </main>
        );

      // The instruction lives on the game's own screen: while it is being
      // spoken (ChildInstruction) the board is already visible but locked, then
      // it unlocks in place (Playing) with no screen change.
      case 'ChildInstruction':
      case 'Playing': {
        const listening = state.phase === 'ChildInstruction';
        const hasAudio = promptAudioSequence(config).length > 0;
        const replay = () => {
          const urls = promptAudioSequence(config);
          if (!urls.length) return;
          mutedRef.current = false;
          setMuted(false);
          try { localStorage.setItem('kga.instructionMuted', '0'); } catch { /* ignore */ }
          stop();
          setIsPromptPlaying(true);
          void playPromptSequence(urls).finally(() => setIsPromptPlaying(false));
        };
        return (
          <main className="game-screen game-screen-centered">
            <div className="game-topbar">
              <span className="game-topbar-start">{exitButton}<span className="game-brand">משחקים ולומדים</span></span>
              <span className="game-progress-dots" aria-label={`נסיון ${state.attempts + 1} מתוך ${MAX_ATTEMPTS}`}>
                {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
                  <span key={i} className={`game-progress-dot ${i <= state.attempts ? 'is-done' : ''}`} />
                ))}
              </span>
            </div>
            <div className="game-instruction-corner">
              <div className="game-instruction-pill">{subdomain.childInstruction}</div>
              {hasAudio && (
                // One speaker button: tap while it is speaking to silence it, tap
                // otherwise to hear the instruction again.
                <button
                  type="button"
                  className={`speaker-btn ${isPromptPlaying ? 'is-playing' : ''} ${muted && !isPromptPlaying ? 'is-muted' : ''}`}
                  onClick={isPromptPlaying ? toggleMuted : replay}
                  aria-label={isPromptPlaying ? 'השתקת ההוראה' : 'שמיעת ההוראה'}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="speaker-icon">
                    <path d="M4 9.5v5h3.6L13 19V5L7.6 9.5H4z" fill="currentColor" />
                    {muted && !isPromptPlaying ? (
                      <path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                    ) : (
                      <>
                        <path className="speaker-wave speaker-wave-1" d="M16 9.2a4 4 0 010 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                        <path className="speaker-wave speaker-wave-2" d="M18.6 6.6a7.8 7.8 0 010 10.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                      </>
                    )}
                  </svg>
                </button>
              )}
            </div>
            <div className="game-play-card">
              <AssetPreloader assets={assets}>
                <Component config={config as never} disabled={listening} onAnswer={handleAnswer} />
              </AssetPreloader>
            </div>
          </main>
        );
      }

      case 'WrongFeedback':
        return (
          <main className="game-screen game-screen-centered feedback wrong shake">
            <span className="feedback-mark feedback-wrong-mark" aria-hidden="true">×</span>
            <p style={{ fontSize: 24 }}>ננסה שוב</p>
          </main>
        );

      case 'CorrectFeedback':
        return (
          <main className="game-screen game-screen-centered feedback correct">
            <ConfettiBurst pieces={16} />
            <span className="feedback-mark feedback-correct-mark" aria-hidden="true">✓</span>
          </main>
        );

      case 'Exhausted':
        return (
          <main className="game-screen game-screen-centered">
            <span className="feedback-mark feedback-next-mark" aria-hidden="true">→</span>
            <p style={{ fontSize: 22 }}>עוברים הלאה</p>
          </main>
        );

      case 'RatingSuccess':
      case 'RatingFailure': {
        const succeeded = state.phase === 'RatingSuccess';
        return (
          <main className="game-screen game-screen-centered">
            <div className="game-topbar"><span className="game-topbar-start">{exitButton}<span className="game-brand">משחקים ולומדים</span></span><span className="game-step">סיכום פעילות</span></div>
            <div className="rating-card">
              <span className={`game-hero-icon ${succeeded ? '' : 'is-soft'}`} aria-hidden="true">{succeeded ? '🌟' : '💛'}</span>
              <span className="game-kicker">סיימנו את הפעילות</span>
              <h1>איך היה ל{state.attempts === 1 ? 'ך' : 'כם'}?</h1>
              <h2>{subdomain.name}</h2>
              <p className="rating-meta">
                {succeeded
                  ? `הצלחה בניסיון ${state.attempts} מתוך ${MAX_ATTEMPTS}`
                  : `לא הסתייע הפעם — זה בסדר, כל ניסיון מלמד משהו`}
              </p>
              <RatingBar value={pendingRating} onChange={setPendingRating} labels={RATING_LABELS} />
              {state.phase === 'RatingFailure' && (
                <label className="teacher-note-field">
                  <span className="teacher-note-label">הערת גננת (רק לאחר שלושה כישלונות)</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="מה שווה לזכור על הניסיון הזה?"
                    rows={3}
                  />
                </label>
              )}
              <button type="button" onClick={confirmRating} disabled={!pendingRating} className="game-submit-btn game-submit-btn-lg">
                שמירת הדירוג
              </button>
            </div>
          </main>
        );
      }

      case 'Done':
        return (
          <main className="game-screen game-screen-centered">
            <span className="feedback-mark feedback-correct-mark" aria-hidden="true">✓</span>
            <p style={{ fontSize: 22, fontWeight: 600 }}>הדירוג נשמר</p>
          </main>
        );

      default:
        return null;
    }
  }
}

export type { SessionState };
