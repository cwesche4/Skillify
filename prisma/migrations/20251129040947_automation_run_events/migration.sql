-- CreateTable
CREATE TABLE "AutomationRunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL,
    "message" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRunEvent_runId_idx" ON "AutomationRunEvent"("runId");

-- CreateIndex
CREATE INDEX "AutomationRunEvent_nodeId_idx" ON "AutomationRunEvent"("nodeId");

-- CreateIndex
CREATE INDEX "AutomationRunEvent_nodeType_idx" ON "AutomationRunEvent"("nodeType");

-- CreateIndex
CREATE INDEX "AutomationRunEvent_status_idx" ON "AutomationRunEvent"("status");

-- AddForeignKey
ALTER TABLE "AutomationRunEvent" ADD CONSTRAINT "AutomationRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
