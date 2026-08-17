DO $$
BEGIN
  CREATE TYPE "WorkspaceKnowledgeApprovalStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', 'SUPERSEDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WorkspaceKnowledgeVisibility" AS ENUM ('WORKSPACE', 'ADMINS_ONLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WorkspaceKnowledgeItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WorkspaceKnowledgeRevisionType" AS ENUM ('CREATED', 'UPDATED', 'APPROVED', 'REJECTED', 'ARCHIVED', 'SUPERSEDED', 'ROLLBACK_CANDIDATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WorkspaceKnowledgeApprovalAction" AS ENUM ('APPROVED', 'REJECTED', 'ARCHIVED', 'RESTORED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WorkspaceKnowledgeCorrectionStatus" AS ENUM ('CAPTURED', 'QUEUED_FOR_REVIEW', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WorkspaceRecommendationOutcomeStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'EDITED', 'IGNORED', 'EXECUTED', 'REVERSED', 'EXECUTION_FAILED', 'EXECUTION_SUCCEEDED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WorkspaceKnowledgeSource" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorWorkspaceMemberId" TEXT,
  "confidence" TEXT,
  "recordType" TEXT,
  "recordId" TEXT,
  "referenceId" TEXT,
  "metadata" JSONB,
  "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceKnowledgeSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceKnowledgeItem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sourceId" TEXT,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "structuredValue" JSONB NOT NULL,
  "sourceSummary" TEXT,
  "confidence" TEXT NOT NULL,
  "approvalStatus" "WorkspaceKnowledgeApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "supersededById" TEXT,
  "reason" TEXT,
  "tags" TEXT[] NOT NULL,
  "visibility" "WorkspaceKnowledgeVisibility" NOT NULL DEFAULT 'WORKSPACE',
  "status" "WorkspaceKnowledgeItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceKnowledgeItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceKnowledgeRevision" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "knowledgeItemId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "revisionType" "WorkspaceKnowledgeRevisionType" NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "structuredValue" JSONB NOT NULL,
  "confidence" TEXT NOT NULL,
  "approvalStatus" "WorkspaceKnowledgeApprovalStatus" NOT NULL,
  "changedById" TEXT NOT NULL,
  "changeSummary" TEXT,
  "previousRevisionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceKnowledgeRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceKnowledgeApproval" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "knowledgeItemId" TEXT NOT NULL,
  "action" "WorkspaceKnowledgeApprovalAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" "WorkspaceMemberRole" NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceKnowledgeApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceKnowledgeGap" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "affectedDomains" TEXT[] NOT NULL,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "frequency" INTEGER NOT NULL DEFAULT 1,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByKnowledgeId" TEXT,
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceKnowledgeGap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceKnowledgeCorrection" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "knowledgeItemId" TEXT,
  "correctionText" TEXT NOT NULL,
  "correctedValue" JSONB,
  "sourceDomain" TEXT,
  "targetCategory" TEXT,
  "submittedById" TEXT NOT NULL,
  "status" "WorkspaceKnowledgeCorrectionStatus" NOT NULL DEFAULT 'CAPTURED',
  "proposedKnowledgeId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceKnowledgeCorrection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceRecommendationOutcome" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "recommendationType" TEXT NOT NULL,
  "recommendationTitle" TEXT NOT NULL,
  "outcome" "WorkspaceRecommendationOutcomeStatus" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "sourceDomain" TEXT,
  "targetRecordType" TEXT,
  "targetRecordId" TEXT,
  "confidenceAtDecision" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceRecommendationOutcome_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceConfidenceAssessment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "score" DOUBLE PRECISION,
  "supportingFactors" TEXT[] NOT NULL,
  "limitingFactors" TEXT[] NOT NULL,
  "missingData" TEXT[] NOT NULL,
  "recommendedActions" TEXT[] NOT NULL,
  "metadata" JSONB,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceConfidenceAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceLearningEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "knowledgeItemId" TEXT,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT,
  "source" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceLearningEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformLearningSignal" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "aggregateCount" INTEGER NOT NULL DEFAULT 1,
  "confidence" TEXT,
  "metadata" JSONB,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformLearningSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeSource_workspaceId_type_idx" ON "WorkspaceKnowledgeSource"("workspaceId", "type");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeSource_workspaceId_domain_idx" ON "WorkspaceKnowledgeSource"("workspaceId", "domain");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeSource_workspaceId_recordType_recordId_idx" ON "WorkspaceKnowledgeSource"("workspaceId", "recordType", "recordId");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeSource_workspaceId_inspectedAt_idx" ON "WorkspaceKnowledgeSource"("workspaceId", "inspectedAt");

CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeItem_workspaceId_approvalStatus_isArchived_idx" ON "WorkspaceKnowledgeItem"("workspaceId", "approvalStatus", "isArchived");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeItem_workspaceId_category_idx" ON "WorkspaceKnowledgeItem"("workspaceId", "category");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeItem_workspaceId_createdAt_idx" ON "WorkspaceKnowledgeItem"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeItem_workspaceId_updatedAt_idx" ON "WorkspaceKnowledgeItem"("workspaceId", "updatedAt");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeItem_sourceId_idx" ON "WorkspaceKnowledgeItem"("sourceId");

CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeRevision_workspaceId_knowledgeItemId_version_idx" ON "WorkspaceKnowledgeRevision"("workspaceId", "knowledgeItemId", "version");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeRevision_workspaceId_revisionType_createdAt_idx" ON "WorkspaceKnowledgeRevision"("workspaceId", "revisionType", "createdAt");

CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeApproval_workspaceId_action_createdAt_idx" ON "WorkspaceKnowledgeApproval"("workspaceId", "action", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeApproval_workspaceId_knowledgeItemId_createdAt_idx" ON "WorkspaceKnowledgeApproval"("workspaceId", "knowledgeItemId", "createdAt");

CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeGap_workspaceId_category_isResolved_idx" ON "WorkspaceKnowledgeGap"("workspaceId", "category", "isResolved");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeGap_workspaceId_severity_lastDetectedAt_idx" ON "WorkspaceKnowledgeGap"("workspaceId", "severity", "lastDetectedAt");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeGap_workspaceId_isResolved_lastDetectedAt_idx" ON "WorkspaceKnowledgeGap"("workspaceId", "isResolved", "lastDetectedAt");

CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeCorrection_workspaceId_status_createdAt_idx" ON "WorkspaceKnowledgeCorrection"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceKnowledgeCorrection_workspaceId_knowledgeItemId_idx" ON "WorkspaceKnowledgeCorrection"("workspaceId", "knowledgeItemId");

CREATE INDEX IF NOT EXISTS "WorkspaceRecommendationOutcome_workspaceId_recommendationId_idx" ON "WorkspaceRecommendationOutcome"("workspaceId", "recommendationId");
CREATE INDEX IF NOT EXISTS "WorkspaceRecommendationOutcome_workspaceId_outcome_occurredAt_idx" ON "WorkspaceRecommendationOutcome"("workspaceId", "outcome", "occurredAt");
CREATE INDEX IF NOT EXISTS "WorkspaceRecommendationOutcome_workspaceId_sourceDomain_occurredAt_idx" ON "WorkspaceRecommendationOutcome"("workspaceId", "sourceDomain", "occurredAt");

CREATE INDEX IF NOT EXISTS "WorkspaceConfidenceAssessment_workspaceId_scope_assessedAt_idx" ON "WorkspaceConfidenceAssessment"("workspaceId", "scope", "assessedAt");
CREATE INDEX IF NOT EXISTS "WorkspaceConfidenceAssessment_workspaceId_level_assessedAt_idx" ON "WorkspaceConfidenceAssessment"("workspaceId", "level", "assessedAt");

CREATE INDEX IF NOT EXISTS "WorkspaceLearningEvent_workspaceId_eventType_createdAt_idx" ON "WorkspaceLearningEvent"("workspaceId", "eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceLearningEvent_workspaceId_knowledgeItemId_idx" ON "WorkspaceLearningEvent"("workspaceId", "knowledgeItemId");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformLearningSignal_category_label_key" ON "PlatformLearningSignal"("category", "label");
CREATE INDEX IF NOT EXISTS "PlatformLearningSignal_category_lastObservedAt_idx" ON "PlatformLearningSignal"("category", "lastObservedAt");

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeSource"
    ADD CONSTRAINT "WorkspaceKnowledgeSource_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeItem"
    ADD CONSTRAINT "WorkspaceKnowledgeItem_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeItem"
    ADD CONSTRAINT "WorkspaceKnowledgeItem_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "WorkspaceKnowledgeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeItem"
    ADD CONSTRAINT "WorkspaceKnowledgeItem_supersededById_fkey"
    FOREIGN KEY ("supersededById") REFERENCES "WorkspaceKnowledgeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeRevision"
    ADD CONSTRAINT "WorkspaceKnowledgeRevision_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeRevision"
    ADD CONSTRAINT "WorkspaceKnowledgeRevision_knowledgeItemId_fkey"
    FOREIGN KEY ("knowledgeItemId") REFERENCES "WorkspaceKnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeRevision"
    ADD CONSTRAINT "WorkspaceKnowledgeRevision_previousRevisionId_fkey"
    FOREIGN KEY ("previousRevisionId") REFERENCES "WorkspaceKnowledgeRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeApproval"
    ADD CONSTRAINT "WorkspaceKnowledgeApproval_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeApproval"
    ADD CONSTRAINT "WorkspaceKnowledgeApproval_knowledgeItemId_fkey"
    FOREIGN KEY ("knowledgeItemId") REFERENCES "WorkspaceKnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeGap"
    ADD CONSTRAINT "WorkspaceKnowledgeGap_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeCorrection"
    ADD CONSTRAINT "WorkspaceKnowledgeCorrection_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceKnowledgeCorrection"
    ADD CONSTRAINT "WorkspaceKnowledgeCorrection_knowledgeItemId_fkey"
    FOREIGN KEY ("knowledgeItemId") REFERENCES "WorkspaceKnowledgeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceRecommendationOutcome"
    ADD CONSTRAINT "WorkspaceRecommendationOutcome_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceConfidenceAssessment"
    ADD CONSTRAINT "WorkspaceConfidenceAssessment_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceLearningEvent"
    ADD CONSTRAINT "WorkspaceLearningEvent_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkspaceLearningEvent"
    ADD CONSTRAINT "WorkspaceLearningEvent_knowledgeItemId_fkey"
    FOREIGN KEY ("knowledgeItemId") REFERENCES "WorkspaceKnowledgeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
