-- Add nullable conversion identity. Existing Leads remain explicitly unconverted.
ALTER TABLE "Lead"
ADD COLUMN "convertedCustomerId" TEXT,
ADD COLUMN "convertedAt" TIMESTAMP(3);

-- A Customer can be the durable conversion result of at most one Lead.
CREATE UNIQUE INDEX "Lead_convertedCustomerId_workspaceId_key"
ON "Lead"("convertedCustomerId", "workspaceId");

CREATE INDEX "Lead_workspaceId_convertedAt_idx"
ON "Lead"("workspaceId", "convertedAt");

-- The composite reference makes cross-workspace conversion links impossible.
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_convertedCustomerId_workspaceId_fkey"
FOREIGN KEY ("convertedCustomerId", "workspaceId")
REFERENCES "Customer"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;
