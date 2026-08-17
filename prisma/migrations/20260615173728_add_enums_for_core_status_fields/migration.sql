/*
  Warnings:

  - The `status` column on the `BuildRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `status` on the `Integration` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `plan` on the `Subscription` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `Subscription` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('Free', 'Basic', 'Pro', 'Elite');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'canceled', 'past_due', 'trialing');

-- CreateEnum
CREATE TYPE "BuildRequestStatus" AS ENUM ('NEW', 'REVIEWING', 'CLOSED');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('connected', 'disconnected', 'error');

-- CreateEnum
CREATE TYPE "AutomationServiceScope" AS ENUM ('SECURITY_PACK_DELIVERY', 'ENTITLEMENT_ADMIN');

-- CreateEnum
CREATE TYPE "AutomationServiceSystem" AS ENUM ('N8N', 'SKILLIFY', 'OTHER');

-- CreateEnum
CREATE TYPE "EntitlementAuditAction" AS ENUM ('GRANTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EntitlementAuditSource" AS ENUM ('CONTRACT', 'AMENDMENT', 'EXCEPTION', 'RENEWAL');

-- CreateEnum
CREATE TYPE "EntitlementAuditActorType" AS ENUM ('SYSTEM', 'SALES_OPS', 'LEGAL', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "TemplateVisibility" AS ENUM ('PUBLIC', 'WORKSPACE', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PatternVisibility" AS ENUM ('WORKSPACE', 'PRIVATE');

-- AlterTable
ALTER TABLE "Automation" ADD COLUMN     "forkedAt" TIMESTAMP(3),
ADD COLUMN     "forkedBy" TEXT,
ADD COLUMN     "forkedFromId" TEXT;

-- AlterTable
UPDATE "BuildRequest"
SET "status" = CASE
    WHEN upper(trim("status")) = 'REVIEWING' THEN 'REVIEWING'
    WHEN upper(trim("status")) = 'CLOSED' THEN 'CLOSED'
    ELSE 'NEW'
END;

ALTER TABLE "BuildRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BuildRequest" ALTER COLUMN "status" TYPE "BuildRequestStatus" USING "status"::"BuildRequestStatus";
ALTER TABLE "BuildRequest" ALTER COLUMN "status" SET DEFAULT 'NEW';

-- AlterTable
UPDATE "Integration"
SET "status" = CASE
    WHEN lower(trim("status")) = 'connected' THEN 'connected'
    WHEN lower(trim("status")) = 'error' THEN 'error'
    ELSE 'disconnected'
END;

ALTER TABLE "Integration" ALTER COLUMN "status" TYPE "IntegrationStatus" USING "status"::"IntegrationStatus";

-- AlterTable
ALTER TABLE "SecurityPackAuditEvent" ADD COLUMN     "correlationId" TEXT;

-- AlterTable
UPDATE "Subscription"
SET "plan" = CASE
    WHEN lower(trim("plan")) = 'elite' THEN 'Elite'
    WHEN lower(trim("plan")) = 'pro' THEN 'Pro'
    WHEN lower(trim("plan")) = 'basic' THEN 'Basic'
    ELSE 'Free'
END;

UPDATE "Subscription"
SET "status" = CASE
    WHEN lower(trim("status")) = 'canceled' THEN 'canceled'
    WHEN lower(trim("status")) = 'cancelled' THEN 'canceled'
    WHEN lower(trim("status")) = 'past_due' THEN 'past_due'
    WHEN lower(trim("status")) = 'trialing' THEN 'trialing'
    ELSE 'active'
END;

ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "SubscriptionPlan" USING "plan"::"SubscriptionPlan";
ALTER TABLE "Subscription" ALTER COLUMN "status" TYPE "SubscriptionStatus" USING "status"::"SubscriptionStatus";

-- CreateTable
CREATE TABLE "WorkspaceDefaults" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "namePrefix" TEXT,
    "retryCount" INTEGER,
    "timeoutMs" INTEGER,
    "aiModel" TEXT,
    "requiresApproval" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceDefaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractEntitlement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entitlementKey" TEXT NOT NULL,
    "source" "EntitlementAuditSource" NOT NULL DEFAULT 'CONTRACT',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractException" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entitlementKey" TEXT NOT NULL,
    "source" "EntitlementAuditSource" NOT NULL DEFAULT 'EXCEPTION',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementAuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entitlementKey" TEXT NOT NULL,
    "action" "EntitlementAuditAction" NOT NULL,
    "source" "EntitlementAuditSource" NOT NULL,
    "actorType" "EntitlementAuditActorType" NOT NULL,
    "actorId" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationServiceToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" "AutomationServiceScope"[],
    "system" "AutomationServiceSystem" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationServiceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "visibility" "TemplateVisibility" NOT NULL DEFAULT 'PUBLIC',
    "flow" JSONB NOT NULL,
    "flowVersion" INTEGER NOT NULL DEFAULT 1,
    "readOnly" BOOLEAN NOT NULL DEFAULT true,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspacePattern" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "visibility" "PatternVisibility" NOT NULL DEFAULT 'WORKSPACE',
    "snapshot" JSONB NOT NULL,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "nodeCount" INTEGER,
    "inputHints" JSONB,
    "outputHints" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspacePattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLineage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "forkedFromId" TEXT,
    "templateId" TEXT,
    "demoFlowId" TEXT,
    "forkedById" TEXT,
    "forkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "objectId" TEXT,
    "objectType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceSecret" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "SecretVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceDefaults_workspaceId_key" ON "WorkspaceDefaults"("workspaceId");

-- CreateIndex
CREATE INDEX "ContractEntitlement_workspaceId_entitlementKey_idx" ON "ContractEntitlement"("workspaceId", "entitlementKey");

-- CreateIndex
CREATE INDEX "ContractEntitlement_workspaceId_effectiveAt_idx" ON "ContractEntitlement"("workspaceId", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractEntitlement_workspaceId_entitlementKey_effectiveAt_key" ON "ContractEntitlement"("workspaceId", "entitlementKey", "effectiveAt");

-- CreateIndex
CREATE INDEX "ContractException_workspaceId_entitlementKey_idx" ON "ContractException"("workspaceId", "entitlementKey");

-- CreateIndex
CREATE INDEX "ContractException_workspaceId_effectiveAt_idx" ON "ContractException"("workspaceId", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractException_workspaceId_entitlementKey_effectiveAt_key" ON "ContractException"("workspaceId", "entitlementKey", "effectiveAt");

-- CreateIndex
CREATE INDEX "EntitlementAuditEvent_workspaceId_createdAt_idx" ON "EntitlementAuditEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "EntitlementAuditEvent_workspaceId_entitlementKey_createdAt_idx" ON "EntitlementAuditEvent"("workspaceId", "entitlementKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationServiceToken_tokenHash_key" ON "AutomationServiceToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AutomationServiceToken_active_system_idx" ON "AutomationServiceToken"("active", "system");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationTemplate_slug_key" ON "AutomationTemplate"("slug");

-- CreateIndex
CREATE INDEX "AutomationTemplate_workspaceId_idx" ON "AutomationTemplate"("workspaceId");

-- CreateIndex
CREATE INDEX "AutomationTemplate_category_idx" ON "AutomationTemplate"("category");

-- CreateIndex
CREATE INDEX "WorkspacePattern_workspaceId_idx" ON "WorkspacePattern"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationLineage_automationId_key" ON "AutomationLineage"("automationId");

-- CreateIndex
CREATE INDEX "AutomationLineage_workspaceId_idx" ON "AutomationLineage"("workspaceId");

-- CreateIndex
CREATE INDEX "AutomationLineage_forkedFromId_idx" ON "AutomationLineage"("forkedFromId");

-- CreateIndex
CREATE INDEX "AutomationLineage_templateId_idx" ON "AutomationLineage"("templateId");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceSecret_workspaceId_alias_idx" ON "WorkspaceSecret"("workspaceId", "alias");

-- CreateIndex
CREATE INDEX "SecretVersion_workspaceId_secretId_createdAt_idx" ON "SecretVersion"("workspaceId", "secretId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityPackAuditEvent_correlationId_idx" ON "SecurityPackAuditEvent"("correlationId");

-- AddForeignKey
ALTER TABLE "WorkspaceDefaults" ADD CONSTRAINT "WorkspaceDefaults_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEntitlement" ADD CONSTRAINT "ContractEntitlement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractException" ADD CONSTRAINT "ContractException_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementAuditEvent" ADD CONSTRAINT "EntitlementAuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTemplate" ADD CONSTRAINT "AutomationTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTemplate" ADD CONSTRAINT "AutomationTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePattern" ADD CONSTRAINT "WorkspacePattern_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePattern" ADD CONSTRAINT "WorkspacePattern_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLineage" ADD CONSTRAINT "AutomationLineage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLineage" ADD CONSTRAINT "AutomationLineage_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLineage" ADD CONSTRAINT "AutomationLineage_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLineage" ADD CONSTRAINT "AutomationLineage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AutomationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLineage" ADD CONSTRAINT "AutomationLineage_forkedById_fkey" FOREIGN KEY ("forkedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSecret" ADD CONSTRAINT "WorkspaceSecret_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretVersion" ADD CONSTRAINT "SecretVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretVersion" ADD CONSTRAINT "SecretVersion_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "WorkspaceSecret"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretVersion" ADD CONSTRAINT "SecretVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
