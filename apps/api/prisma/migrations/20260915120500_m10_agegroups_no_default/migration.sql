-- The array default was only needed to backfill the NOT NULL column in place;
-- Prisma always sends the list explicitly, so leaving a DB-side default behind
-- would be permanent drift against the schema.
ALTER TABLE "Subdomain" ALTER COLUMN "ageGroups" DROP DEFAULT;
