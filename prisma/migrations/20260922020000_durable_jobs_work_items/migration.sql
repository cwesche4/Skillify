-- Durable operations foundation. Existing preview Service Request and Task data
-- remains browser-local and is intentionally not backfilled.

-- CreateEnum
CREATE TYPE "OperationsPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "WorkItemKind" AS ENUM ('JOB_STEP', 'TODO');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- Workspace-scoped assignment relations use the member and workspace together
-- so a member from another workspace cannot be attached at the database layer.
CREATE UNIQUE INDEX "WorkspaceMember_id_workspaceId_key" ON "WorkspaceMember"("id", "workspaceId");

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "OperationsPriority" NOT NULL DEFAULT 'NORMAL',
    "customerReferenceId" TEXT,
    "customerDisplayName" TEXT,
    "valueCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assigneeMemberId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Job_valueCents_nonnegative_check" CHECK ("valueCents" IS NULL OR "valueCents" >= 0),
    CONSTRAINT "Job_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "Job_schedule_window_check" CHECK ("scheduledStartAt" IS NULL OR "scheduledEndAt" IS NULL OR "scheduledEndAt" > "scheduledStartAt"),
    CONSTRAINT "Job_completion_timestamp_check" CHECK (("status" = 'COMPLETED') = ("completedAt" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "WorkItemKind" NOT NULL,
    "jobId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "OperationsPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assigneeMemberId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkItem_kind_job_check" CHECK (("kind" = 'JOB_STEP' AND "jobId" IS NOT NULL) OR ("kind" = 'TODO' AND "jobId" IS NULL)),
    CONSTRAINT "WorkItem_completion_timestamp_check" CHECK (("status" = 'COMPLETED') = ("completedAt" IS NOT NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_id_workspaceId_key" ON "Job"("id", "workspaceId");
CREATE INDEX "Job_workspaceId_archivedAt_status_idx" ON "Job"("workspaceId", "archivedAt", "status");
CREATE INDEX "Job_workspaceId_assigneeMemberId_archivedAt_idx" ON "Job"("workspaceId", "assigneeMemberId", "archivedAt");
CREATE INDEX "Job_workspaceId_scheduledStartAt_idx" ON "Job"("workspaceId", "scheduledStartAt");
CREATE INDEX "Job_workspaceId_customerReferenceId_idx" ON "Job"("workspaceId", "customerReferenceId");
CREATE INDEX "Job_createdByUserId_idx" ON "Job"("createdByUserId");

-- CreateIndex
CREATE INDEX "WorkItem_workspaceId_archivedAt_kind_status_idx" ON "WorkItem"("workspaceId", "archivedAt", "kind", "status");
CREATE INDEX "WorkItem_workspaceId_jobId_archivedAt_idx" ON "WorkItem"("workspaceId", "jobId", "archivedAt");
CREATE INDEX "WorkItem_workspaceId_assigneeMemberId_archivedAt_idx" ON "WorkItem"("workspaceId", "assigneeMemberId", "archivedAt");
CREATE INDEX "WorkItem_workspaceId_dueAt_idx" ON "WorkItem"("workspaceId", "dueAt");
CREATE INDEX "WorkItem_createdByUserId_idx" ON "WorkItem"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_assigneeMemberId_workspaceId_fkey" FOREIGN KEY ("assigneeMemberId", "workspaceId") REFERENCES "WorkspaceMember"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_jobId_workspaceId_fkey" FOREIGN KEY ("jobId", "workspaceId") REFERENCES "Job"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeMemberId_workspaceId_fkey" FOREIGN KEY ("assigneeMemberId", "workspaceId") REFERENCES "WorkspaceMember"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
