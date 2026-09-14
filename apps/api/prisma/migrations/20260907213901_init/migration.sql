-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEACHER', 'KINDERGARTEN_ADMIN', 'NETWORK_ADMIN', 'CONTENT_EDITOR');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('AGE_3_4', 'AGE_4_5', 'AGE_5_6');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('PRESENT', 'PARTIALLY_PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('BINARY_IMAGE_CHOICE', 'MULTI_IMAGE_CHOICE', 'HOTSPOT_IMAGE', 'DRAG_MATCH', 'MANUAL_OBSERVATION');

-- CreateTable
CREATE TABLE "Network" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kindergarten" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "networkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Kindergarten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "kindergartenId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "kindergartenId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgeGroupDomain" (
    "id" TEXT NOT NULL,
    "ageGroup" "AgeGroup" NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AgeGroupDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subdomain" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "teacherInstruction" TEXT NOT NULL,
    "childInstruction" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "gameConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subdomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubdomainVersion" (
    "id" TEXT NOT NULL,
    "subdomainId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "gameType" "GameType" NOT NULL,
    "gameConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubdomainVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "kindergartenId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "ageGroupAtTime" "AgeGroup" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubdomainResult" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "subdomainId" TEXT NOT NULL,
    "subdomainVersionId" TEXT NOT NULL,
    "attemptsCount" INTEGER NOT NULL,
    "rating" "Rating" NOT NULL,
    "teacherNote" TEXT,
    "rawAnswers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubdomainResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Kindergarten_networkId_idx" ON "Kindergarten"("networkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_kindergartenId_idx" ON "User"("kindergartenId");

-- CreateIndex
CREATE INDEX "Child_kindergartenId_idx" ON "Child"("kindergartenId");

-- CreateIndex
CREATE INDEX "AgeGroupDomain_ageGroup_idx" ON "AgeGroupDomain"("ageGroup");

-- CreateIndex
CREATE INDEX "Subdomain_domainId_idx" ON "Subdomain"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "SubdomainVersion_subdomainId_version_key" ON "SubdomainVersion"("subdomainId", "version");

-- CreateIndex
CREATE INDEX "Session_kindergartenId_idx" ON "Session"("kindergartenId");

-- CreateIndex
CREATE INDEX "Session_childId_idx" ON "Session"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "SubdomainResult_clientId_key" ON "SubdomainResult"("clientId");

-- CreateIndex
CREATE INDEX "SubdomainResult_sessionId_idx" ON "SubdomainResult"("sessionId");

-- CreateIndex
CREATE INDEX "SubdomainResult_subdomainId_idx" ON "SubdomainResult"("subdomainId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Kindergarten" ADD CONSTRAINT "Kindergarten_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subdomain" ADD CONSTRAINT "Subdomain_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "AgeGroupDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubdomainVersion" ADD CONSTRAINT "SubdomainVersion_subdomainId_fkey" FOREIGN KEY ("subdomainId") REFERENCES "Subdomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubdomainResult" ADD CONSTRAINT "SubdomainResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubdomainResult" ADD CONSTRAINT "SubdomainResult_subdomainId_fkey" FOREIGN KEY ("subdomainId") REFERENCES "Subdomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubdomainResult" ADD CONSTRAINT "SubdomainResult_subdomainVersionId_fkey" FOREIGN KEY ("subdomainVersionId") REFERENCES "SubdomainVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
