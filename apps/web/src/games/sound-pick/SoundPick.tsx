import { useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import { MIN_TOUCH_TARGET_PX } from '@kga/ui';
import { useAudioUnlock } from '../../shared/audio/AudioUnlockProvider';
import type { GameComponentProps } from '../types';
import { SampleImage } from '../ui';

type Config = Extract<GameConfig, { gameType: 'SOUND_PICK' }>;

/**
 * One picture and two speakers. Tapping a speaker plays its sound and selects
 * it; the child then confirms by tapping the same speaker again (first tap =
 * listen, second tap = "this one"). No text sits on the picture — the only cue
 * is the sound itself. Answer: the chosen option id.
 */
export function SoundPick({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const { play } = useAudioUnlock();
  const [heard, setHeard] = useState<string | null>(null);

  const tap = (id: string, audioUrl: string) => {
    if (disabled) return;
    if (heard === id) {
      onAnswer(id);
      return;
    }
    setHeard(id);
    void play(audioUrl).catch(() => undefined);
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', justifyItems: 'center' }}>
      <SampleImage src={config.imageUrl} alt="" />
      <div style={{ display: 'flex', gap: 'clamp(1.5rem, 6vw, 4rem)', justifyContent: 'center' }}>
        {config.options.map((option, i) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            aria-label={`צליל ${i + 1}`}
            onClick={() => tap(option.id, option.audioUrl)}
            className="speaker-btn"
            style={{
              inlineSize: 'clamp(96px, 20vw, 140px)',
              blockSize: 'clamp(96px, 20vw, 140px)',
              minInlineSize: MIN_TOUCH_TARGET_PX,
              minBlockSize: MIN_TOUCH_TARGET_PX,
              borderRadius: '50%',
              outline: heard === option.id ? '5px solid var(--accent, #d99a2e)' : 'none',
              outlineOffset: 4,
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="speaker-icon" style={{ inlineSize: '60%', blockSize: '60%' }}>
              <path d="M4 9.5v5h3.6L13 19V5L7.6 9.5H4z" fill="currentColor" />
              <path d="M16 9.2a4 4 0 010 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M18.6 6.6a7.8 7.8 0 010 10.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
