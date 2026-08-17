-- Phase 2 Scheduling notifications, reminders, preferences, and worker delivery.

ALTER TYPE "SchedulingNotificationChannel" ADD VALUE IF NOT EXISTS 'SMS';
ALTER TYPE "SchedulingNotificationChannel" ADD VALUE IF NOT EXISTS 'PUSH';

ALTER TYPE "SchedulingNotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'DEFERRED';
ALTER TYPE "SchedulingNotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "SchedulingNotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "SchedulingNotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'PERMANENTLY_FAILED';
ALTER TYPE "SchedulingNotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'CANCELED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SchedulingNotificationCategory') THEN
    CREATE TYPE "SchedulingNotificationCategory" AS ENUM (
      'EVENT_CREATED',
      'ASSIGNMENT',
      'REASSIGNMENT',
      'EVENT_UPDATED',
      'RESCHEDULED',
      'CANCELED',
      'COMPLETED',
      'MISSED',
      'REMINDER',
      'RECURRING_SERIES_CHANGED',
      'RECURRING_SERIES_CANCELED',
      'TIME_OFF',
      'AVAILABILITY_EXCEPTION',
      'CONFLICT',
      'DELIVERY_FAILURE'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SchedulingNotificationPriority') THEN
    CREATE TYPE "SchedulingNotificationPriority" AS ENUM (
      'LOW',
      'NORMAL',
      'HIGH',
      'URGENT'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SchedulingReminderStatus') THEN
    CREATE TYPE "SchedulingReminderStatus" AS ENUM (
      'SCHEDULED',
      'PROCESSING',
      'SENT',
      'CANCELED',
      'SKIPPED',
      'FAILED',
      'PERMANENTLY_FAILED'
    );
  END IF;
END $$;

ALTER TABLE "SchedulingNotification"
  ADD COLUMN IF NOT EXISTS "deduplicationKey" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceOutboxId" TEXT,
  ADD COLUMN IF NOT EXISTS "category" "SchedulingNotificationCategory" NOT NULL DEFAULT 'EVENT_UPDATED',
  ADD COLUMN IF NOT EXISTS "priority" "SchedulingNotificationPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "recipientType" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientWorkspaceMemberId" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "actionUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "entityType" TEXT,
  ADD COLUMN IF NOT EXISTS "entityId" TEXT,
  ADD COLUMN IF NOT EXISTS "schedulingEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "occurrenceId" TEXT,
  ADD COLUMN IF NOT EXISTS "seriesId" TEXT,
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "SchedulingNotification_workspaceId_deduplicationKey_key"
  ON "SchedulingNotification"("workspaceId", "deduplicationKey");
CREATE INDEX IF NOT EXISTS "SchedulingNotification_workspaceId_recipientUserId_readAt_idx"
  ON "SchedulingNotification"("workspaceId", "recipientUserId", "readAt");
CREATE INDEX IF NOT EXISTS "SchedulingNotification_workspaceId_recipientWorkspaceMemberId_readAt_idx"
  ON "SchedulingNotification"("workspaceId", "recipientWorkspaceMemberId", "readAt");
CREATE INDEX IF NOT EXISTS "SchedulingNotification_workspaceId_recipientEmail_idx"
  ON "SchedulingNotification"("workspaceId", "recipientEmail");
CREATE INDEX IF NOT EXISTS "SchedulingNotification_workspaceId_category_createdAt_idx"
  ON "SchedulingNotification"("workspaceId", "category", "createdAt");
CREATE INDEX IF NOT EXISTS "SchedulingNotification_workspaceId_sourceOutboxId_idx"
  ON "SchedulingNotification"("workspaceId", "sourceOutboxId");

ALTER TABLE "SchedulingNotificationDelivery"
  ADD COLUMN IF NOT EXISTS "destination" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);

UPDATE "SchedulingNotificationDelivery"
SET "nextAttemptAt" = COALESCE("nextAttemptAt", "createdAt"),
    "destination" = COALESCE("destination", "recipientEmail")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS "SchedulingNotificationDelivery_workspaceId_idempotencyKey_key"
  ON "SchedulingNotificationDelivery"("workspaceId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "SchedulingNotificationDelivery_status_nextAttemptAt_idx"
  ON "SchedulingNotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "SchedulingNotificationDelivery_channel_status_nextAttemptAt_idx"
  ON "SchedulingNotificationDelivery"("channel", "status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "SchedulingNotificationDelivery_workspaceId_status_nextAttemptAt_idx"
  ON "SchedulingNotificationDelivery"("workspaceId", "status", "nextAttemptAt");

CREATE TABLE IF NOT EXISTS "SchedulingReminderSchedule" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "schedulingEventId" TEXT,
  "recurrenceSeriesId" TEXT,
  "occurrenceId" TEXT,
  "occurrenceOriginalAt" TIMESTAMP(3),
  "recipientType" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "recipientWorkspaceMemberId" TEXT,
  "recipientEmail" TEXT,
  "channel" "SchedulingNotificationChannel" NOT NULL,
  "category" "SchedulingNotificationCategory" NOT NULL DEFAULT 'REMINDER',
  "offsetMinutes" INTEGER,
  "scheduledForUtc" TIMESTAMP(3) NOT NULL,
  "eventStartsAtUtc" TIMESTAMP(3),
  "timezone" TEXT NOT NULL,
  "status" "SchedulingReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
  "idempotencyKey" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "metadata" JSONB,
  "claimedAt" TIMESTAMP(3),
  "claimedBy" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchedulingReminderSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchedulingReminderSchedule_workspaceId_idempotencyKey_key"
  ON "SchedulingReminderSchedule"("workspaceId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "SchedulingReminderSchedule_workspaceId_schedulingEventId_idx"
  ON "SchedulingReminderSchedule"("workspaceId", "schedulingEventId");
CREATE INDEX IF NOT EXISTS "SchedulingReminderSchedule_workspaceId_recurrenceSeriesId_idx"
  ON "SchedulingReminderSchedule"("workspaceId", "recurrenceSeriesId");
CREATE INDEX IF NOT EXISTS "SchedulingReminderSchedule_workspaceId_occurrenceId_idx"
  ON "SchedulingReminderSchedule"("workspaceId", "occurrenceId");
CREATE INDEX IF NOT EXISTS "SchedulingReminderSchedule_status_scheduledForUtc_idx"
  ON "SchedulingReminderSchedule"("status", "scheduledForUtc");
CREATE INDEX IF NOT EXISTS "SchedulingReminderSchedule_workspaceId_status_scheduledForUtc_idx"
  ON "SchedulingReminderSchedule"("workspaceId", "status", "scheduledForUtc");
CREATE INDEX IF NOT EXISTS "SchedulingReminderSchedule_recipientUserId_status_scheduledForUtc_idx"
  ON "SchedulingReminderSchedule"("recipientUserId", "status", "scheduledForUtc");

CREATE TABLE IF NOT EXISTS "SchedulingNotificationPreference" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "workspaceMemberId" TEXT,
  "userId" TEXT,
  "schedulingEnabled" BOOLEAN,
  "inAppEnabled" BOOLEAN,
  "emailEnabled" BOOLEAN,
  "categorySettings" JSONB,
  "quietHours" JSONB,
  "timezone" TEXT,
  "selfNotifications" BOOLEAN,
  "defaultReminders" JSONB,
  "externalAttendeesEnabled" BOOLEAN,
  "linkedClientsEnabled" BOOLEAN,
  "deliveryFailureAlertsEnabled" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchedulingNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchedulingNotificationPreference_workspaceId_scopeType_workspaceMemberId_key"
  ON "SchedulingNotificationPreference"("workspaceId", "scopeType", "workspaceMemberId");
CREATE INDEX IF NOT EXISTS "SchedulingNotificationPreference_workspaceId_scopeType_idx"
  ON "SchedulingNotificationPreference"("workspaceId", "scopeType");
CREATE INDEX IF NOT EXISTS "SchedulingNotificationPreference_workspaceId_userId_idx"
  ON "SchedulingNotificationPreference"("workspaceId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SchedulingReminderSchedule_workspaceId_fkey'
      AND table_name = 'SchedulingReminderSchedule'
  ) THEN
    ALTER TABLE "SchedulingReminderSchedule"
      ADD CONSTRAINT "SchedulingReminderSchedule_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SchedulingNotificationPreference_workspaceId_fkey'
      AND table_name = 'SchedulingNotificationPreference'
  ) THEN
    ALTER TABLE "SchedulingNotificationPreference"
      ADD CONSTRAINT "SchedulingNotificationPreference_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "DomainOutboxEvent"
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastErrorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "lastErrorMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "DomainOutboxEvent"
SET "nextAttemptAt" = COALESCE("nextAttemptAt", "availableAt")
WHERE "status" IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS "DomainOutboxEvent_status_nextAttemptAt_idx"
  ON "DomainOutboxEvent"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "DomainOutboxEvent_status_leaseExpiresAt_idx"
  ON "DomainOutboxEvent"("status", "leaseExpiresAt");

-- Do not replay historical scheduling outbox rows as new user notifications
-- during Phase 2 cutover.
UPDATE "DomainOutboxEvent"
SET "payload" = COALESCE("payload", '{}'::jsonb) || '{"notificationEligible": false}'::jsonb
WHERE "topic" LIKE 'scheduling.%'
  AND "processedAt" IS NULL
  AND NOT ("payload" ? 'notificationEligible');

ALTER TABLE "SchedulingEvent"
  ADD COLUMN IF NOT EXISTS "reminderPolicy" JSONB;
