-- Phase Scheduling production foundation.
-- Native Skillify scheduling records do not depend on external calendar
-- providers being configured. Provider credentials are optional and stored
-- only in encrypted connection records when sync is enabled.

ALTER TYPE "CalendarProvider" ADD VALUE IF NOT EXISTS 'APPLE_ICLOUD';
ALTER TYPE "CalendarProvider" ADD VALUE IF NOT EXISTS 'CALDAV';
ALTER TYPE "CalendarProvider" ADD VALUE IF NOT EXISTS 'ICS';

CREATE TYPE "SchedulingEventStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'MISSED');
CREATE TYPE "SchedulingOccurrenceState" AS ENUM ('MASTER', 'GENERATED', 'OVERRIDDEN', 'CANCELED', 'DELETED');
CREATE TYPE "SchedulingLocationType" AS ENUM ('NONE', 'ADDRESS', 'VIDEO', 'PHONE', 'CUSTOM');
CREATE TYPE "SchedulingExternalVisibility" AS ENUM ('DEFAULT', 'PUBLIC', 'PRIVATE', 'BUSY_ONLY');
CREATE TYPE "SchedulingSyncPolicy" AS ENUM ('WORKSPACE_DEFAULT', 'SYNC', 'DO_NOT_SYNC');
CREATE TYPE "SchedulingAssignmentType" AS ENUM ('MEMBER', 'TEAM');
CREATE TYPE "SchedulingAttendeeType" AS ENUM ('WORKSPACE_MEMBER', 'CONTACT', 'CUSTOMER', 'EXTERNAL_GUEST');
CREATE TYPE "SchedulingAttendeeResponseStatus" AS ENUM ('NEEDS_ACTION', 'ACCEPTED', 'TENTATIVE', 'DECLINED');
CREATE TYPE "CalendarConnectionStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTING', 'INITIAL_SYNC', 'CONNECTED', 'NEEDS_ATTENTION', 'PAUSED', 'DISCONNECTED');
CREATE TYPE "CalendarSyncDirection" AS ENUM ('IMPORT_ONLY', 'EXPORT_ONLY', 'TWO_WAY', 'AVAILABILITY_ONLY', 'DISABLED');
CREATE TYPE "CalendarEventOwnership" AS ENUM ('SKILLIFY_NATIVE', 'EXTERNAL_ONLY');
CREATE TYPE "CalendarEventSyncState" AS ENUM ('SYNCED', 'PENDING_PUSH', 'PENDING_PULL', 'CONFLICT', 'FAILED', 'PROVIDER_DELETED', 'SKILLIFY_DELETED');
CREATE TYPE "CalendarSyncLogStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'RETRYING');
CREATE TYPE "CalendarSyncDirectionLog" AS ENUM ('IMPORT', 'EXPORT', 'TWO_WAY', 'WEBHOOK', 'TOKEN_REFRESH');
CREATE TYPE "SchedulingAvailabilityRecordKind" AS ENUM ('WORKING_HOURS', 'TIME_OFF', 'AVAILABILITY_EXCEPTION');
CREATE TYPE "SchedulingTimeOffCategory" AS ENUM ('VACATION', 'SICK', 'PERSONAL', 'APPOINTMENT', 'UNAVAILABLE', 'OTHER');
CREATE TYPE "SchedulingExceptionType" AS ENUM ('CLOSED', 'CUSTOM_HOURS');
CREATE TYPE "SchedulingNotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "SchedulingNotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "DomainOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD');

