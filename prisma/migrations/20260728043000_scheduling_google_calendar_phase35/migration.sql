-- Scheduling Phase 3.5: Google Calendar sync hardening metadata.

ALTER TABLE "CalendarEventMapping"
  ADD COLUMN "providerVersion" TEXT,
  ADD COLUMN "lastSyncOrigin" TEXT,
  ADD COLUMN "originOperation" TEXT,
  ADD COLUMN "syncHash" TEXT;

CREATE INDEX "CalendarEventMapping_workspaceId_syncHash_idx"
  ON "CalendarEventMapping"("workspaceId", "syncHash");

CREATE INDEX "CalendarEventMapping_workspaceId_lastSyncOrigin_idx"
  ON "CalendarEventMapping"("workspaceId", "lastSyncOrigin");
