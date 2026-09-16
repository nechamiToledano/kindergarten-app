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
  /** Resolves when playback finishes. Built-in tone profiles provide distinct cues when audio assets are unavailable. */
  play: (url: string) => Promise<void>;
  /**
   * Speaks Hebrew text via the browser's built-in TTS (SpeechSynthesis).
   * A stand-in narrator for subdomains whose real human recording has not
   * been produced yet — real speech instead of an abstract tone, with zero
   * asset pipeline. Resolves immediately if the browser has no TTS voice.
   */
  speak: (text: string) => Promise<void>;
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
        const profiles: Record<string, { base: number; duration: number; type: OscillatorType }> = {
          dog: { base: 180, duration: 0.34, type: 'square' },
          cat: { base: 520, duration: 0.22, type: 'sine' },
          bird: { base: 920, duration: 0.42, type: 'triangle' },
          bell: { base: 740, duration: 0.7, type: 'sine' },
          car: { base: 120, duration: 0.65, type: 'sawtooth' },
        };
        let hash = 0;
        for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
        const profile = profiles[seed.toLowerCase()] ?? { base: 320 + (hash % 6) * 90, duration: 0.5, type: 'sine' as OscillatorType };
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = profile.type;
        osc.frequency.setValueAtTime(profile.base, now);
        if (profile.type === 'sawtooth') osc.frequency.exponentialRampToValueAtTime(profile.base * 1.8, now + profile.duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + profile.duration + 0.02);
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

  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        const synth = window.speechSynthesis;
        if (!synth) {
          resolve();
          return;
        }
        synth.cancel(); // a stray utterance from a fast teacher tap must not overlap
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'he-IL';
        utterance.rate = 0.95;
        const hebrewVoice = synth.getVoices().find((v) => v.lang.startsWith('he'));
        if (hebrewVoice) utterance.voice = hebrewVoice;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synth.speak(utterance);
      }),
    [],
  );

  const value = useMemo<AudioUnlockValue>(
    () => ({ unlocked, unlock, play, speak }),
    [unlocked, unlock, play, speak],
  );

  return <AudioUnlockContext.Provider value={value}>{children}</AudioUnlockContext.Provider>;
}

export function useAudioUnlock(): AudioUnlockValue {
  const value = useContext(AudioUnlockContext);
  if (!value) throw new Error('useAudioUnlock must be used within AudioUnlockProvider');
  return value;
}