CREATE TABLE "SchedulingEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "eventTypeKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "SchedulingEventStatus" NOT NULL DEFAULT 'SCHEDULED',
  "startsAtUtc" TIMESTAMP(3) NOT NULL,
  "endsAtUtc" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "locationType" "SchedulingLocationType",
  "locationLabel" TEXT,
  "locationAddress" TEXT,
  "meetingUrl" TEXT,
  "recurrenceSeriesId" TEXT,
  "recurrenceRule" JSONB,
  "recurrenceTimezone" TEXT,
  "occurrenceOriginalAt" TIMESTAMP(3),
  "occurrenceState" "SchedulingOccurrenceState",
  "linkedRecordType" TEXT,
  "linkedRecordId" TEXT,
  "linkedRecordLabel" TEXT,
  "blocksAvailability" BOOLEAN NOT NULL DEFAULT true,
  "externalVisibility" "SchedulingExternalVisibility" NOT NULL DEFAULT 'DEFAULT',
  "syncPolicy" "SchedulingSyncPolicy" NOT NULL DEFAULT 'WORKSPACE_DEFAULT',
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "canceledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SchedulingEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchedulingRecurrenceSeries" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "masterEventId" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "rrule" TEXT NOT NULL,
  "startsAtLocal" TEXT,
  "durationMinutes" INTEGER NOT NULL,
  "untilUtc" TIMESTAMP(3),
  "occurrenceCount" INTEGER,
  "exdates" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchedulingRecurrenceSeries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchedulingAssignment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "assignmentType" "SchedulingAssignmentType" NOT NULL,
  "workspaceMemberId" TEXT,
  "teamId" TEXT,
  "roleLabel" TEXT,
  "displaySnapshot" TEXT,
  "notificationState" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchedulingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchedulingAttendee" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "attendeeType" "SchedulingAttendeeType" NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "responseStatus" "SchedulingAttendeeResponseStatus" NOT NULL DEFAULT 'NEEDS_ACTION',
  "isOrganizer" BOOLEAN NOT NULL DEFAULT false,
  "isOptional" BOOLEAN NOT NULL DEFAULT false,
  "notificationPolicy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchedulingAttendee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchedulingAvailabilityRecord" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "kind" "SchedulingAvailabilityRecordKind" NOT NULL,
  "memberId" TEXT,
  "teamId" TEXT,
  "title" TEXT,
  "category" "SchedulingTimeOffCategory",
  "exceptionType" "SchedulingExceptionType",
  "startsAtUtc" TIMESTAMP(3),
  "endsAtUtc" TIMESTAMP(3),
  "timezone" TEXT NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "startTimeMinutes" INTEGER,
  "endTimeMinutes" INTEGER,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveUntil" TIMESTAMP(3),
  "recurrenceRule" JSONB,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SchedulingAvailabilityRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarConnection" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "connectedByUserId" TEXT NOT NULL,
  "provider" "CalendarProvider" NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "accountEmail" TEXT,
  "displayName" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "scopes" JSONB,
  "syncStatus" "CalendarConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "lastAttemptedSyncAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "disconnectedAt" TIMESTAMP(3),
  CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConnectedCalendar" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "providerCalendarId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "timezone" TEXT,
  "accessRole" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "importEnabled" BOOLEAN NOT NULL DEFAULT true,
  "exportEnabled" BOOLEAN NOT NULL DEFAULT false,
  "availabilityEnabled" BOOLEAN NOT NULL DEFAULT true,
  "defaultExportTarget" BOOLEAN NOT NULL DEFAULT false,
  "privacyMode" BOOLEAN NOT NULL DEFAULT false,
  "syncDirection" "CalendarSyncDirection" NOT NULL DEFAULT 'IMPORT_ONLY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectedCalendar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarSyncCursor" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "connectedCalendarId" TEXT,
  "cursor" TEXT,
  "deltaLink" TEXT,
  "pageToken" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarSyncCursor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarEventMapping" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "schedulingEventId" TEXT,
  "connectedCalendarId" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "providerSeriesId" TEXT,
  "providerOccurrenceId" TEXT,
  "providerEtag" TEXT,
  "providerUpdatedAt" TIMESTAMP(3),
  "syncVersion" INTEGER NOT NULL DEFAULT 1,
  "ownership" "CalendarEventOwnership" NOT NULL,
  "syncState" "CalendarEventSyncState" NOT NULL DEFAULT 'SYNCED',
  "lastSyncedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "deletedAtProvider" BOOLEAN NOT NULL DEFAULT false,
  "providerSnapshot" JSONB,
  "skillifySnapshot" JSONB,
  "metadata" JSONB,
  CONSTRAINT "CalendarEventMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarSyncLog" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "connectionId" TEXT,
  "connectedCalendarId" TEXT,
  "schedulingEventId" TEXT,
  "direction" "CalendarSyncDirectionLog" NOT NULL,
  "operation" TEXT NOT NULL,
  "status" "CalendarSyncLogStatus" NOT NULL,
  "providerCode" TEXT,
  "safeMessage" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "CalendarSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchedulingNotification" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "deepLink" TEXT,
  "relatedRecordType" TEXT,
  "relatedRecordId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchedulingNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchedulingNotificationDelivery" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "schedulingEventId" TEXT,
  "recipientUserId" TEXT,
  "recipientEmail" TEXT,
  "channel" "SchedulingNotificationChannel" NOT NULL,
  "status" "SchedulingNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchedulingNotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchedulingEventActivity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchedulingEventActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DomainOutboxEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "DomainOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DomainOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchedulingRecurrenceSeries_masterEventId_key" ON "SchedulingRecurrenceSeries"("masterEventId");
