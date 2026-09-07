import { Global, Injectable, Module } from '@nestjs/common';
import type { AgeGroup } from '@kga/contracts';

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

/** Spec §9 bands. Below 3 clamps to the youngest; 6+ clamps to the oldest. */
export function ageGroupOf(birthDate: Date, now: Date): AgeGroup {
  const age = ageInYears(birthDate, now);
  if (age <= 3) return 'AGE_3_4';
  if (age === 4) return 'AGE_4_5';
  return 'AGE_5_6';
}

@Global()
@Module({
  providers: [{ provide: CLOCK, useClass: SystemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
