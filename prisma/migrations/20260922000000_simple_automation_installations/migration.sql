-- CreateTable
CREATE TABLE "SimpleAutomationInstallation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "definitionKey" TEXT NOT NULL,
    "definitionVersion" INTEGER NOT NULL,
    "automationId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "metadata" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "lastConfiguredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimpleAutomationInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SimpleAutomationInstallation_automationId_key" ON "SimpleAutomationInstallation"("automationId");

-- CreateIndex
CREATE INDEX "SimpleAutomationInstallation_workspaceId_idx" ON "SimpleAutomationInstallation"("workspaceId");

-- CreateIndex
CREATE INDEX "SimpleAutomationInstallation_definitionKey_definitionVersio_idx" ON "SimpleAutomationInstallation"("definitionKey", "definitionVersion");

-- CreateIndex
CREATE INDEX "SimpleAutomationInstallation_createdByUserId_idx" ON "SimpleAutomationInstallation"("createdByUserId");

-- CreateIndex
CREATE INDEX "SimpleAutomationInstallation_lastConfiguredByUserId_idx" ON "SimpleAutomationInstallation"("lastConfiguredByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SimpleAutomationInstallation_workspaceId_definitionKey_key" ON "SimpleAutomationInstallation"("workspaceId", "definitionKey");

-- AddForeignKey
ALTER TABLE "SimpleAutomationInstallation" ADD CONSTRAINT "SimpleAutomationInstallation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimpleAutomationInstallation" ADD CONSTRAINT "SimpleAutomationInstallation_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimpleAutomationInstallation" ADD CONSTRAINT "SimpleAutomationInstallation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimpleAutomationInstallation" ADD CONSTRAINT "SimpleAutomationInstallation_lastConfiguredByUserId_fkey" FOREIGN KEY ("lastConfiguredByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