CREATE UNIQUE INDEX "SchedulingAssignment_eventId_workspaceMemberId_key" ON "SchedulingAssignment"("eventId", "workspaceMemberId");
CREATE UNIQUE INDEX "SchedulingAssignment_eventId_teamId_key" ON "SchedulingAssignment"("eventId", "teamId");
CREATE UNIQUE INDEX "SchedulingAttendee_eventId_email_key" ON "SchedulingAttendee"("eventId", "email");
CREATE UNIQUE INDEX "CalendarConnection_workspaceId_provider_providerAccountId_key" ON "CalendarConnection"("workspaceId", "provider", "providerAccountId");
CREATE UNIQUE INDEX "ConnectedCalendar_connectionId_providerCalendarId_key" ON "ConnectedCalendar"("connectionId", "providerCalendarId");
CREATE UNIQUE INDEX "CalendarSyncCursor_connectionId_connectedCalendarId_key" ON "CalendarSyncCursor"("connectionId", "connectedCalendarId");
CREATE UNIQUE INDEX "CalendarEventMapping_connectedCalendarId_providerEventId_key" ON "CalendarEventMapping"("connectedCalendarId", "providerEventId");

CREATE INDEX "SchedulingEvent_workspaceId_startsAtUtc_idx" ON "SchedulingEvent"("workspaceId", "startsAtUtc");
CREATE INDEX "SchedulingEvent_workspaceId_endsAtUtc_idx" ON "SchedulingEvent"("workspaceId", "endsAtUtc");
CREATE INDEX "SchedulingEvent_workspaceId_eventTypeKey_idx" ON "SchedulingEvent"("workspaceId", "eventTypeKey");
CREATE INDEX "SchedulingEvent_workspaceId_status_idx" ON "SchedulingEvent"("workspaceId", "status");
CREATE INDEX "SchedulingEvent_recurrenceSeriesId_idx" ON "SchedulingEvent"("recurrenceSeriesId");
CREATE INDEX "SchedulingEvent_workspaceId_linkedRecordType_linkedRecordId_idx" ON "SchedulingEvent"("workspaceId", "linkedRecordType", "linkedRecordId");
CREATE INDEX "SchedulingRecurrenceSeries_workspaceId_idx" ON "SchedulingRecurrenceSeries"("workspaceId");
CREATE INDEX "SchedulingAssignment_workspaceId_workspaceMemberId_idx" ON "SchedulingAssignment"("workspaceId", "workspaceMemberId");
CREATE INDEX "SchedulingAssignment_workspaceId_teamId_idx" ON "SchedulingAssignment"("workspaceId", "teamId");
CREATE INDEX "SchedulingAssignment_eventId_idx" ON "SchedulingAssignment"("eventId");
CREATE INDEX "SchedulingAttendee_workspaceId_email_idx" ON "SchedulingAttendee"("workspaceId", "email");
CREATE INDEX "SchedulingAttendee_eventId_idx" ON "SchedulingAttendee"("eventId");
CREATE INDEX "SchedulingAvailabilityRecord_workspaceId_kind_idx" ON "SchedulingAvailabilityRecord"("workspaceId", "kind");
CREATE INDEX "SchedulingAvailabilityRecord_workspaceId_memberId_idx" ON "SchedulingAvailabilityRecord"("workspaceId", "memberId");
CREATE INDEX "SchedulingAvailabilityRecord_workspaceId_teamId_idx" ON "SchedulingAvailabilityRecord"("workspaceId", "teamId");
CREATE INDEX "SchedulingAvailabilityRecord_workspaceId_startsAtUtc_idx" ON "SchedulingAvailabilityRecord"("workspaceId", "startsAtUtc");
CREATE INDEX "CalendarConnection_workspaceId_provider_idx" ON "CalendarConnection"("workspaceId", "provider");
CREATE INDEX "ConnectedCalendar_workspaceId_idx" ON "ConnectedCalendar"("workspaceId");
CREATE INDEX "CalendarSyncCursor_workspaceId_idx" ON "CalendarSyncCursor"("workspaceId");
CREATE INDEX "CalendarEventMapping_workspaceId_schedulingEventId_idx" ON "CalendarEventMapping"("workspaceId", "schedulingEventId");
CREATE INDEX "CalendarEventMapping_workspaceId_syncState_idx" ON "CalendarEventMapping"("workspaceId", "syncState");
CREATE INDEX "CalendarSyncLog_workspaceId_startedAt_idx" ON "CalendarSyncLog"("workspaceId", "startedAt");
CREATE INDEX "CalendarSyncLog_connectionId_idx" ON "CalendarSyncLog"("connectionId");
CREATE INDEX "SchedulingNotification_workspaceId_createdAt_idx" ON "SchedulingNotification"("workspaceId", "createdAt");
CREATE INDEX "SchedulingNotification_workspaceId_key_idx" ON "SchedulingNotification"("workspaceId", "key");
CREATE INDEX "SchedulingNotificationDelivery_workspaceId_recipientUserId_readAt_idx" ON "SchedulingNotificationDelivery"("workspaceId", "recipientUserId", "readAt");
CREATE INDEX "SchedulingNotificationDelivery_workspaceId_recipientEmail_idx" ON "SchedulingNotificationDelivery"("workspaceId", "recipientEmail");
CREATE INDEX "SchedulingNotificationDelivery_notificationId_idx" ON "SchedulingNotificationDelivery"("notificationId");
CREATE INDEX "SchedulingEventActivity_workspaceId_createdAt_idx" ON "SchedulingEventActivity"("workspaceId", "createdAt");
CREATE INDEX "SchedulingEventActivity_eventId_createdAt_idx" ON "SchedulingEventActivity"("eventId", "createdAt");
CREATE INDEX "DomainOutboxEvent_status_availableAt_idx" ON "DomainOutboxEvent"("status", "availableAt");
CREATE INDEX "DomainOutboxEvent_workspaceId_createdAt_idx" ON "DomainOutboxEvent"("workspaceId", "createdAt");

