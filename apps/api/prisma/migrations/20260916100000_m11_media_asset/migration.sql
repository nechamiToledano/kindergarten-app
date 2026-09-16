-- M11 — the asset library catalogue. Additive only; existing uploads (referenced
-- by URL directly from Subdomain.gameConfig) are untouched and keep working
-- whether or not they ever get a row here.
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalName" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_key_key" ON "MediaAsset"("key");
CREATE INDEX "MediaAsset_kind_createdAt_idx" ON "MediaAsset"("kind", "createdAt");
