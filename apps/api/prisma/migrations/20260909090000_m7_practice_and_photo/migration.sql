-- M7 (HLD §17, docs/M7-UX-EXPANSION.md §3.2, §3.4) — two additive, non-breaking changes:
-- 1. Child.photoUrl — optional, for the richer children screen's Avatar component.
-- 2. Session.mode — ASSESSMENT (default, preserves existing behaviour) | PRACTICE,
--    so the new free-play mode never contaminates diagnostic reports.

ALTER TABLE "Child" ADD COLUMN "photoUrl" TEXT;

CREATE TYPE "SessionMode" AS ENUM ('ASSESSMENT', 'PRACTICE');

ALTER TABLE "Session" ADD COLUMN "mode" "SessionMode" NOT NULL DEFAULT 'ASSESSMENT';
