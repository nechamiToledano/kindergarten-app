import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isToneUrl } from '../assets/placeholder';

/**
 * §11.4 — Safari blocks audio without a prior user gesture. A single provider
 * unlocks the AudioContext on the first tap of the session and thereafter
 * exposes a `play()` that is always permitted. Combined with §8's
 * gesture-triggered transition into ChildInstruction, no instruction audio can
 * be silently swallowed.
 */
interface AudioUnlockValue {
  unlocked: boolean;
  /** Call from within a user-gesture handler (e.g. the teacher's Start tap). */
  unlock: () => void;
  /** Resolves when playback finishes. Placeholder `tone:` URLs synthesise a beep. */
  play: (url: string) => Promise<void>;
}

const AudioUnlockContext = createContext<AudioUnlockValue | null>(null);

export function AudioUnlockProvider({ children }: { children: ReactNode }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const getContext = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctor();
    }
    return ctxRef.current;
  }, []);

  const unlock = useCallback(() => {
    const ctx = getContext();
    void ctx.resume();
    // A zero-gain blip primes the pipeline inside the gesture.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
    setUnlocked(true);
  }, [getContext]);

  const playTone = useCallback(
    (seed: string) =>
      new Promise<void>((resolve) => {
        const ctx = getContext();
        const now = ctx.currentTime;
        let hash = 0;
        for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
        const base = 320 + (hash % 6) * 90;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.52);
        osc.onended = () => resolve();
      }),
    [getContext],
  );

  const play = useCallback(
    async (url: string) => {
      if (!unlocked) unlock();
      if (isToneUrl(url)) {
        await playTone(decodeURIComponent(url.slice('tone:'.length)));
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const el = new Audio(url);
        el.addEventListener('ended', () => resolve());
        el.addEventListener('error', () => reject(new Error(`audio failed: ${url}`)));
        void el.play().catch(reject);
      });
    },
    [unlocked, unlock, playTone],
  );

  const value = useMemo<AudioUnlockValue>(
    () => ({ unlocked, unlock, play }),
    [unlocked, unlock, play],
  );

  return <AudioUnlockContext.Provider value={value}>{children}</AudioUnlockContext.Provider>;
}

export function useAudioUnlock(): AudioUnlockValue {
  const value = useContext(AudioUnlockContext);
  if (!value) throw new Error('useAudioUnlock must be used within AudioUnlockProvider');
  return value;
}
