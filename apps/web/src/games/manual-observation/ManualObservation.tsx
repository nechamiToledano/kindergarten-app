import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { SubmitButton } from '../ui';

type Config = Extract<GameConfig, { gameType: 'MANUAL_OBSERVATION' }>;

/**
 * Spec §18.1 q5 — physical / observation-only subdomains have no game. The
 * teacher observes the child directly and moves straight to the rating; the
 * plugin scores every answer as "correct" so the flow lands on RatingSuccess.
 */
export function ManualObservation({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  return (
    <div style={{ maxInlineSize: 640, textAlign: 'center' }}>
      <p style={{ fontSize: 22, marginBlockEnd: '1.5rem' }}>{config.observationPrompt}</p>
      <SubmitButton disabled={disabled} onClick={() => onAnswer(null)}>
        המשך לדירוג
      </SubmitButton>
    </div>
  );
}
