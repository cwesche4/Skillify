-- Phase 8A durable Recurring Service foundation. Scheduling remains the only
-- recurrence engine; these tables store the business template and future Job
-- Step templates without creating Jobs or WorkItems.

-- CreateEnum
CREATE TYPE "RecurringServiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- Scheduling series IDs are globally unique already. This composite key lets
-- workspace-scoped foreign keys enforce that linked records share a workspace.
CREATE UNIQUE INDEX "SchedulingRecurrenceSeries_id_workspaceId_key"
ON "SchedulingRecurrenceSeries"("id", "workspaceId");

-- CreateTable
CREATE TABLE "RecurringService" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "recurrenceSeriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceInstructions" TEXT,
    "pricePerVisitCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "defaultJobPriority" "OperationsPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "RecurringServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "RecurringService_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecurringService_name_nonempty_check" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "RecurringService_price_nonnegative_check" CHECK ("pricePerVisitCents" >= 0),
    CONSTRAINT "RecurringService_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "RecurringService_ended_timestamp_check" CHECK (("status" = 'ENDED') = ("endedAt" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "RecurringServiceStepTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "recurringServiceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringServiceStepTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecurringServiceStepTemplate_title_nonempty_check" CHECK (length(btrim("title")) > 0),
    CONSTRAINT "RecurringServiceStepTemplate_sort_order_check" CHECK ("sortOrder" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringService_id_workspaceId_key"
ON "RecurringService"("id", "workspaceId");
CREATE UNIQUE INDEX "RecurringService_recurrenceSeriesId_workspaceId_key"
ON "RecurringService"("recurrenceSeriesId", "workspaceId");
CREATE INDEX "RecurringService_workspaceId_status_customerId_idx"
ON "RecurringService"("workspaceId", "status", "customerId");
CREATE INDEX "RecurringService_createdByUserId_idx"
ON "RecurringService"("createdByUserId");
CREATE UNIQUE INDEX "RecurringServiceStepTemplate_recurringServiceId_sortOrder_key"
ON "RecurringServiceStepTemplate"("recurringServiceId", "sortOrder");
CREATE INDEX "RecurringServiceStepTemplate_workspaceId_recurringServiceId_sortOrder_idx"
ON "RecurringServiceStepTemplate"("workspaceId", "recurringServiceId", "sortOrder");

-- AddForeignKey
ALTER TABLE "RecurringService" ADD CONSTRAINT "RecurringService_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringService" ADD CONSTRAINT "RecurringService_customerId_workspaceId_fkey"
FOREIGN KEY ("customerId", "workspaceId") REFERENCES "Customer"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringService" ADD CONSTRAINT "RecurringService_recurrenceSeriesId_workspaceId_fkey"
FOREIGN KEY ("recurrenceSeriesId", "workspaceId") REFERENCES "SchedulingRecurrenceSeries"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringService" ADD CONSTRAINT "RecurringService_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringServiceStepTemplate" ADD CONSTRAINT "RecurringServiceStepTemplate_recurringServiceId_workspaceId_fkey"
FOREIGN KEY ("recurringServiceId", "workspaceId") REFERENCES "RecurringService"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
