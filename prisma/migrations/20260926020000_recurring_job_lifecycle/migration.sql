-- Phase 8C adds durable exception and cancellation metadata for recurring Jobs.
-- Existing manual and historical Jobs remain valid because every new field is
-- nullable and the unable-to-complete invariant applies only to the new status.

ALTER TYPE "JobStatus" ADD VALUE 'UNABLE_TO_COMPLETE' BEFORE 'COMPLETED';

CREATE TYPE "JobCancellationReason" AS ENUM (
  'CUSTOMER_REQUEST',
  'WEATHER',
  'ACCESS_ISSUE',
  'STAFFING',
  'EQUIPMENT',
  'HOLIDAY',
  'SERVICE_ENDED',
  'SCHEDULE_CANCELED',
  'OTHER'
);

CREATE TYPE "JobUnableToCompleteReason" AS ENUM (
  'WEATHER',
  'CUSTOMER_UNAVAILABLE',
  'ACCESS_ISSUE',
  'EQUIPMENT',
  'RAN_OUT_OF_TIME',
  'OTHER'
);

ALTER TABLE "Job"
ADD COLUMN "cancellationReason" "JobCancellationReason",
ADD COLUMN "cancellationNote" TEXT,
ADD COLUMN "canceledAt" TIMESTAMP(3),
ADD COLUMN "unableToCompleteReason" "JobUnableToCompleteReason",
ADD COLUMN "unableToCompleteNote" TEXT,
ADD COLUMN "unableToCompleteAt" TIMESTAMP(3),
ADD COLUMN "unableToCompleteReportedByMemberId" TEXT,
ADD CONSTRAINT "Job_unable_to_complete_metadata_check"
CHECK (
  "status"::text <> 'UNABLE_TO_COMPLETE'
  OR ("unableToCompleteReason" IS NOT NULL AND "unableToCompleteAt" IS NOT NULL)
);

CREATE INDEX "Job_workspaceId_unableToCompleteReportedByMemberId_idx"
ON "Job"("workspaceId", "unableToCompleteReportedByMemberId");

ALTER TABLE "Job" ADD CONSTRAINT "Job_unableToCompleteReportedByMemberId_workspaceId_fkey"
FOREIGN KEY ("unableToCompleteReportedByMemberId", "workspaceId")
REFERENCES "WorkspaceMember"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;
