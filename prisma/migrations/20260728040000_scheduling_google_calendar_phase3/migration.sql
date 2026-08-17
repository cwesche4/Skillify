-- Scheduling Phase 3: Google Calendar provider synchronization foundation.

CREATE TYPE "CalendarConflictPolicy" AS ENUM ('SKILLIFY_WINS', 'PROVIDER_WINS', 'ASK_USER');
CREATE TYPE "CalendarWatchChannelStatus" AS ENUM ('ACTIVE', 'RENEWING', 'EXPIRED', 'STOPPED', 'FAILED');
CREATE TYPE "CalendarSyncConflictStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

ALTER TYPE "CalendarSyncDirectionLog" ADD VALUE IF NOT EXISTS 'WATCH_RENEWAL';
ALTER TYPE "CalendarSyncDirectionLog" ADD VALUE IF NOT EXISTS 'RECOVERY';
ALTER TYPE "CalendarSyncDirectionLog" ADD VALUE IF NOT EXISTS 'DIAGNOSTICS';

ALTER TABLE "CalendarConnection"
  ADD COLUMN "conflictPolicy" "CalendarConflictPolicy" NOT NULL DEFAULT 'SKILLIFY_WINS',
  ADD COLUMN "syncFrequencyMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "lastValidatedAt" TIMESTAMP(3),
  ADD COLUMN "nextSyncAt" TIMESTAMP(3),
  ADD COLUMN "oauthState" TEXT,
  ADD COLUMN "oauthStateExpiresAt" TIMESTAMP(3),
  ADD COLUMN "tokenStatus" TEXT,
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "ConnectedCalendar"
  ADD COLUMN "ownerEmail" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "visibility" TEXT,
  ADD COLUMN "isWritable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "selectedForSync" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "syncFrequencyMinutes" INTEGER,
  ADD COLUMN "lastSyncToken" TEXT,
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "nextSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "lastErrorMessage" TEXT,
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "CalendarEventMapping"
  ADD COLUMN "recurrenceSeriesId" TEXT,
  ADD COLUMN "occurrenceId" TEXT,
  ADD COLUMN "providerRecurringEventId" TEXT,
  ADD COLUMN "lastPulledAt" TIMESTAMP(3),
  ADD COLUMN "lastPushedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAtSkillify" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "conflictType" TEXT,
  ADD COLUMN "conflictMetadata" JSONB,
  ADD COLUMN "conflictResolvedAt" TIMESTAMP(3);

ALTER TABLE "CalendarSyncLog"
  ADD COLUMN "workerId" TEXT,
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "retryable" BOOLEAN;

CREATE TABLE "CalendarWatchChannel" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "connectedCalendarId" TEXT,
  "provider" "CalendarProvider" NOT NULL,
  "providerCalendarId" TEXT,
  "channelId" TEXT NOT NULL,
  "resourceId" TEXT,
  "resourceUri" TEXT,
  "tokenEncrypted" TEXT,
  "status" "CalendarWatchChannelStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "lastMessageNumber" TEXT,
  "lastNotificationAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "stoppedAt" TIMESTAMP(3),

  CONSTRAINT "CalendarWatchChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarSyncDiagnostic" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "connectionId" TEXT,
  "connectedCalendarId" TEXT,
  "workerKind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "pendingPull" INTEGER NOT NULL DEFAULT 0,
  "pendingPush" INTEGER NOT NULL DEFAULT 0,
  "openConflicts" INTEGER NOT NULL DEFAULT 0,
  "failedMappings" INTEGER NOT NULL DEFAULT 0,
  "activeWatchChannels" INTEGER NOT NULL DEFAULT 0,
  "expiredWatchChannels" INTEGER NOT NULL DEFAULT 0,
  "safeMessage" TEXT,
  "metadata" JSONB,
  "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalendarSyncDiagnostic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarSyncConflict" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "connectionId" TEXT,
  "connectedCalendarId" TEXT,
  "mappingId" TEXT,
  "schedulingEventId" TEXT,
  "provider" "CalendarProvider" NOT NULL,
  "conflictType" TEXT NOT NULL,
  "status" "CalendarSyncConflictStatus" NOT NULL DEFAULT 'OPEN',
  "resolutionPolicy" "CalendarConflictPolicy" NOT NULL DEFAULT 'SKILLIFY_WINS',
  "resolution" TEXT,
  "safeMessage" TEXT NOT NULL,
  "providerSnapshot" JSONB,
  "skillifySnapshot" JSONB,
  "metadata" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,

  CONSTRAINT "CalendarSyncConflict_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarWatchChannel_provider_channelId_key" ON "CalendarWatchChannel"("provider", "channelId");
