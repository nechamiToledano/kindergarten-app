import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { ImageCard, OptionGrid } from '../ui';

type Config = Extract<GameConfig, { gameType: 'BINARY_IMAGE_CHOICE' }>;

/** Spec §4.1 — two images, tap the one matching the prompt. Answer: the option id. */
export function BinaryImageChoice({ config, disabled, onAnswer }: GameComponentProps<Config>) {
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
