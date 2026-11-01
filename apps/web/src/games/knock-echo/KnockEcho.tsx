import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import { useAudioUnlock } from '../../shared/audio/AudioUnlockProvider';
import type { GameComponentProps } from '../types';

type Config = Extract<GameConfig, { gameType: 'KNOCK_ECHO' }>;

type Phase = 'wait' | 'demo' | 'child';

const KNOCK_SOUND = '/assets/audio/sfx-drum.wav';
const DEMO_GAP_MS = 1000;
/** A calm beat for the child to knock to: one number every ~1.9s, spoken slowly. */
const COUNT_STEP_MS = 1900;
const COUNT_RATE = 0.6;
const HE_NUMBERS = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'];

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Knock-and-count (דפיקות). A fist knocks on a door `knockCount` times; then it
 * is the child's turn to knock the same number of times — on the screen or on
 * anything real (a table, a drum) — while a calm voice counts "one… two…
 * three…" slowly, one number per beat. Nothing on screen shows the count, and
 * not tapping the screen is not an error: the app cannot hear a real table, so
 * the teacher watches and rates afterwards. The answer is just the screen taps.
 */
export function KnockEcho({ config, disabled: locked, instructionPlaying = false, onAnswer }: GameComponentProps<Config>) {
  // The demo narrates itself, so it must not start over the spoken instruction.
  const disabled = locked || instructionPlaying;
  const { play, speak } = useAudioUnlock();
  const [phase, setPhase] = useState<Phase>('wait');
  const [fistKey, setFistKey] = useState(0);
  const tapsRef = useRef(0);

  const hit = useCallback(() => {
    setFistKey((n) => n + 1);
    void play(KNOCK_SOUND).catch(() => undefined);
  }, [play]);

  // Starts only once the spoken instruction has finished (disabled → false);
  // starting earlier, our own speech would cut the instruction off.
  useEffect(() => {
    if (disabled) return;
    let stop = false;
    void (async () => {
      setPhase('demo');
      await wait(500);
      for (let i = 1; i <= config.knockCount; i += 1) {
        if (stop) return;
        hit();
        await wait(DEMO_GAP_MS);
      }
      if (stop) return;
      await speak('עכשיו בואו נדפוק');
      if (stop) return;
      setPhase('child');
      await wait(700);
      // The voice counts along while the child knocks, one slow number per beat.
      for (let i = 1; i <= config.knockCount; i += 1) {
        if (stop) return;
        await Promise.all([speak(HE_NUMBERS[i] ?? String(i), COUNT_RATE), wait(COUNT_STEP_MS)]);
      }
      if (stop) return;
      await wait(800);
      if (!stop) onAnswer(tapsRef.current);
    })();
    return () => {
      stop = true;
    };
    // onAnswer is left out on purpose: the run must not restart if the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, config.knockCount, hit, speak]);

  const knock = () => {
    if (disabled || phase !== 'child') return;
    hit();
    tapsRef.current += 1;
  };

  const turnLabel = phase === 'demo' ? 'מקשיבים…' : phase === 'child' ? 'תורכם! דפקו על המסך או על השולחן' : '';
  const knocking = fistKey > 0;

  return (
    <div style={{ display: 'grid', gap: 'clamp(0.8rem, 2.5vw, 1.6rem)', justifyItems: 'center' }}>
      <div className={`knock-turn${phase === 'child' ? ' is-child' : ''}`} aria-live="polite">
        {turnLabel}
      </div>

      <div className="knock-scene">
        <button
          type="button"
          className={`knock-table${phase === 'child' ? ' is-turn' : ''}`}
          aria-label="השולחן, אפשר להקיש כדי לדפוק"
          disabled={disabled || phase !== 'child'}
          onClick={knock}
        >
          <img src="/assets/knock-table.png" alt="" draggable={false} style={{ display: 'block', inlineSize: '100%' }} />
        </button>
        {/* The fist drops onto the table's lighter knocking spot. */}
        <div key={`f${fistKey}`} className={`knock-fist${knocking ? ' is-knocking' : ''}`}>
          <img src="/assets/knock-fist-down.png" alt="" draggable={false} style={{ display: 'block', inlineSize: '100%' }} />
        </div>
        <span key={`b${fistKey}`} className={`knock-burst${knocking ? ' is-knocking' : ''}`}>
          <img src="/assets/knock-burst.png" alt="" draggable={false} style={{ display: 'block', inlineSize: '100%' }} />
        </span>
        <span key={`t${fistKey}`} className={`knock-toc${knocking ? ' is-knocking' : ''}`}>
          טוק!
        </span>
      </div>
    </div>
  );
}
