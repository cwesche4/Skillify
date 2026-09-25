-- Durable Customer backend foundation for Simple Service workspaces.
-- Existing browser preview Customers are intentionally not backfilled.

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "serviceAddressLine1" TEXT,
    "serviceAddressLine2" TEXT,
    "serviceAddressCity" TEXT,
    "serviceAddressRegion" TEXT,
    "serviceAddressPostalCode" TEXT,
    "serviceAddressCountry" TEXT,
    "notes" TEXT,
    "assignedMemberId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Customer_displayName_nonempty_check" CHECK (length(btrim("displayName")) > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_id_workspaceId_key" ON "Customer"("id", "workspaceId");
CREATE INDEX "Customer_workspaceId_archivedAt_displayName_idx" ON "Customer"("workspaceId", "archivedAt", "displayName");
CREATE INDEX "Customer_workspaceId_email_idx" ON "Customer"("workspaceId", "email");
CREATE INDEX "Customer_workspaceId_phone_idx" ON "Customer"("workspaceId", "phone");
CREATE INDEX "Customer_workspaceId_assignedMemberId_archivedAt_idx" ON "Customer"("workspaceId", "assignedMemberId", "archivedAt");
CREATE INDEX "Customer_createdByUserId_idx" ON "Customer"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedMemberId_workspaceId_fkey" FOREIGN KEY ("assignedMemberId", "workspaceId") REFERENCES "WorkspaceMember"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
