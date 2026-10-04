-- Phase 11D durable Estimate attention and one-reminder follow-up scheduling.
-- Existing deliveries are manual by construction. This migration deliberately
-- creates no schedules for historical Estimate or delivery rows.

CREATE TYPE "EstimateDeliveryOrigin" AS ENUM ('MANUAL', 'AUTOMATED_FOLLOW_UP');

CREATE TYPE "EstimateFollowUpStatus" AS ENUM (
  'SCHEDULED',
  'PROCESSING',
  'DISPATCHED',
  'FAILED',
  'PERMANENTLY_FAILED',
  'CANCELED',
  'SKIPPED'
);

ALTER TABLE "EstimateDelivery"
ADD COLUMN "origin" "EstimateDeliveryOrigin" NOT NULL DEFAULT 'MANUAL';

CREATE UNIQUE INDEX "EstimateDelivery_id_workspace_estimate_key"
ON "EstimateDelivery"("id", "workspaceId", "estimateId");

CREATE UNIQUE INDEX "SimpleAutomationInstallation_id_workspace_key"
ON "SimpleAutomationInstallation"("id", "workspaceId");

CREATE UNIQUE INDEX "SimpleAutomationDispatch_id_workspace_key"
ON "SimpleAutomationDispatch"("id", "workspaceId");

CREATE UNIQUE INDEX "SimpleAutomationDispatch_id_workspace_run_key"
ON "SimpleAutomationDispatch"("id", "workspaceId", "runId");

CREATE UNIQUE INDEX "AutomationRun_id_workspace_key"
ON "AutomationRun"("id", "workspaceId");

