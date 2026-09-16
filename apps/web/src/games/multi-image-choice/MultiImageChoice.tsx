import { useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { ImageCard, OptionGrid, SubmitButton } from '../ui';

type Config = Extract<GameConfig, { gameType: 'MULTI_IMAGE_CHOICE' }>;

/** Spec §4.2 — 3–6 images, select the correct one(s), then confirm. Answer: id[]. */
export function MultiImageChoice({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <>
      {config.sampleImageUrl && (
        <div style={{ display: 'grid', justifyItems: 'center', gap: 8, marginBlockEnd: 8 }}>
          <img
            src={config.sampleImageUrl}
            alt="דוגמה"
            style={{ inlineSize: 'clamp(90px, 20vw, 160px)', blockSize: 'clamp(90px, 20vw, 160px)', objectFit: 'cover', borderRadius: 16, border: '3px solid var(--accent-2, #2f8f5b)' }}
          />
        </div>
      )}
      <OptionGrid>
        {config.options.map((option) => (
          <ImageCard
            key={option.id}
            src={option.imageUrl}
            label={option.label}
            selected={picked.includes(option.id)}
            disabled={disabled}
            onClick={() => toggle(option.id)}
          />
        ))}
      </OptionGrid>
      <SubmitButton disabled={disabled || picked.length === 0} onClick={() => onAnswer(picked)}>
        אישור
      </SubmitButton>
    </>
  );
}
