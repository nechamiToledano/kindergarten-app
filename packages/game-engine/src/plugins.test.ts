import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from './plugins.js';

const registry = createDefaultRegistry();

describe('game plugins', () => {
  it('registers every game-type plugin', () => {
    expect(registry.all().map((p) => p.id).sort()).toEqual([
      'BINARY_IMAGE_CHOICE',
      'COMPARISON',
      'DRAG_MATCH',
      'HOTSPOT_IMAGE',
      'MANUAL_OBSERVATION',
      'MULTI_IMAGE_CHOICE',
      'PATTERN_COPY',
      'PATTERN_SEQUENCE',
      'PUZZLE',
      'SEQUENTIAL_TAP',
      'SYLLABLE_COUNT',
    ]);
  });

  it('scores a binary image choice', () => {
    const p = registry.get('BINARY_IMAGE_CHOICE');
    const config = {
      gameType: 'BINARY_IMAGE_CHOICE' as const,
      promptAudioUrl: 'p.mp3',
      options: [
        { id: 'a', imageUrl: 'a.png' },
        { id: 'b', imageUrl: 'b.png' },
      ] as [{ id: string; imageUrl: string }, { id: string; imageUrl: string }],
      correctOptionId: 'b',
    };
    expect(p.score(config, 'b').correct).toBe(true);
    expect(p.score(config, 'a').correct).toBe(false);
    expect(p.assetsOf(config)).toHaveLength(3);
  });

  it('hit-tests a hotspot', () => {
    const p = registry.get('HOTSPOT_IMAGE');
    const config = {
      gameType: 'HOTSPOT_IMAGE' as const,
      promptAudioUrl: 'p.mp3',
      imageUrl: 'scene.png',
      targets: [{ id: 't1', x: 0.1, y: 0.1, width: 0.2, height: 0.2 }],
      correctTargetIds: ['t1'],
    };
    expect(p.score(config, { x: 0.2, y: 0.2 }).correct).toBe(true);
    expect(p.score(config, { x: 0.9, y: 0.9 }).correct).toBe(false);
  });

  it('scores a sequential tap in order', () => {
    const p = registry.get('SEQUENTIAL_TAP');
    const config = {
      gameType: 'SEQUENTIAL_TAP' as const,
      promptAudioUrl: 'p.mp3',
      pads: [
        { id: 'red', color: '#f00' },
        { id: 'blue', color: '#00f' },
      ],
      correctSequence: ['red', 'blue', 'red'],
    };
    expect(p.score(config, ['red', 'blue', 'red']).correct).toBe(true);
    expect(p.score(config, ['red', 'red', 'blue']).correct).toBe(false);
    expect(p.score(config, ['red', 'blue']).correct).toBe(false);
  });

  it('scores a comparison by value', () => {
    const p = registry.get('COMPARISON');
    const base = {
      gameType: 'COMPARISON' as const,
      promptAudioUrl: 'p.mp3',
      items: [
        { id: 'a', imageUrl: 'a.png', value: 5 },
        { id: 'b', imageUrl: 'b.png', value: 2 },
      ] as [
        { id: string; imageUrl: string; value: number },
        { id: string; imageUrl: string; value: number },
      ],
    };
    expect(p.score({ ...base, comparisonType: 'BIGGER' }, 'a').correct).toBe(true);
    expect(p.score({ ...base, comparisonType: 'FEWER' }, 'b').correct).toBe(true);
    expect(p.score({ ...base, comparisonType: 'EQUAL' }, 'EQUAL').correct).toBe(false);
    // An EQUAL-type trial with genuinely unequal items accepts picking the
    // larger group as correct — it's a decoy round, not an impossible one.
    expect(p.score({ ...base, comparisonType: 'EQUAL' }, 'a').correct).toBe(true);
    expect(p.score({ ...base, comparisonType: 'EQUAL' }, 'b').correct).toBe(false);
    const equal = { ...base, items: [{ ...base.items[0], value: 3 }, { ...base.items[1], value: 3 }] as typeof base.items };
    expect(p.score({ ...equal, comparisonType: 'EQUAL' }, 'EQUAL').correct).toBe(true);
  });

  it('scores a puzzle only when every slot holds its own piece', () => {
    const p = registry.get('PUZZLE');
    const config = {
      gameType: 'PUZZLE' as const,
      promptAudioUrl: 'p.mp3',
      imageUrl: 'img.png',
      rows: 2,
      cols: 2,
      pieceCount: 4 as const,
    };
    expect(p.score(config, [0, 1, 2, 3]).correct).toBe(true);
    expect(p.score(config, [1, 0, 2, 3]).correct).toBe(false);
  });

  it('scores a drag match in EXACT mode only for the declared pairing', () => {
    const p = registry.get('DRAG_MATCH');
    const config = {
      gameType: 'DRAG_MATCH' as const,
      promptAudioUrl: 'p.mp3',
      matchMode: 'EXACT' as const,
      pairs: [
        { sourceId: 's1', sourceImageUrl: 's1.png', targetId: 't1', targetImageUrl: 't1.png' },
        { sourceId: 's2', sourceImageUrl: 's2.png', targetId: 't2', targetImageUrl: 't2.png' },
      ],
    };
    expect(
      p.score(config, [{ sourceId: 's1', targetId: 't1' }, { sourceId: 's2', targetId: 't2' }]).correct,
    ).toBe(true);
    expect(
      p.score(config, [{ sourceId: 's1', targetId: 't2' }, { sourceId: 's2', targetId: 't1' }]).correct,
    ).toBe(false);
  });

  it('scores a drag match in BIJECTION mode for any valid one-to-one assignment', () => {
    const p = registry.get('DRAG_MATCH');
    const config = {
      gameType: 'DRAG_MATCH' as const,
      promptAudioUrl: 'p.mp3',
      matchMode: 'BIJECTION' as const,
      pairs: [
        { sourceId: 'milk', sourceImageUrl: 'milk.png', targetId: 'cart1', targetImageUrl: 'cart.png' },
        { sourceId: 'bread', sourceImageUrl: 'bread.png', targetId: 'cart2', targetImageUrl: 'cart.png' },
      ],
    };
    // Any 1:1 assignment is correct, not just the declared pairing.
    expect(
      p.score(config, [{ sourceId: 'milk', targetId: 'cart2' }, { sourceId: 'bread', targetId: 'cart1' }])
        .correct,
    ).toBe(true);
    // Both sources on the same cart leaves one cart empty — wrong.
    expect(
      p.score(config, [{ sourceId: 'milk', targetId: 'cart1' }, { sourceId: 'bread', targetId: 'cart1' }])
        .correct,
    ).toBe(false);
  });

  it('scores a drag match in BIJECTION mode with maxPerTarget > 1', () => {
    const p = registry.get('DRAG_MATCH');
    const config = {
      gameType: 'DRAG_MATCH' as const,
      promptAudioUrl: 'p.mp3',
      matchMode: 'BIJECTION' as const,
      maxPerTarget: 2,
      pairs: [
        { sourceId: 'milk', sourceImageUrl: 'a.png', targetId: 'cart1', targetImageUrl: 'c.png' },
        { sourceId: 'bread', sourceImageUrl: 'b.png', targetId: 'cart1', targetImageUrl: 'c.png' },
      ],
    };
    expect(
      p.score(config, [{ sourceId: 'milk', targetId: 'cart1' }, { sourceId: 'bread', targetId: 'cart1' }])
        .correct,
    ).toBe(true);
  });

  it('scores syllable count correct only when exactly slotCount tokens are placed, decoy included', () => {
    const p = registry.get('SYLLABLE_COUNT');
    const config = {
      gameType: 'SYLLABLE_COUNT' as const,
      promptAudioUrl: 'p.mp3',
      wordImageUrl: 'banana.png',
      slotCount: 3,
      tokenCount: 4,
    };
    expect(p.score(config, ['slot-0', 'slot-1', 'slot-2']).correct).toBe(true);
    expect(p.score(config, ['slot-0', 'slot-1']).correct).toBe(false);
    expect(p.score(config, ['slot-0', 'slot-1', 'slot-2', 'slot-2']).correct).toBe(true);
  });

  it('scores a pattern sequence continuation in order', () => {
    const p = registry.get('PATTERN_SEQUENCE');
    const config = {
      gameType: 'PATTERN_SEQUENCE' as const,
      promptAudioUrl: 'p.mp3',
      palette: [
        { id: 'red', color: '#f00' },
        { id: 'yellow', color: '#ff0' },
      ],
      prefix: ['red', 'yellow', 'red', 'yellow', 'red'],
      blankCount: 4,
      correctContinuation: ['yellow', 'red', 'yellow', 'red'],
    };
    expect(p.score(config, ['yellow', 'red', 'yellow', 'red']).correct).toBe(true);
    expect(p.score(config, ['red', 'yellow', 'red', 'yellow']).correct).toBe(false);
  });

  it('scores odd-one-out', () => {
    const p = registry.get('PATTERN_COPY');
    const config = {
      gameType: 'PATTERN_COPY' as const,
      promptAudioUrl: 'p.mp3',
      options: [
        { id: 'a', imageUrl: 'a.png' },
        { id: 'b', imageUrl: 'b.png' },
        { id: 'c', imageUrl: 'c.png' },
      ],
      oddOneOutId: 'c',
    };
    expect(p.score(config, 'c').correct).toBe(true);
    expect(p.score(config, 'a').correct).toBe(false);
  });
});
