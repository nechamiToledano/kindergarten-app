-- M11 — admin-editable system settings, additive only.
--
-- No default rows are seeded here: every consumer (e.g. the "needs attention"
-- threshold in analytics.service.ts) falls back to its existing hardcoded
-- default when a key is absent, so this migration changes no behaviour by
-- itself. A row only starts existing once someone edits it from /admin.
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
