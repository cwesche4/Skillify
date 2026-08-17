CREATE TYPE "CalendarConnectionPurpose" AS ENUM (
  'PERSONAL',
  'INDIVIDUAL_WORK',
  'WORKSPACE_SHARED',
  'RESOURCE',
  'UNKNOWN'
);

CREATE TYPE "CalendarPurposeClassificationSource" AS ENUM (
  'MEMBER_SELECTED',
  'ADMIN_CONFIRMED',
  'PROVIDER_METADATA',
  'DOMAIN_HEURISTIC',
  'MIGRATION',
  'UNKNOWN'
);

CREATE TYPE "PersonalCalendarAvailabilityBehavior" AS ENUM (
  'IGNORE',
  'SUGGEST_CONFLICTS',
  'BLOCK_AVAILABILITY'
);

CREATE TYPE "PersonalCalendarBusyDisplayMode" AS ENUM (
  'HIDDEN',
  'MEMBER_DETAIL_ONLY',
  'EXPANDABLE_EXTERNAL_AVAILABILITY',
  'VISIBLE_IN_BUSY'
);

ALTER TABLE "CalendarConnection"
  ADD COLUMN "connectionPurpose" "CalendarConnectionPurpose" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "classificationSource" "CalendarPurposeClassificationSource" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "classificationConfidence" DOUBLE PRECISION,
  ADD COLUMN "classifiedAt" TIMESTAMP(3),
  ADD COLUMN "classifiedByWorkspaceMemberId" TEXT,
  ADD COLUMN "adminConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "adminConfirmedByWorkspaceMemberId" TEXT,
  ADD COLUMN "availabilityBehavior" "PersonalCalendarAvailabilityBehavior" NOT NULL DEFAULT 'IGNORE',
  ADD COLUMN "busyDisplayMode" "PersonalCalendarBusyDisplayMode" NOT NULL DEFAULT 'HIDDEN';

ALTER TABLE "ConnectedCalendar"
  ADD COLUMN "calendarPurpose" "CalendarConnectionPurpose" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "classificationSource" "CalendarPurposeClassificationSource" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "classificationConfidence" DOUBLE PRECISION,
  ADD COLUMN "classifiedAt" TIMESTAMP(3),
  ADD COLUMN "classifiedByWorkspaceMemberId" TEXT,
  ADD COLUMN "adminConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "adminConfirmedByWorkspaceMemberId" TEXT,
  ADD COLUMN "availabilityBehavior" "PersonalCalendarAvailabilityBehavior" NOT NULL DEFAULT 'IGNORE',
  ADD COLUMN "busyDisplayMode" "PersonalCalendarBusyDisplayMode" NOT NULL DEFAULT 'HIDDEN';

UPDATE "CalendarConnection"
SET
  "connectionPurpose" = CASE
    WHEN "ownershipType" = 'WORKSPACE' THEN 'WORKSPACE_SHARED'::"CalendarConnectionPurpose"
    ELSE 'UNKNOWN'::"CalendarConnectionPurpose"
  END,
  "classificationSource" = 'MIGRATION'::"CalendarPurposeClassificationSource",
  "classificationConfidence" = CASE
    WHEN "ownershipType" = 'WORKSPACE' THEN 0.8
    ELSE 0.2
  END,
  "classifiedAt" = NOW(),
  "availabilityBehavior" = CASE
    WHEN "ownershipType" = 'WORKSPACE' THEN 'BLOCK_AVAILABILITY'::"PersonalCalendarAvailabilityBehavior"
    ELSE 'SUGGEST_CONFLICTS'::"PersonalCalendarAvailabilityBehavior"
  END,
  "busyDisplayMode" = CASE
    WHEN "ownershipType" = 'WORKSPACE' THEN 'VISIBLE_IN_BUSY'::"PersonalCalendarBusyDisplayMode"
    ELSE 'HIDDEN'::"PersonalCalendarBusyDisplayMode"
  END;

UPDATE "ConnectedCalendar" AS calendar
SET
  "calendarPurpose" = connection."connectionPurpose",
  "classificationSource" = 'MIGRATION'::"CalendarPurposeClassificationSource",
  "classificationConfidence" = connection."classificationConfidence",
  "classifiedAt" = NOW(),
  "availabilityBehavior" = connection."availabilityBehavior",
  "busyDisplayMode" = connection."busyDisplayMode"
FROM "CalendarConnection" AS connection
WHERE calendar."connectionId" = connection."id";

CREATE INDEX "CalendarConnection_workspaceId_connectionPurpose_idx"
  ON "CalendarConnection"("workspaceId", "connectionPurpose");

CREATE INDEX "ConnectedCalendar_workspaceId_calendarPurpose_idx"
  ON "ConnectedCalendar"("workspaceId", "calendarPurpose");
