import { describe, expect, it } from 'vitest';
import { GameConfigSchema } from '@kga/contracts';
import { createDefaultRegistry } from '@kga/game-engine';
import { CONTENT } from './content.js';

/**
 * §15 content-validation guardrail. Once content is data (§3.1) it can break
 * without the code changing — a typo'd id, a missing correct answer, a bad asset
 * reference. This is the test that catches it before a teacher does, in front of
 * a child.
 */
const registry = createDefaultRegistry();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const allSubdomains = CONTENT.flatMap((age) =>
  age.domains.flatMap((domain) =>
    domain.subdomains.map((sub) => ({ ageGroup: age.ageGroup, domain: domain.name, sub })),
  ),
);

describe('seeded content', () => {
  it('has unique, well-formed domain ids', () => {
    const ids = CONTENT.flatMap((a) => a.domains.map((d) => d.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(UUID);
  });

  it('has unique, well-formed subdomain ids', () => {
    const ids = allSubdomains.map((s) => s.sub.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(UUID);
  });

  it('covers every registered game type', () => {
    const used = new Set(allSubdomains.map((s) => s.sub.config.gameType));
    for (const plugin of registry.all()) {
      expect(used, `no seeded subdomain uses ${plugin.id}`).toContain(plugin.id);
    }
  });

  describe.each(allSubdomains)('$ageGroup · $domain · $sub.name', ({ sub }) => {
    const parsed = GameConfigSchema.parse(sub.config);
    const plugin = registry.get(parsed.gameType);

    it('parses under its plugin schema', () => {
      expect(() => plugin.configSchema.parse(sub.config)).not.toThrow();
    });

    it('has non-empty instructions', () => {
      expect(sub.teacherInstruction.trim().length).toBeGreaterThan(0);
      expect(sub.childInstruction.trim().length).toBeGreaterThan(0);
    });

    it('every asset it needs resolves', () => {
      for (const asset of plugin.assetsOf(sub.config as never)) {
        expect(asset.url.length).toBeGreaterThan(0);
        expect(
          asset.url.startsWith('data:') ||
            asset.url.startsWith('tone:') ||
            asset.url.startsWith('http') ||
            asset.url.startsWith('/assets/'), // real files served from apps/web/public
          `unresolvable ${asset.kind} asset: ${asset.url.slice(0, 40)}`,
        ).toBe(true);
      }
    });

    it('references only ids that exist in its own config', () => {
      const c = sub.config;
      if (c.gameType === 'BINARY_IMAGE_CHOICE') {
        expect(c.options.map((o) => o.id)).toContain(c.correctOptionId);
      }
      if (c.gameType === 'MULTI_IMAGE_CHOICE') {
        const ids = c.options.map((o) => o.id);
        for (const id of c.correctOptionIds) expect(ids).toContain(id);
      }
      if (c.gameType === 'HOTSPOT_IMAGE') {
        const ids = c.targets.map((t) => t.id);
        for (const id of c.correctTargetIds) expect(ids).toContain(id);
      }
      if (c.gameType === 'PATTERN_COPY') {
        expect(c.options.map((o) => o.id)).toContain(c.oddOneOutId);
      }
      if (c.gameType === 'SEQUENTIAL_TAP') {
        const ids = c.pads.map((p) => p.id);
        for (const id of c.correctSequence) expect(ids).toContain(id);
      }
      if (c.gameType === 'PUZZLE') {
        expect(c.rows * c.cols).toBe(c.pieceCount);
      }
      if (c.gameType === 'COMPARISON' && c.comparisonType === 'EQUAL') {
        expect(c.items[0].value).toBe(c.items[1].value);
      }
    });

    it('the intended answer actually scores correct', () => {
      const c = sub.config;
      const s = (answer: unknown) => plugin.score(sub.config as never, answer).correct;
      switch (c.gameType) {
        case 'BINARY_IMAGE_CHOICE':
          expect(s(c.correctOptionId)).toBe(true);
          break;
        case 'MULTI_IMAGE_CHOICE':
          expect(s(c.correctOptionIds)).toBe(true);
          break;
        case 'PATTERN_COPY':
          expect(s(c.oddOneOutId)).toBe(true);
          break;
        case 'SEQUENTIAL_TAP':
          expect(s(c.correctSequence)).toBe(true);
          break;
        case 'PUZZLE':
          expect(s(Array.from({ length: c.pieceCount }, (_, i) => i))).toBe(true);
          break;
        case 'COMPARISON': {
          const [a, b] = c.items;
          const answer =
            c.comparisonType === 'EQUAL'
              ? 'EQUAL'
              : c.comparisonType === 'BIGGER' || c.comparisonType === 'MORE'
                ? a.value > b.value
                  ? a.id
                  : b.id
                : a.value < b.value
                  ? a.id
                  : b.id;
          expect(s(answer)).toBe(true);
          break;
        }
        case 'HOTSPOT_IMAGE': {
          const t = c.targets.find((x) => c.correctTargetIds.includes(x.id))!;
          expect(s({ x: t.x + t.width / 2, y: t.y + t.height / 2 })).toBe(true);
          break;
        }
        case 'DRAG_MATCH':
          expect(s(c.pairs.map((p) => ({ sourceId: p.sourceId, targetId: p.targetId })))).toBe(true);
          break;
        case 'MANUAL_OBSERVATION':
          expect(s(null)).toBe(true);
          break;
      }
    });
  });
});
