-- M5 (HLD §17) — register game types 4.5–4.8 as engine additions.
-- Content stays in the Jsonb gameConfig column, so no table changes are needed;
-- only the GameType enum gains the four new discriminants.
ALTER TYPE "GameType" ADD VALUE IF NOT EXISTS 'SEQUENTIAL_TAP';
ALTER TYPE "GameType" ADD VALUE IF NOT EXISTS 'COMPARISON';
ALTER TYPE "GameType" ADD VALUE IF NOT EXISTS 'PUZZLE';
ALTER TYPE "GameType" ADD VALUE IF NOT EXISTS 'PATTERN_COPY';
