-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'OUTLOOK', 'CALENDLY', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'SMS', 'INTERNAL');

-- CreateTable
CREATE TABLE "CalendarAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "credentialRef" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "CalendarAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingType" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "bufferBefore" INTEGER NOT NULL DEFAULT 0,
    "bufferAfter" INTEGER NOT NULL DEFAULT 0,
    "maxPerDay" INTEGER,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "publicPath" TEXT,

    CONSTRAINT "BookingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityWindow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "bookingTypeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dateOverride" TIMESTAMP(3),
    "startTimeMinutes" INTEGER NOT NULL,
    "endTimeMinutes" INTEGER NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL,

    CONSTRAINT "AvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "bookingTypeId" TEXT NOT NULL,
    "scheduledForUserId" TEXT,
    "createdByUserId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "CalendarProvider",
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT,
    "source" TEXT,
    "externalEventId" TEXT,
    "externalUrl" TEXT,
    "answers" JSONB,
    "aiQualificationScore" INTEGER,
    "aiSummary" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescheduleToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescheduleToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderSequence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "bookingTypeId" TEXT NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReminderSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCalendarEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "calendarAccountId" TEXT,
    "provider" "CalendarProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "bookingId" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarAccount_userId_idx" ON "CalendarAccount"("userId");

-- CreateIndex
CREATE INDEX "CalendarAccount_workspaceId_idx" ON "CalendarAccount"("workspaceId");

-- CreateIndex
CREATE INDEX "CalendarAccount_provider_externalId_idx" ON "CalendarAccount"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingType_slug_key" ON "BookingType"("slug");

-- CreateIndex
CREATE INDEX "BookingType_workspaceId_idx" ON "BookingType"("workspaceId");

-- CreateIndex
CREATE INDEX "BookingType_slug_idx" ON "BookingType"("slug");

-- CreateIndex
CREATE INDEX "BookingType_assignedUserId_idx" ON "BookingType"("assignedUserId");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_workspaceId_idx" ON "AvailabilityWindow"("workspaceId");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_bookingTypeId_idx" ON "AvailabilityWindow"("bookingTypeId");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_dayOfWeek_idx" ON "AvailabilityWindow"("dayOfWeek");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_dateOverride_idx" ON "AvailabilityWindow"("dateOverride");

-- CreateIndex
CREATE INDEX "Booking_workspaceId_idx" ON "Booking"("workspaceId");

-- CreateIndex
CREATE INDEX "Booking_bookingTypeId_idx" ON "Booking"("bookingTypeId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_guestEmail_idx" ON "Booking"("guestEmail");

-- CreateIndex
CREATE INDEX "Booking_provider_externalEventId_idx" ON "Booking"("provider", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "RescheduleToken_token_key" ON "RescheduleToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RescheduleToken_bookingId_key" ON "RescheduleToken"("bookingId");

-- CreateIndex
CREATE INDEX "RescheduleToken_bookingId_idx" ON "RescheduleToken"("bookingId");

-- CreateIndex
CREATE INDEX "RescheduleToken_token_idx" ON "RescheduleToken"("token");

-- CreateIndex
CREATE INDEX "ReminderSequence_workspaceId_idx" ON "ReminderSequence"("workspaceId");

-- CreateIndex
CREATE INDEX "ReminderSequence_bookingTypeId_idx" ON "ReminderSequence"("bookingTypeId");

-- CreateIndex
CREATE INDEX "ReminderSequence_channel_idx" ON "ReminderSequence"("channel");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_workspaceId_idx" ON "ExternalCalendarEvent"("workspaceId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_calendarAccountId_idx" ON "ExternalCalendarEvent"("calendarAccountId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_provider_externalId_idx" ON "ExternalCalendarEvent"("provider", "externalId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_bookingId_idx" ON "ExternalCalendarEvent"("bookingId");

-- AddForeignKey
ALTER TABLE "CalendarAccount" ADD CONSTRAINT "CalendarAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarAccount" ADD CONSTRAINT "CalendarAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingType" ADD CONSTRAINT "BookingType_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingType" ADD CONSTRAINT "BookingType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingType" ADD CONSTRAINT "BookingType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT "AvailabilityWindow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT "AvailabilityWindow_bookingTypeId_fkey" FOREIGN KEY ("bookingTypeId") REFERENCES "BookingType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookingTypeId_fkey" FOREIGN KEY ("bookingTypeId") REFERENCES "BookingType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_scheduledForUserId_fkey" FOREIGN KEY ("scheduledForUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescheduleToken" ADD CONSTRAINT "RescheduleToken_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSequence" ADD CONSTRAINT "ReminderSequence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSequence" ADD CONSTRAINT "ReminderSequence_bookingTypeId_fkey" FOREIGN KEY ("bookingTypeId") REFERENCES "BookingType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_calendarAccountId_fkey" FOREIGN KEY ("calendarAccountId") REFERENCES "CalendarAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
