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
      'PUZZLE',
      'SEQUENTIAL_TAP',
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
