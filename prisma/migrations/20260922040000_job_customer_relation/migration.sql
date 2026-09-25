-- Add an optional durable Customer identity to Jobs. Existing Jobs remain
-- unlinked: legacy reference IDs and display-name snapshots are not backfilled.
ALTER TABLE "Job" ADD COLUMN "customerId" TEXT;

CREATE INDEX "Job_workspaceId_customerId_archivedAt_idx"
ON "Job"("workspaceId", "customerId", "archivedAt");

-- The composite key prevents a Job from referencing a Customer in another
-- workspace. Customer archival keeps the row, so historical Jobs remain valid.
ALTER TABLE "Job"
ADD CONSTRAINT "Job_customerId_workspaceId_fkey"
FOREIGN KEY ("customerId", "workspaceId")
REFERENCES "Customer"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;
