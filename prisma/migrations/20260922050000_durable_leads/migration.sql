-- Durable Simple Service Lead stages. Existing browser records are not imported.
CREATE TYPE "LeadStage" AS ENUM (
  'NEW',
  'CONTACTED',
  'ESTIMATE_VISIT',
  'FOLLOW_UP',
  'WON',
  'LOST'
);

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "companyName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
  "source" TEXT,
  "estimatedValueCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "nextStep" TEXT,
  "followUpAt" TIMESTAMP(3),
  "assignedMemberId" TEXT,
  "notes" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lead_id_workspaceId_key"
ON "Lead"("id", "workspaceId");

CREATE INDEX "Lead_workspaceId_archivedAt_stage_idx"
ON "Lead"("workspaceId", "archivedAt", "stage");

CREATE INDEX "Lead_workspaceId_assignedMemberId_archivedAt_idx"
ON "Lead"("workspaceId", "assignedMemberId", "archivedAt");

CREATE INDEX "Lead_workspaceId_followUpAt_idx"
ON "Lead"("workspaceId", "followUpAt");

CREATE INDEX "Lead_workspaceId_displayName_idx"
ON "Lead"("workspaceId", "displayName");

CREATE INDEX "Lead_workspaceId_email_idx" ON "Lead"("workspaceId", "email");
CREATE INDEX "Lead_workspaceId_phone_idx" ON "Lead"("workspaceId", "phone");
CREATE INDEX "Lead_createdByUserId_idx" ON "Lead"("createdByUserId");

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_assignedMemberId_workspaceId_fkey"
FOREIGN KEY ("assignedMemberId", "workspaceId")
REFERENCES "WorkspaceMember"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