CREATE INDEX "CalendarConnection_syncStatus_nextSyncAt_idx" ON "CalendarConnection"("syncStatus", "nextSyncAt");
CREATE INDEX "ConnectedCalendar_workspaceId_selectedForSync_idx" ON "ConnectedCalendar"("workspaceId", "selectedForSync");
CREATE INDEX "ConnectedCalendar_workspaceId_defaultExportTarget_idx" ON "ConnectedCalendar"("workspaceId", "defaultExportTarget");
CREATE INDEX "CalendarEventMapping_workspaceId_recurrenceSeriesId_idx" ON "CalendarEventMapping"("workspaceId", "recurrenceSeriesId");
CREATE INDEX "CalendarEventMapping_workspaceId_occurrenceId_idx" ON "CalendarEventMapping"("workspaceId", "occurrenceId");
CREATE INDEX "CalendarWatchChannel_workspaceId_status_expiresAt_idx" ON "CalendarWatchChannel"("workspaceId", "status", "expiresAt");
CREATE INDEX "CalendarWatchChannel_connectionId_idx" ON "CalendarWatchChannel"("connectionId");
CREATE INDEX "CalendarWatchChannel_connectedCalendarId_idx" ON "CalendarWatchChannel"("connectedCalendarId");
CREATE INDEX "CalendarSyncDiagnostic_workspaceId_measuredAt_idx" ON "CalendarSyncDiagnostic"("workspaceId", "measuredAt");
CREATE INDEX "CalendarSyncDiagnostic_connectionId_idx" ON "CalendarSyncDiagnostic"("connectionId");
CREATE INDEX "CalendarSyncDiagnostic_connectedCalendarId_idx" ON "CalendarSyncDiagnostic"("connectedCalendarId");
CREATE INDEX "CalendarSyncConflict_workspaceId_status_detectedAt_idx" ON "CalendarSyncConflict"("workspaceId", "status", "detectedAt");
CREATE INDEX "CalendarSyncConflict_connectionId_idx" ON "CalendarSyncConflict"("connectionId");
CREATE INDEX "CalendarSyncConflict_connectedCalendarId_idx" ON "CalendarSyncConflict"("connectedCalendarId");
CREATE INDEX "CalendarSyncConflict_mappingId_idx" ON "CalendarSyncConflict"("mappingId");
CREATE INDEX "CalendarSyncConflict_schedulingEventId_idx" ON "CalendarSyncConflict"("schedulingEventId");

ALTER TABLE "CalendarWatchChannel" ADD CONSTRAINT "CalendarWatchChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarWatchChannel" ADD CONSTRAINT "CalendarWatchChannel_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarWatchChannel" ADD CONSTRAINT "CalendarWatchChannel_connectedCalendarId_fkey" FOREIGN KEY ("connectedCalendarId") REFERENCES "ConnectedCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalendarSyncDiagnostic" ADD CONSTRAINT "CalendarSyncDiagnostic_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncDiagnostic" ADD CONSTRAINT "CalendarSyncDiagnostic_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncDiagnostic" ADD CONSTRAINT "CalendarSyncDiagnostic_connectedCalendarId_fkey" FOREIGN KEY ("connectedCalendarId") REFERENCES "ConnectedCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalendarSyncConflict" ADD CONSTRAINT "CalendarSyncConflict_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncConflict" ADD CONSTRAINT "CalendarSyncConflict_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncConflict" ADD CONSTRAINT "CalendarSyncConflict_connectedCalendarId_fkey" FOREIGN KEY ("connectedCalendarId") REFERENCES "ConnectedCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncConflict" ADD CONSTRAINT "CalendarSyncConflict_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "CalendarEventMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncConflict" ADD CONSTRAINT "CalendarSyncConflict_schedulingEventId_fkey" FOREIGN KEY ("schedulingEventId") REFERENCES "SchedulingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
