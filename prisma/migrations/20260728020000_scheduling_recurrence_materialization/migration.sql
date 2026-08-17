-- Complete the existing SchedulingRecurrenceSeries model so recurring events
-- can be materialized and managed as durable workspace-scoped occurrences.

ALTER TYPE "SchedulingOccurrenceState" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "SchedulingOccurrenceState" ADD VALUE IF NOT EXISTS 'DETACHED';

CREATE TYPE "SchedulingRecurrenceSeriesStatus" AS ENUM (
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELED'
);

ALTER TABLE "SchedulingRecurrenceSeries"
  ADD COLUMN "localStartDate" TEXT,
  ADD COLUMN "localStartTime" TEXT,
  ADD COLUMN "normalizedRule" JSONB,
  ADD COLUMN "status" "SchedulingRecurrenceSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "generatedThroughUtc" TIMESTAMP(3),
  ADD COLUMN "pausedAt" TIMESTAMP(3),
  ADD COLUMN "canceledAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "SchedulingRecurrenceSeries_workspaceId_status_idx"
  ON "SchedulingRecurrenceSeries"("workspaceId", "status");

CREATE INDEX "SchedulingEvent_workspaceId_recurrenceSeries_occurrence_idx"
  ON "SchedulingEvent"("workspaceId", "recurrenceSeriesId", "occurrenceOriginalAt");

CREATE UNIQUE INDEX "SchedulingEvent_recurrenceSeries_occurrenceOriginalAt_key"
  ON "SchedulingEvent"("recurrenceSeriesId", "occurrenceOriginalAt")
  WHERE "recurrenceSeriesId" IS NOT NULL
    AND "occurrenceOriginalAt" IS NOT NULL;