ALTER TABLE "SchedulingEvent" ADD CONSTRAINT "SchedulingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingEvent" ADD CONSTRAINT "SchedulingEvent_recurrenceSeriesId_fkey" FOREIGN KEY ("recurrenceSeriesId") REFERENCES "SchedulingRecurrenceSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SchedulingRecurrenceSeries" ADD CONSTRAINT "SchedulingRecurrenceSeries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingRecurrenceSeries" ADD CONSTRAINT "SchedulingRecurrenceSeries_masterEventId_fkey" FOREIGN KEY ("masterEventId") REFERENCES "SchedulingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingAssignment" ADD CONSTRAINT "SchedulingAssignment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingAssignment" ADD CONSTRAINT "SchedulingAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SchedulingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingAttendee" ADD CONSTRAINT "SchedulingAttendee_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingAttendee" ADD CONSTRAINT "SchedulingAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SchedulingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingAvailabilityRecord" ADD CONSTRAINT "SchedulingAvailabilityRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectedCalendar" ADD CONSTRAINT "ConnectedCalendar_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectedCalendar" ADD CONSTRAINT "ConnectedCalendar_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncCursor" ADD CONSTRAINT "CalendarSyncCursor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncCursor" ADD CONSTRAINT "CalendarSyncCursor_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncCursor" ADD CONSTRAINT "CalendarSyncCursor_connectedCalendarId_fkey" FOREIGN KEY ("connectedCalendarId") REFERENCES "ConnectedCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarEventMapping" ADD CONSTRAINT "CalendarEventMapping_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarEventMapping" ADD CONSTRAINT "CalendarEventMapping_schedulingEventId_fkey" FOREIGN KEY ("schedulingEventId") REFERENCES "SchedulingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarEventMapping" ADD CONSTRAINT "CalendarEventMapping_connectedCalendarId_fkey" FOREIGN KEY ("connectedCalendarId") REFERENCES "ConnectedCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncLog" ADD CONSTRAINT "CalendarSyncLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncLog" ADD CONSTRAINT "CalendarSyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarSyncLog" ADD CONSTRAINT "CalendarSyncLog_connectedCalendarId_fkey" FOREIGN KEY ("connectedCalendarId") REFERENCES "ConnectedCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SchedulingNotification" ADD CONSTRAINT "SchedulingNotification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingNotificationDelivery" ADD CONSTRAINT "SchedulingNotificationDelivery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingNotificationDelivery" ADD CONSTRAINT "SchedulingNotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "SchedulingNotification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingNotificationDelivery" ADD CONSTRAINT "SchedulingNotificationDelivery_schedulingEventId_fkey" FOREIGN KEY ("schedulingEventId") REFERENCES "SchedulingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SchedulingEventActivity" ADD CONSTRAINT "SchedulingEventActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingEventActivity" ADD CONSTRAINT "SchedulingEventActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SchedulingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DomainOutboxEvent" ADD CONSTRAINT "DomainOutboxEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
