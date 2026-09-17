-- M11 bugfix — a NETWORK_ADMIN has no kindergartenId, so `AuthService.networkIdFor`
-- (which only ever looks up a kindergarten's network) resolved every network
-- admin's networkId to null, making the role unusable end to end. This column
-- lets a NETWORK_ADMIN carry its network directly.
ALTER TABLE "User" ADD COLUMN "networkId" TEXT;
ALTER TABLE "User"
    ADD CONSTRAINT "User_networkId_fkey"
    FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_networkId_idx" ON "User"("networkId");

-- Backfill: attach every existing NETWORK_ADMIN to a network only when the
-- choice is unambiguous (exactly one network exists). A real multi-network
-- deployment would need this decided per-admin, not guessed by a migration.
UPDATE "User" u
SET "networkId" = (SELECT n."id" FROM "Network" n WHERE n."deletedAt" IS NULL)
WHERE u."role" = 'NETWORK_ADMIN'
  AND u."networkId" IS NULL
  AND (SELECT COUNT(*) FROM "Network" n WHERE n."deletedAt" IS NULL) = 1;
