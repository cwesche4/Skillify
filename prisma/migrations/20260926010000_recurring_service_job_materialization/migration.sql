-- Phase 8B links each generated recurring-service Job to its authoritative
-- Scheduling occurrence and preserves immutable service/step snapshots.

-- AlterTable
ALTER TABLE "Job"
ADD COLUMN "recurringServiceId" TEXT,
ADD COLUMN "schedulingEventId" TEXT,
ADD COLUMN "serviceInstructionsSnapshot" TEXT,
ADD CONSTRAINT "Job_recurring_source_pair_check"
CHECK (("recurringServiceId" IS NULL) = ("schedulingEventId" IS NULL));

ALTER TABLE "WorkItem"
ADD COLUMN "sortOrder" INTEGER,
ADD CONSTRAINT "WorkItem_sort_order_check"
CHECK ("sortOrder" IS NULL OR "sortOrder" >= 0);

-- SchedulingEvent IDs are globally unique already. This composite key allows
-- the Job source relation to enforce workspace ownership in the database.
CREATE UNIQUE INDEX "SchedulingEvent_id_workspaceId_key"
ON "SchedulingEvent"("id", "workspaceId");

-- One authoritative Scheduling occurrence can materialize at most one Job.
-- PostgreSQL permits multiple NULL values, preserving ordinary/manual Jobs.
CREATE UNIQUE INDEX "Job_schedulingEventId_workspaceId_key"
ON "Job"("schedulingEventId", "workspaceId");
CREATE INDEX "Job_workspaceId_recurringServiceId_scheduledStartAt_idx"
ON "Job"("workspaceId", "recurringServiceId", "scheduledStartAt");

-- Explicit order is unique within a Job. Existing and manually-created steps
-- may retain NULL until an ordering workflow intentionally assigns one.
CREATE UNIQUE INDEX "WorkItem_jobId_sortOrder_key"
ON "WorkItem"("jobId", "sortOrder");

-- Historical Jobs restrict deletion of both their business template and their
-- authoritative Scheduling occurrence.
ALTER TABLE "Job" ADD CONSTRAINT "Job_recurringServiceId_workspaceId_fkey"
FOREIGN KEY ("recurringServiceId", "workspaceId") REFERENCES "RecurringService"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_schedulingEventId_workspaceId_fkey"
FOREIGN KEY ("schedulingEventId", "workspaceId") REFERENCES "SchedulingEvent"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
