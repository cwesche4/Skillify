DO $$
BEGIN
  CREATE TYPE "WorkspaceAIStatus" AS ENUM ('NOT_CONFIGURED', 'READY', 'PAUSED', 'DISABLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WorkspaceAIActivityType" AS ENUM (
    'PROFILE_CREATED',
    'PROFILE_UPDATED',
    'STATUS_CHANGED',
    'CONTEXT_RESOLVED',
    'REQUEST_STARTED',
    'REQUEST_COMPLETED',
    'REQUEST_FAILED',
    'ACTION_PROPOSED',
    'ACTION_APPROVED',
    'ACTION_REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WorkspaceAIProfile" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "status" "WorkspaceAIStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "businessSummary" TEXT,
  "productsAndServices" JSONB,
  "operatingGuidelines" JSONB,
  "brandVoice" JSONB,
  "customerPolicies" JSONB,
  "automationGuardrails" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceAIProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceAIActivity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "type" "WorkspaceAIActivityType" NOT NULL,
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceAIActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceAIProfile_workspaceId_key" ON "WorkspaceAIProfile"("workspaceId");
CREATE INDEX IF NOT EXISTS "WorkspaceAIProfile_workspaceId_status_idx" ON "WorkspaceAIProfile"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "WorkspaceAIActivity_workspaceId_createdAt_idx" ON "WorkspaceAIActivity"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceAIActivity_workspaceId_type_createdAt_idx" ON "WorkspaceAIActivity"("workspaceId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceAIActivity_userId_createdAt_idx" ON "WorkspaceAIActivity"("userId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "WorkspaceAIProfile"
    ADD CONSTRAINT "WorkspaceAIProfile_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceAIActivity"
    ADD CONSTRAINT "WorkspaceAIActivity_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "WorkspaceAIProfile" ("id", "workspaceId", "enabled", "status", "createdAt", "updatedAt")
SELECT 'workspace_ai_' || "id", "id", false, 'NOT_CONFIGURED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace"
ON CONFLICT ("workspaceId") DO NOTHING;
