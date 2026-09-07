import { describe, expect, it } from 'vitest';
import { ageGroupOf, ageInYears } from './clock.js';

const now = new Date('2026-09-07T00:00:00Z');

describe('age derivation (§10.1)', () => {
  it('computes whole years', () => {
    expect(ageInYears(new Date('2021-09-07'), now)).toBe(5);
    expect(ageInYears(new Date('2021-09-08'), now)).toBe(4);
  });

  it('maps birth dates to Spec §9 age bands', () => {
    expect(ageGroupOf(new Date('2023-01-01'), now)).toBe('AGE_3_4');
    expect(ageGroupOf(new Date('2022-01-01'), now)).toBe('AGE_4_5');
    expect(ageGroupOf(new Date('2020-01-01'), now)).toBe('AGE_5_6');
  });
});
