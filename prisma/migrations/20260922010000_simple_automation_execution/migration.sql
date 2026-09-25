-- AlterTable
ALTER TABLE "SimpleAutomationInstallation" ADD COLUMN "removedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SimpleAutomationDispatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "runId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SimpleAutomationDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimpleAutomationInstallation_workspaceId_removedAt_idx" ON "SimpleAutomationInstallation"("workspaceId", "removedAt");

-- CreateIndex
CREATE INDEX "SimpleAutomationDispatch_workspaceId_createdAt_idx" ON "SimpleAutomationDispatch"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SimpleAutomationDispatch_status_updatedAt_idx" ON "SimpleAutomationDispatch"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SimpleAutomationDispatch_installationId_eventKey_key" ON "SimpleAutomationDispatch"("installationId", "eventKey");

-- AddForeignKey
ALTER TABLE "SimpleAutomationDispatch" ADD CONSTRAINT "SimpleAutomationDispatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimpleAutomationDispatch" ADD CONSTRAINT "SimpleAutomationDispatch_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "SimpleAutomationInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