CREATE TABLE "EstimateFollowUpSchedule" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "estimateId" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "sourceDeliveryId" TEXT NOT NULL,
  "reminderOrdinal" INTEGER NOT NULL DEFAULT 1,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "configurationFingerprint" TEXT NOT NULL,
  "status" "EstimateFollowUpStatus" NOT NULL DEFAULT 'SCHEDULED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "claimedBy" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "dispatchId" TEXT,
  "automationRunId" TEXT,
  "generatedDeliveryId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "cancellationReason" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "dispatchedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EstimateFollowUpSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EstimateFollowUpSchedule_ordinal_check" CHECK ("reminderOrdinal" = 1),
  CONSTRAINT "EstimateFollowUpSchedule_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "EstimateFollowUpSchedule_timezone_check" CHECK (length(btrim("timezone")) BETWEEN 1 AND 100),
  CONSTRAINT "EstimateFollowUpSchedule_fingerprint_check" CHECK (length(btrim("configurationFingerprint")) BETWEEN 16 AND 200),
  CONSTRAINT "EstimateFollowUpSchedule_idempotency_check" CHECK (length(btrim("idempotencyKey")) BETWEEN 1 AND 200),
  CONSTRAINT "EstimateFollowUpSchedule_claim_check" CHECK (
    ("status" = 'PROCESSING' AND "claimedAt" IS NOT NULL AND length(btrim("claimedBy")) > 0 AND "leaseExpiresAt" > "claimedAt")
    OR
    ("status" <> 'PROCESSING' AND "claimedAt" IS NULL AND "claimedBy" IS NULL AND "leaseExpiresAt" IS NULL)
  ),
  CONSTRAINT "EstimateFollowUpSchedule_dispatch_check" CHECK (
    "status" <> 'DISPATCHED'
    OR ("dispatchedAt" IS NOT NULL AND "dispatchId" IS NOT NULL AND "automationRunId" IS NOT NULL AND "generatedDeliveryId" IS NOT NULL)
  ),
  CONSTRAINT "EstimateFollowUpSchedule_cancel_check" CHECK (
    "status" <> 'CANCELED'
    OR ("canceledAt" IS NOT NULL AND length(btrim("cancellationReason")) > 0)
  ),
  CONSTRAINT "EstimateFollowUpSchedule_skip_check" CHECK (
    "status" <> 'SKIPPED'
    OR ("skippedAt" IS NOT NULL AND length(btrim("cancellationReason")) > 0)
  ),
  CONSTRAINT "EstimateFollowUpSchedule_failure_check" CHECK (
    "status" NOT IN ('FAILED', 'PERMANENTLY_FAILED')
    OR ("failedAt" IS NOT NULL AND length(btrim("lastErrorCode")) > 0 AND length(btrim("lastErrorMessage")) > 0)
  ),
  CONSTRAINT "EstimateFollowUpSchedule_retry_check" CHECK (
    ("status" = 'FAILED' AND "nextAttemptAt" IS NOT NULL)
    OR ("status" <> 'FAILED' AND "nextAttemptAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "EstimateFollowUpSchedule_generatedDeliveryId_key"
ON "EstimateFollowUpSchedule"("generatedDeliveryId");

CREATE UNIQUE INDEX "EstimateFollowUpSchedule_generated_workspace_estimate_key"
ON "EstimateFollowUpSchedule"("generatedDeliveryId", "workspaceId", "estimateId");

CREATE UNIQUE INDEX "EstimateFollowUpSchedule_workspace_idempotency_key"
ON "EstimateFollowUpSchedule"("workspaceId", "idempotencyKey");

CREATE UNIQUE INDEX "EstimateFollowUpSchedule_logical_identity_key"
ON "EstimateFollowUpSchedule"("installationId", "sourceDeliveryId", "reminderOrdinal");

CREATE INDEX "EstimateFollowUpSchedule_status_due_idx"
ON "EstimateFollowUpSchedule"("status", "dueAt");

CREATE INDEX "EstimateFollowUpSchedule_status_lease_idx"
ON "EstimateFollowUpSchedule"("status", "leaseExpiresAt");

CREATE INDEX "EstimateFollowUpSchedule_workspace_status_due_idx"
ON "EstimateFollowUpSchedule"("workspaceId", "status", "dueAt");

CREATE INDEX "EstimateFollowUpSchedule_workspace_estimate_status_idx"
ON "EstimateFollowUpSchedule"("workspaceId", "estimateId", "status");

CREATE INDEX "EstimateFollowUpSchedule_installation_status_idx"
ON "EstimateFollowUpSchedule"("installationId", "status");

CREATE INDEX "EstimateFollowUpSchedule_source_delivery_idx"
ON "EstimateFollowUpSchedule"("sourceDeliveryId");

ALTER TABLE "EstimateFollowUpSchedule" ADD CONSTRAINT "EstimateFollowUpSchedule_workspace_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateFollowUpSchedule" ADD CONSTRAINT "EstimateFollowUpSchedule_estimate_fkey"
FOREIGN KEY ("estimateId", "workspaceId") REFERENCES "Estimate"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateFollowUpSchedule" ADD CONSTRAINT "EstimateFollowUpSchedule_installation_fkey"
FOREIGN KEY ("installationId", "workspaceId") REFERENCES "SimpleAutomationInstallation"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateFollowUpSchedule" ADD CONSTRAINT "EstimateFollowUpSchedule_source_delivery_fkey"
FOREIGN KEY ("sourceDeliveryId", "workspaceId", "estimateId") REFERENCES "EstimateDelivery"("id", "workspaceId", "estimateId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateFollowUpSchedule" ADD CONSTRAINT "EstimateFollowUpSchedule_generated_delivery_fkey"
FOREIGN KEY ("generatedDeliveryId", "workspaceId", "estimateId") REFERENCES "EstimateDelivery"("id", "workspaceId", "estimateId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateFollowUpSchedule" ADD CONSTRAINT "EstimateFollowUpSchedule_dispatch_run_fkey"
FOREIGN KEY ("dispatchId", "workspaceId", "automationRunId") REFERENCES "SimpleAutomationDispatch"("id", "workspaceId", "runId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateFollowUpSchedule" ADD CONSTRAINT "EstimateFollowUpSchedule_run_fkey"
FOREIGN KEY ("automationRunId", "workspaceId") REFERENCES "AutomationRun"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;
