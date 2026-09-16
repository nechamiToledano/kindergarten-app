-- M10 §3 — the second half of the result-table denormalisation.
--
-- Every report asks for "the latest result per child per subdomain". Reaching the
-- child through Session made that a join on every query; with the column here it
-- is one indexed DISTINCT ON. Immutable: a session never changes child.
ALTER TABLE "SubdomainResult" ADD COLUMN "childId" TEXT;

UPDATE "SubdomainResult" r
SET "childId" = s."childId"
FROM "Session" s
WHERE r."sessionId" = s."id";

ALTER TABLE "SubdomainResult" ALTER COLUMN "childId" SET NOT NULL;
ALTER TABLE "SubdomainResult"
    ADD CONSTRAINT "SubdomainResult_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SubdomainResult_childId_subdomainId_createdAt_idx"
    ON "SubdomainResult"("childId", "subdomainId", "createdAt");
