ALTER TABLE "Workspace"
  ADD COLUMN "businessName" TEXT,
  ADD COLUMN "industry" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Workspace_archivedAt_idx" ON "Workspace"("archivedAt");
