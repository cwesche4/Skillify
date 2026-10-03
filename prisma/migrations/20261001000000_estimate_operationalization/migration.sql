-- Phase 11B accepted Estimate to operational work provenance and idempotency.
-- This migration is additive. It does not operationalize existing Estimates.

CREATE TYPE "EstimateOperationalizationTargetKind" AS ENUM (
  'JOB',
  'RECURRING_SERVICE'
);

CREATE TABLE "EstimateOperationalization" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "estimateId" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "acceptedEstimateVersion" INTEGER NOT NULL,
  "customerId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "operationalizedByUserId" TEXT NOT NULL,
  "operationalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EstimateOperationalization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EstimateOperationalization_version_check"
    CHECK ("acceptedEstimateVersion" >= 1),
  CONSTRAINT "EstimateOperationalization_idempotency_check"
    CHECK (length(btrim("idempotencyKey")) BETWEEN 1 AND 200),
  CONSTRAINT "EstimateOperationalization_hash_check"
    CHECK ("requestHash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "EstimateOperationalizationItem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "operationalizationId" TEXT NOT NULL,
  "estimateId" TEXT NOT NULL,
  "estimateLineItemId" TEXT NOT NULL,
  "targetKind" "EstimateOperationalizationTargetKind" NOT NULL,
  "jobId" TEXT,
  "jobStepId" TEXT,
  "recurringServiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EstimateOperationalizationItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EstimateOperationalizationItem_target_check" CHECK (
    ("targetKind" = 'JOB'
      AND "jobId" IS NOT NULL
      AND "recurringServiceId" IS NULL)
    OR
    ("targetKind" = 'RECURRING_SERVICE'
      AND "jobId" IS NULL
      AND "jobStepId" IS NULL
      AND "recurringServiceId" IS NOT NULL)
  ),
  CONSTRAINT "EstimateOperationalizationItem_step_check"
    CHECK ("jobStepId" IS NULL OR "jobId" IS NOT NULL)
);

CREATE UNIQUE INDEX "EstimateOperationalization_id_workspace_estimate_key"
ON "EstimateOperationalization"("id", "workspaceId", "estimateId");

CREATE UNIQUE INDEX "EstimateOperationalization_workspace_estimate_key"
ON "EstimateOperationalization"("workspaceId", "estimateId");

CREATE UNIQUE INDEX "EstimateOperationalization_estimate_workspace_reference_key"
ON "EstimateOperationalization"("estimateId", "workspaceId", "referenceNumber");

CREATE UNIQUE INDEX "EstimateOperationalization_workspace_reference_key"
ON "EstimateOperationalization"("workspaceId", "referenceNumber");

CREATE UNIQUE INDEX "EstimateOperationalization_workspace_idempotency_key"
ON "EstimateOperationalization"("workspaceId", "idempotencyKey");

CREATE INDEX "EstimateOperationalization_workspace_customer_time_idx"
ON "EstimateOperationalization"("workspaceId", "customerId", "operationalizedAt");

CREATE INDEX "EstimateOperationalization_actor_idx"
ON "EstimateOperationalization"("operationalizedByUserId");

CREATE UNIQUE INDEX "EstimateOperationalizationItem_workspace_line_key"
ON "EstimateOperationalizationItem"("workspaceId", "estimateLineItemId");

CREATE UNIQUE INDEX "EstimateOperationalizationItem_line_workspace_estimate_key"
ON "EstimateOperationalizationItem"("estimateLineItemId", "workspaceId", "estimateId");

CREATE INDEX "EstimateOperationalizationItem_workspace_parent_idx"
ON "EstimateOperationalizationItem"("workspaceId", "operationalizationId");

CREATE INDEX "EstimateOperationalizationItem_workspace_job_idx"
ON "EstimateOperationalizationItem"("workspaceId", "jobId");

CREATE INDEX "EstimateOperationalizationItem_workspace_step_idx"
ON "EstimateOperationalizationItem"("workspaceId", "jobStepId");

CREATE INDEX "EstimateOperationalizationItem_workspace_service_idx"
ON "EstimateOperationalizationItem"("workspaceId", "recurringServiceId");

CREATE UNIQUE INDEX "EstimateLineItem_id_workspace_estimate_key"
ON "EstimateLineItem"("id", "workspaceId", "estimateId");

CREATE UNIQUE INDEX "WorkItem_id_workspace_key"
ON "WorkItem"("id", "workspaceId");

CREATE UNIQUE INDEX "WorkItem_id_job_workspace_key"
ON "WorkItem"("id", "jobId", "workspaceId");

ALTER TABLE "EstimateOperationalization"
ADD CONSTRAINT "EstimateOperationalization_workspace_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateOperationalization"
ADD CONSTRAINT "EstimateOperationalization_estimate_fkey"
FOREIGN KEY ("estimateId", "workspaceId", "referenceNumber")
REFERENCES "Estimate"("id", "workspaceId", "referenceNumber")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateOperationalization"
ADD CONSTRAINT "EstimateOperationalization_customer_fkey"
FOREIGN KEY ("customerId", "workspaceId")
REFERENCES "Customer"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateOperationalization"
ADD CONSTRAINT "EstimateOperationalization_actor_fkey"
FOREIGN KEY ("operationalizedByUserId") REFERENCES "UserProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateOperationalizationItem"
ADD CONSTRAINT "EstimateOperationalizationItem_workspace_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateOperationalizationItem"
ADD CONSTRAINT "EstimateOperationalizationItem_parent_fkey"
FOREIGN KEY ("operationalizationId", "workspaceId", "estimateId")
REFERENCES "EstimateOperationalization"("id", "workspaceId", "estimateId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateOperationalizationItem"
ADD CONSTRAINT "EstimateOperationalizationItem_estimate_fkey"
FOREIGN KEY ("estimateId", "workspaceId")
REFERENCES "Estimate"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateOperationalizationItem"
ADD CONSTRAINT "EstimateOperationalizationItem_line_fkey"
FOREIGN KEY ("estimateLineItemId", "workspaceId", "estimateId")
REFERENCES "EstimateLineItem"("id", "workspaceId", "estimateId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateOperationalizationItem"
ADD CONSTRAINT "EstimateOperationalizationItem_job_fkey"
FOREIGN KEY ("jobId", "workspaceId") REFERENCES "Job"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateOperationalizationItem"
ADD CONSTRAINT "EstimateOperationalizationItem_step_fkey"
FOREIGN KEY ("jobStepId", "jobId", "workspaceId")
REFERENCES "WorkItem"("id", "jobId", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateOperationalizationItem"
ADD CONSTRAINT "EstimateOperationalizationItem_service_fkey"
FOREIGN KEY ("recurringServiceId", "workspaceId")
REFERENCES "RecurringService"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;
