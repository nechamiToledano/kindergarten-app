-- M10 — the redesign's data model.
--
-- Data-preserving by construction: every statement below either adds a column,
-- backfills it from a row that already exists, or repoints a foreign key. No
-- Child, Session, Subdomain, SubdomainVersion or SubdomainResult row is deleted,
-- so the 74 config snapshots and the results measured against them stay intact.

-- ---------------------------------------------------------------------------
-- 1. Teacher-set follow-up flag, and an explicit "ended early" session state.
-- ---------------------------------------------------------------------------
ALTER TABLE "Child" ADD COLUMN "watch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Session" ADD COLUMN "abandonedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- 2. AgeGroupDomain -> Domain.
--
-- AgeGroupDomain carried an ageGroup column, so one real developmental area
-- existed as up to three unrelated rows. A child crossing an age band therefore
-- changed domain id, breaking progression exactly where it matters. Age moves
-- onto the subdomain, which is where it actually varies.
-- ---------------------------------------------------------------------------
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Domain_slug_key" ON "Domain"("slug");

-- One Domain per distinct name, keeping the lowest orderIndex the name had in
-- any band. Slugs and icons for the seeded areas are explicit; anything a
-- content editor added since gets a deterministic fallback rather than failing.
INSERT INTO "Domain" ("id", "slug", "name", "icon", "orderIndex", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    COALESCE(
        CASE g."name"
            WHEN 'מודעות פונולוגית' THEN 'phono'
            WHEN 'תפיסה שמיעתית' THEN 'auditory'
            WHEN 'תפיסה חזותית' THEN 'visual'
            WHEN 'חשבון' THEN 'math'
            WHEN 'שפה ואוצר מילים' THEN 'lang'
            WHEN 'מוטוריקה' THEN 'motor'
        END,
        'domain-' || substr(md5(g."name"), 1, 8)
    ),
    g."name",
    CASE g."name"
        WHEN 'מודעות פונולוגית' THEN 'audio-lines'
        WHEN 'תפיסה שמיעתית' THEN 'ear'
        WHEN 'תפיסה חזותית' THEN 'eye'
        WHEN 'חשבון' THEN 'calculator'
        WHEN 'שפה ואוצר מילים' THEN 'messages-square'
        WHEN 'מוטוריקה' THEN 'activity'
    END,
    g."orderIndex",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT "name", MIN("orderIndex") AS "orderIndex"
    FROM "AgeGroupDomain"
    WHERE "deletedAt" IS NULL
    GROUP BY "name"
) g;

-- ---------------------------------------------------------------------------
-- 3. Subdomain gains age bands and a difficulty level, then repoints to Domain.
-- ---------------------------------------------------------------------------
ALTER TABLE "Subdomain" ADD COLUMN "ageGroups" "AgeGroup"[] NOT NULL DEFAULT ARRAY[]::"AgeGroup"[];
ALTER TABLE "Subdomain" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;

-- Each subdomain inherits the single band its old parent domain stood for.
UPDATE "Subdomain" s
SET "ageGroups" = ARRAY[g."ageGroup"]
FROM "AgeGroupDomain" g
WHERE s."domainId" = g."id";

ALTER TABLE "Subdomain" DROP CONSTRAINT "Subdomain_domainId_fkey";

UPDATE "Subdomain" s
SET "domainId" = d."id"
FROM "AgeGroupDomain" g
JOIN "Domain" d ON d."name" = g."name"
WHERE s."domainId" = g."id";

ALTER TABLE "Subdomain"
    ADD CONSTRAINT "Subdomain_domainId_fkey"
    FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Subdomain_level_idx" ON "Subdomain"("level");

DROP INDEX "AgeGroupDomain_ageGroup_idx";
DROP TABLE "AgeGroupDomain";

-- ---------------------------------------------------------------------------
-- 4. SubdomainResult carries its tenant directly.
--
-- Until now the only thing keeping one kindergarten's results out of another's
-- reports was every report query remembering to write session.kindergartenId by
-- hand. With the column here, the Prisma tenant extension scopes this table the
-- same way it already scopes Child and Session, and reports stop joining Session
-- purely in order to filter.
-- ---------------------------------------------------------------------------
ALTER TABLE "SubdomainResult" ADD COLUMN "kindergartenId" TEXT;

UPDATE "SubdomainResult" r
SET "kindergartenId" = s."kindergartenId"
FROM "Session" s
WHERE r."sessionId" = s."id";

ALTER TABLE "SubdomainResult" ALTER COLUMN "kindergartenId" SET NOT NULL;
ALTER TABLE "SubdomainResult"
    ADD CONSTRAINT "SubdomainResult_kindergartenId_fkey"
    FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SubdomainResult_kindergartenId_idx" ON "SubdomainResult"("kindergartenId");
CREATE INDEX "SubdomainResult_kindergartenId_subdomainId_createdAt_idx"
    ON "SubdomainResult"("kindergartenId", "subdomainId", "createdAt");

-- ---------------------------------------------------------------------------
-- 5. An assessment is planned up front.
-- ---------------------------------------------------------------------------
CREATE TYPE "PlanItemStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

CREATE TABLE "SessionPlanItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "subdomainId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "status" "PlanItemStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SessionPlanItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SessionPlanItem_sessionId_subdomainId_key" ON "SessionPlanItem"("sessionId", "subdomainId");
CREATE INDEX "SessionPlanItem_sessionId_idx" ON "SessionPlanItem"("sessionId");

ALTER TABLE "SessionPlanItem"
    ADD CONSTRAINT "SessionPlanItem_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionPlanItem"
    ADD CONSTRAINT "SessionPlanItem_subdomainId_fkey"
    FOREIGN KEY ("subdomainId") REFERENCES "Subdomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sessions that predate planning get a plan reconstructed from what they
-- actually recorded, so "3 of 3 completed" is true for them rather than empty.
INSERT INTO "SessionPlanItem" ("id", "sessionId", "subdomainId", "orderIndex", "status", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    grouped."sessionId",
    grouped."subdomainId",
    (ROW_NUMBER() OVER (PARTITION BY grouped."sessionId" ORDER BY grouped."firstAt"))::int - 1,
    'DONE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT "sessionId", "subdomainId", MIN("createdAt") AS "firstAt"
    FROM "SubdomainResult"
    GROUP BY "sessionId", "subdomainId"
) grouped;

-- ---------------------------------------------------------------------------
-- 6. Indexes for the windows the dashboard and reports actually scan.
-- ---------------------------------------------------------------------------
CREATE INDEX "Session_kindergartenId_mode_startedAt_idx" ON "Session"("kindergartenId", "mode", "startedAt");
