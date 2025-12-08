/*
  Warnings:

  - A unique constraint covering the columns `[provider,externalId]` on the table `ExternalCalendarEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ExternalCalendarEvent_bookingId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendarEvent_provider_externalId_key" ON "ExternalCalendarEvent"("provider", "externalId");
