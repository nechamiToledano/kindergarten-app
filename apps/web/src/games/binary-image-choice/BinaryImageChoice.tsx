import { useEffect, useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { MAX_ATTEMPTS } from '@kga/game-engine';
import { ImageCard, OptionGrid } from '../ui';

type Config = Extract<GameConfig, { gameType: 'BINARY_IMAGE_CHOICE' }>;

/** Spec §4.1 — two images, tap the one matching the prompt. Answer: the option id. */
export function BinaryImageChoice({ config, disabled, instructionPlaying = false, attempt = 0, promptClipsDone = 0, onAnswer }: GameComponentProps<Config>) {
  // With `revealAfterAudio` the pictures appear once the first clip (the animal
  // sound) has finished, while the question is still being asked. On the last
  // attempt they are shown from the start.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!instructionPlaying) setRevealed(true);
  }, [instructionPlaying]);
  const hidden =
    Boolean(config.revealAfterAudio) && attempt < MAX_ATTEMPTS - 1 && !revealed && promptClipsDone < 1;

  return (
    <div style={{ opacity: hidden ? 0 : 1, transition: 'opacity 0.4s', pointerEvents: hidden ? 'none' : undefined }}>
    <OptionGrid>
      {config.options.map((option) => (
        <ImageCard
          key={option.id}
          src={option.imageUrl}
          label={option.label}
          disabled={disabled}
          onClick={() => onAnswer(option.id)}
        />
      ))}
    </OptionGrid>
    </div>
  );
}
