import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from './plugins.js';

const registry = createDefaultRegistry();

describe('game plugins', () => {
  it('registers the five MVP plugins', () => {
    expect(registry.all().map((p) => p.id).sort()).toEqual([
      'BINARY_IMAGE_CHOICE',
      'DRAG_MATCH',
      'HOTSPOT_IMAGE',
      'MANUAL_OBSERVATION',
      'MULTI_IMAGE_CHOICE',
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
});
