import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { ImageCard, OptionGrid } from '../ui';

type Config = Extract<GameConfig, { gameType: 'PATTERN_COPY' }>;

/** Spec §4.8 — odd-one-out. Tap the image that breaks the pattern. Answer: its id. */
export function PatternCopy({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  return (
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
  );
}
