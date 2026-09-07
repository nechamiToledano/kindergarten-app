import { describe, expect, it } from 'vitest';
import { GameConfigSchema } from './game-config.js';
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
