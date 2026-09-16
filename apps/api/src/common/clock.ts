import { Global, Injectable, Module } from '@nestjs/common';
import { SETTINGS_REGISTRY, type AgeBands, type AgeGroup } from '@kga/contracts';

const DEFAULT_AGE_BANDS = SETTINGS_REGISTRY['assessment.ageBands'].default;

/** Testable time source (§3.3) — age-group derivation depends on "now". */
export const CLOCK = Symbol('ClockPort');

export interface ClockPort {
  now(): Date;
}

@Injectable()
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}

export function ageInYears(birthDate: Date, now: Date): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

/**
 * Spec §9 bands. Below the youngest cutoff clamps to AGE_3_4; at or above the
 * oldest cutoff clamps to AGE_5_6. `bands` is admin-configurable (M11,
 * `assessment.ageBands` in SettingsService) — the caller reads it once per
 * request and passes it in, same pattern as `AnalyticsService.status`.
 */
export function ageGroupOf(birthDate: Date, now: Date, bands: AgeBands = DEFAULT_AGE_BANDS): AgeGroup {
  const age = ageInYears(birthDate, now);
  if (age < bands.band2MinAge) return 'AGE_3_4';
  if (age < bands.band3MinAge) return 'AGE_4_5';
  return 'AGE_5_6';
}

/**
 * The birthDate window that puts a child in `ageGroup` as of `now` — the SQL
 * form of `ageGroupOf`.
 *
 * The roster used to filter by age band in Node, after fetching every child, so
 * the filter could not be combined with pagination without misreporting the
 * total. Expressed as a date range it pushes down to an index instead.
 *
 * Boundaries follow `ageGroupOf` exactly: a child is `band2MinAge` once their
 * birthDate is at or before "`band2MinAge` years ago", which is why the bounds
 * are lte/gt rather than a symmetric pair. `bands` must match whatever was
 * passed to `ageGroupOf` for the same request — see its doc comment.
 */
export function birthDateRangeFor(
  ageGroup: AgeGroup,
  now: Date,
  bands: AgeBands = DEFAULT_AGE_BANDS,
): { gt?: Date; lte?: Date } {
  const yearsAgo = (years: number): Date => {
    const date = new Date(now);
    date.setUTCFullYear(date.getUTCFullYear() - years);
    return date;
  };
  const band2CutoffDate = yearsAgo(bands.band2MinAge);
  const band3CutoffDate = yearsAgo(bands.band3MinAge);

  if (ageGroup === 'AGE_3_4') return { gt: band2CutoffDate };
  if (ageGroup === 'AGE_4_5') return { gt: band3CutoffDate, lte: band2CutoffDate };
  return { lte: band3CutoffDate };
}

@Global()
@Module({
  providers: [{ provide: CLOCK, useClass: SystemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
