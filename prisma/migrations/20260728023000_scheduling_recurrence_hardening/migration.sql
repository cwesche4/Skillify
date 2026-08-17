-- Phase 1.5 recurrence hardening.

ALTER TYPE "SchedulingOccurrenceState" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

ALTER TABLE "SchedulingEvent"
  ADD COLUMN IF NOT EXISTS "overrideFields" JSONB,
  ADD COLUMN IF NOT EXISTS "recurrenceLineage" JSONB;

ALTER TABLE "SchedulingRecurrenceSeries"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "splitFromSeriesId" TEXT,
  ADD COLUMN IF NOT EXISTS "splitAtOccurrenceId" TEXT,
  ADD COLUMN IF NOT EXISTS "splitBoundaryUtc" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SchedulingRecurrenceMutation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "seriesId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "mutationKind" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "result" JSONB,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "SchedulingRecurrenceMutation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchedulingRecurrenceMutation_workspaceId_idempotencyKey_key"
  ON "SchedulingRecurrenceMutation"("workspaceId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "SchedulingRecurrenceMutation_seriesId_createdAt_idx"
  ON "SchedulingRecurrenceMutation"("seriesId", "createdAt");

CREATE INDEX IF NOT EXISTS "SchedulingRecurrenceMutation_workspaceId_mutationKind_createdAt_idx"
  ON "SchedulingRecurrenceMutation"("workspaceId", "mutationKind", "createdAt");

CREATE INDEX IF NOT EXISTS "SchedulingEvent_workspaceId_recurrenceSeriesId_occurrenceOriginalAt_idx"
  ON "SchedulingEvent"("workspaceId", "recurrenceSeriesId", "occurrenceOriginalAt");

CREATE INDEX IF NOT EXISTS "SchedulingEvent_workspaceId_occurrenceState_idx"
  ON "SchedulingEvent"("workspaceId", "occurrenceState");

CREATE UNIQUE INDEX IF NOT EXISTS "SchedulingEvent_workspaceId_recurrenceSeriesId_occurrenceOriginalAt_key"
  ON "SchedulingEvent"("workspaceId", "recurrenceSeriesId", "occurrenceOriginalAt")
  WHERE "deletedAt" IS NULL
    AND "recurrenceSeriesId" IS NOT NULL
    AND "occurrenceOriginalAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "SchedulingRecurrenceSeries_workspaceId_version_idx"
  ON "SchedulingRecurrenceSeries"("workspaceId", "version");

CREATE INDEX IF NOT EXISTS "SchedulingRecurrenceSeries_workspaceId_splitFromSeriesId_idx"
  ON "SchedulingRecurrenceSeries"("workspaceId", "splitFromSeriesId");

CREATE INDEX IF NOT EXISTS "SchedulingRecurrenceSeries_workspaceId_splitBoundaryUtc_idx"
  ON "SchedulingRecurrenceSeries"("workspaceId", "splitBoundaryUtc");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'SchedulingRecurrenceMutation_workspaceId_fkey'
      AND table_name = 'SchedulingRecurrenceMutation'
  ) THEN
    ALTER TABLE "SchedulingRecurrenceMutation"
      ADD CONSTRAINT "SchedulingRecurrenceMutation_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
