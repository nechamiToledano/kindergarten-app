import { describe, expect, it } from 'vitest';
import { GameConfigSchema, PuzzleConfigSchema } from './game-config.js';
import { SubmitResultSchema } from './session.js';

describe('GameConfigSchema', () => {
  it('narrows on gameType', () => {
    const parsed = GameConfigSchema.parse({
      gameType: 'BINARY_IMAGE_CHOICE',
      promptAudioUrl: 'a.mp3',
      options: [
        { id: 'a', imageUrl: 'a.png' },
        { id: 'b', imageUrl: 'b.png' },
      ],
      correctOptionId: 'a',
    });
    expect(parsed.gameType).toBe('BINARY_IMAGE_CHOICE');
  });

  it('rejects an unknown game type', () => {
    expect(() => GameConfigSchema.parse({ gameType: 'NOPE' })).toThrow();
  });

  it('accepts the M5 game types (4.5–4.8)', () => {
    for (const gameType of ['SEQUENTIAL_TAP', 'COMPARISON', 'PUZZLE', 'PATTERN_COPY'] as const) {
      expect(GameConfigSchema.options.some((o) => o.shape.gameType.value === gameType)).toBe(true);
    }
  });
});

describe('PuzzleConfigSchema', () => {
  const base = {
    gameType: 'PUZZLE' as const,
    promptAudioUrl: 'p.mp3',
    imageUrl: 'img.png',
    rows: 2,
    cols: 3,
    pieceCount: 6 as const,
  };

  it('accepts a grid whose rows × cols equals pieceCount', () => {
    expect(() => PuzzleConfigSchema.parse(base)).not.toThrow();
  });

  it('rejects a grid that does not multiply out to pieceCount', () => {
    expect(() => PuzzleConfigSchema.parse({ ...base, pieceCount: 4 })).toThrow();
  });
});

describe('SubmitResultSchema', () => {
  const base = {
    clientId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    subdomainId: '33333333-3333-4333-8333-333333333333',
    subdomainVersionId: '44444444-4444-4444-8444-444444444444',
    rating: 'PRESENT' as const,
    rawAnswers: [],
  };

  it('allows a note only after three failed attempts', () => {
    expect(() =>
      SubmitResultSchema.parse({ ...base, attemptsCount: 1, teacherNote: 'x' }),
    ).toThrow();
    expect(
      SubmitResultSchema.parse({ ...base, attemptsCount: 3, teacherNote: 'x' }).teacherNote,
    ).toBe('x');
  });
});
