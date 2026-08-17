DO $$
BEGIN
  CREATE TYPE "OperationalInsightStatus" AS ENUM ('NEW', 'ACTIVE', 'RECURRING', 'RESOLVED', 'SUPERSEDED', 'DISMISSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OperationalSeverity" AS ENUM ('INFO', 'NOTICE', 'WARNING', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OperationalConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OperationalTrendDirection" AS ENUM ('IMPROVING', 'STABLE', 'DECLINING', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OperationalRecommendationHistoryStatus" AS ENUM ('GENERATED', 'APPROVED', 'EXECUTED', 'IGNORED', 'EXPIRED', 'SUCCESSFUL', 'UNSUCCESSFUL', 'PARTIALLY_SUCCESSFUL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OperationalKnowledgeUsageOutcome" AS ENUM ('APPLIED', 'IGNORED', 'OVERRIDDEN', 'REJECTED', 'RECOMMENDATION_ACCEPTED', 'RECOMMENDATION_DECLINED', 'OUTCOME_IMPROVED', 'OUTCOME_UNCHANGED', 'OUTCOME_WORSE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OperationalAuditAction" AS ENUM ('CREATED', 'UPDATED', 'RECURRED', 'RESOLVED', 'DISMISSED', 'ARCHIVED', 'SUPERSEDED', 'OUTCOME_RECORDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OperationalInsight" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "OperationalInsightStatus" NOT NULL DEFAULT 'NEW',
  "severity" "OperationalSeverity" NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "linkedEvidenceIds" TEXT[] NOT NULL,
  "linkedRecommendationIds" TEXT[] NOT NULL,
  "resolutionId" TEXT,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceResponseId" TEXT,
  "sourceRuntimeRequestId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalFinding" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "insightId" TEXT,
  "domain" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "OperationalInsightStatus" NOT NULL DEFAULT 'ACTIVE',
  "severity" "OperationalSeverity" NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL,
  "evidenceIds" TEXT[] NOT NULL,
  "recommendationIds" TEXT[] NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalEvidence" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "evidenceKey" TEXT NOT NULL,
  "sourceOperationalInsightId" TEXT,
  "sourceResponseId" TEXT,
  "domain" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "provider" TEXT,
  "confidence" "OperationalConfidence" NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "occurredAt" TIMESTAMP(3),
  "referenceId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalExplanation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "explanationKey" TEXT NOT NULL,
  "recommendationId" TEXT,
  "sourceResponseId" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL,
  "businessRuleIds" TEXT[] NOT NULL,
  "evidenceIds" TEXT[] NOT NULL,
  "rejectedAlternativeIds" TEXT[] NOT NULL,
  "knowledgeUsed" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalExplanation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalDecision" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "decisionKey" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "decisionType" TEXT NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL,
  "evidenceIds" TEXT[] NOT NULL,
  "businessRuleIds" TEXT[] NOT NULL,
  "rejectedAlternativeIds" TEXT[] NOT NULL,
  "proposalOnly" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalRecommendationHistory" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "recommendationType" TEXT NOT NULL,
  "recommendationTitle" TEXT NOT NULL,
  "status" "OperationalRecommendationHistoryStatus" NOT NULL DEFAULT 'GENERATED',
  "sourceDomain" TEXT,
  "sourceResponseId" TEXT,
  "targetRecordType" TEXT,
  "targetRecordId" TEXT,
  "confidenceAtGeneration" "OperationalConfidence" NOT NULL,
  "evidenceIds" TEXT[] NOT NULL,
  "metadata" JSONB,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalRecommendationHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalRecommendationOutcome" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "recommendationHistoryId" TEXT,
  "recommendationId" TEXT NOT NULL,
  "outcome" "OperationalRecommendationHistoryStatus" NOT NULL,
  "actorUserId" TEXT,
  "sourceDomain" TEXT,
  "targetRecordType" TEXT,
  "targetRecordId" TEXT,
  "evidenceIds" TEXT[] NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalRecommendationOutcome_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalHealthSnapshot" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "snapshotKey" TEXT NOT NULL,
  "sourceResponseId" TEXT,
  "overallStatus" TEXT NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL,
  "signalCount" INTEGER NOT NULL DEFAULT 0,
  "riskCount" INTEGER NOT NULL DEFAULT 0,
  "trendDirection" "OperationalTrendDirection" NOT NULL DEFAULT 'UNKNOWN',
  "signals" JSONB NOT NULL,
  "metadata" JSONB,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalHealthSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalSignal" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "signalKey" TEXT NOT NULL,
  "sourceResponseId" TEXT,
  "domain" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "severity" "OperationalSeverity" NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL,
  "trendDirection" "OperationalTrendDirection" NOT NULL DEFAULT 'UNKNOWN',
  "evidenceIds" TEXT[] NOT NULL,
  "history" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalTrend" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "trendKey" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "direction" "OperationalTrendDirection" NOT NULL DEFAULT 'UNKNOWN',
  "severity" "OperationalSeverity" NOT NULL DEFAULT 'INFO',
  "confidence" "OperationalConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "currentValue" DOUBLE PRECISION,
  "previousValue" DOUBLE PRECISION,
  "evidenceIds" TEXT[] NOT NULL,
  "history" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalTrend_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalPattern" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "patternKey" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "direction" "OperationalTrendDirection" NOT NULL DEFAULT 'UNKNOWN',
  "severity" "OperationalSeverity" NOT NULL DEFAULT 'INFO',
  "confidence" "OperationalConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "evidenceIds" TEXT[] NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalPattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalRisk" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "riskKey" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "OperationalInsightStatus" NOT NULL DEFAULT 'ACTIVE',
  "severity" "OperationalSeverity" NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL,
  "evidenceIds" TEXT[] NOT NULL,
  "linkedInsightIds" TEXT[] NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalRisk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalResolution" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "insightId" TEXT,
  "resolutionType" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "actorUserId" TEXT,
  "evidenceIds" TEXT[] NOT NULL,
  "metadata" JSONB,
  "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalResolution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalMetricHistory" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "unit" TEXT,
  "direction" "OperationalTrendDirection" NOT NULL DEFAULT 'UNKNOWN',
  "evidenceIds" TEXT[] NOT NULL,
  "metadata" JSONB,
  "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalMetricHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalKnowledgeUsage" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "knowledgeItemId" TEXT,
  "knowledgeReferenceId" TEXT,
  "source" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "outcome" "OperationalKnowledgeUsageOutcome" NOT NULL,
  "sourceResponseId" TEXT,
  "recommendationId" TEXT,
  "affectedModules" TEXT[] NOT NULL,
  "evidenceIds" TEXT[] NOT NULL,
  "metadata" JSONB,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalKnowledgeUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalKnowledgeEffectiveness" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "knowledgeKey" TEXT NOT NULL,
  "knowledgeItemId" TEXT,
  "label" TEXT NOT NULL,
  "timesUsed" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP(3),
  "affectedModules" TEXT[] NOT NULL,
  "positiveOutcomes" INTEGER NOT NULL DEFAULT 0,
  "negativeOutcomes" INTEGER NOT NULL DEFAULT 0,
  "neutralOutcomes" INTEGER NOT NULL DEFAULT 0,
  "conflictsGenerated" INTEGER NOT NULL DEFAULT 0,
  "recommendationsGenerated" INTEGER NOT NULL DEFAULT 0,
  "operationalImpact" TEXT NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalKnowledgeEffectiveness_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalDashboardSignal" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "signalKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "severity" "OperationalSeverity" NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL,
  "trendDirection" "OperationalTrendDirection" NOT NULL DEFAULT 'UNKNOWN',
  "evidenceIds" TEXT[] NOT NULL,
  "healthSnapshotId" TEXT,
  "history" JSONB,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalDashboardSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalInsightRevision" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "insightId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "OperationalInsightStatus" NOT NULL,
  "severity" "OperationalSeverity" NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "evidenceIds" TEXT[] NOT NULL,
  "recommendationIds" TEXT[] NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalInsightRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalInsightAudit" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "insightId" TEXT,
  "action" "OperationalAuditAction" NOT NULL,
  "actorUserId" TEXT,
  "source" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalInsightAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformAggregateSignal" (
  "id" TEXT NOT NULL,
  "signalKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "severity" "OperationalSeverity" NOT NULL,
  "confidence" "OperationalConfidence" NOT NULL,
  "trendDirection" "OperationalTrendDirection" NOT NULL DEFAULT 'UNKNOWN',
  "workspaceCount" INTEGER NOT NULL DEFAULT 0,
  "evidence" JSONB,
  "metadata" JSONB,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformAggregateSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OperationalInsight_workspaceId_fingerprint_key" ON "OperationalInsight"("workspaceId", "fingerprint");
CREATE INDEX IF NOT EXISTS "OperationalInsight_workspaceId_status_lastSeenAt_idx" ON "OperationalInsight"("workspaceId", "status", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "OperationalInsight_workspaceId_domain_status_idx" ON "OperationalInsight"("workspaceId", "domain", "status");
CREATE INDEX IF NOT EXISTS "OperationalInsight_workspaceId_severity_lastSeenAt_idx" ON "OperationalInsight"("workspaceId", "severity", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "OperationalFinding_workspaceId_status_lastSeenAt_idx" ON "OperationalFinding"("workspaceId", "status", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "OperationalFinding_workspaceId_domain_status_idx" ON "OperationalFinding"("workspaceId", "domain", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalEvidence_workspaceId_evidenceKey_key" ON "OperationalEvidence"("workspaceId", "evidenceKey");
CREATE INDEX IF NOT EXISTS "OperationalEvidence_workspaceId_domain_createdAt_idx" ON "OperationalEvidence"("workspaceId", "domain", "createdAt");
CREATE INDEX IF NOT EXISTS "OperationalEvidence_workspaceId_sourceResponseId_idx" ON "OperationalEvidence"("workspaceId", "sourceResponseId");
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalExplanation_workspaceId_explanationKey_key" ON "OperationalExplanation"("workspaceId", "explanationKey");
CREATE INDEX IF NOT EXISTS "OperationalExplanation_workspaceId_recommendationId_idx" ON "OperationalExplanation"("workspaceId", "recommendationId");
CREATE INDEX IF NOT EXISTS "OperationalExplanation_workspaceId_sourceResponseId_idx" ON "OperationalExplanation"("workspaceId", "sourceResponseId");
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalDecision_workspaceId_decisionKey_key" ON "OperationalDecision"("workspaceId", "decisionKey");
CREATE INDEX IF NOT EXISTS "OperationalDecision_workspaceId_recommendationId_decidedAt_idx" ON "OperationalDecision"("workspaceId", "recommendationId", "decidedAt");
CREATE INDEX IF NOT EXISTS "OperationalRecommendationHistory_workspaceId_recommendationId_idx" ON "OperationalRecommendationHistory"("workspaceId", "recommendationId");
CREATE INDEX IF NOT EXISTS "OperationalRecommendationHistory_workspaceId_status_generatedAt_idx" ON "OperationalRecommendationHistory"("workspaceId", "status", "generatedAt");
CREATE INDEX IF NOT EXISTS "OperationalRecommendationHistory_workspaceId_sourceDomain_generatedAt_idx" ON "OperationalRecommendationHistory"("workspaceId", "sourceDomain", "generatedAt");
CREATE INDEX IF NOT EXISTS "OperationalRecommendationOutcome_workspaceId_recommendationId_idx" ON "OperationalRecommendationOutcome"("workspaceId", "recommendationId");
CREATE INDEX IF NOT EXISTS "OperationalRecommendationOutcome_workspaceId_outcome_occurredAt_idx" ON "OperationalRecommendationOutcome"("workspaceId", "outcome", "occurredAt");
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalHealthSnapshot_workspaceId_snapshotKey_key" ON "OperationalHealthSnapshot"("workspaceId", "snapshotKey");
CREATE INDEX IF NOT EXISTS "OperationalHealthSnapshot_workspaceId_capturedAt_idx" ON "OperationalHealthSnapshot"("workspaceId", "capturedAt");
CREATE INDEX IF NOT EXISTS "OperationalHealthSnapshot_workspaceId_overallStatus_capturedAt_idx" ON "OperationalHealthSnapshot"("workspaceId", "overallStatus", "capturedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalSignal_workspaceId_signalKey_key" ON "OperationalSignal"("workspaceId", "signalKey");
CREATE INDEX IF NOT EXISTS "OperationalSignal_workspaceId_domain_lastSeenAt_idx" ON "OperationalSignal"("workspaceId", "domain", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "OperationalSignal_workspaceId_severity_lastSeenAt_idx" ON "OperationalSignal"("workspaceId", "severity", "lastSeenAt");
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalTrend_workspaceId_trendKey_key" ON "OperationalTrend"("workspaceId", "trendKey");
CREATE INDEX IF NOT EXISTS "OperationalTrend_workspaceId_domain_metric_idx" ON "OperationalTrend"("workspaceId", "domain", "metric");
CREATE INDEX IF NOT EXISTS "OperationalTrend_workspaceId_direction_detectedAt_idx" ON "OperationalTrend"("workspaceId", "direction", "detectedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalPattern_workspaceId_patternKey_key" ON "OperationalPattern"("workspaceId", "patternKey");
CREATE INDEX IF NOT EXISTS "OperationalPattern_workspaceId_domain_lastSeenAt_idx" ON "OperationalPattern"("workspaceId", "domain", "lastSeenAt");
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalRisk_workspaceId_riskKey_key" ON "OperationalRisk"("workspaceId", "riskKey");
CREATE INDEX IF NOT EXISTS "OperationalRisk_workspaceId_status_lastSeenAt_idx" ON "OperationalRisk"("workspaceId", "status", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "OperationalRisk_workspaceId_severity_lastSeenAt_idx" ON "OperationalRisk"("workspaceId", "severity", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "OperationalResolution_workspaceId_resolvedAt_idx" ON "OperationalResolution"("workspaceId", "resolvedAt");
CREATE INDEX IF NOT EXISTS "OperationalResolution_workspaceId_resolutionType_resolvedAt_idx" ON "OperationalResolution"("workspaceId", "resolutionType", "resolvedAt");
CREATE INDEX IF NOT EXISTS "OperationalMetricHistory_workspaceId_domain_metric_measuredAt_idx" ON "OperationalMetricHistory"("workspaceId", "domain", "metric", "measuredAt");
CREATE INDEX IF NOT EXISTS "OperationalMetricHistory_workspaceId_metricKey_measuredAt_idx" ON "OperationalMetricHistory"("workspaceId", "metricKey", "measuredAt");
CREATE INDEX IF NOT EXISTS "OperationalKnowledgeUsage_workspaceId_knowledgeItemId_usedAt_idx" ON "OperationalKnowledgeUsage"("workspaceId", "knowledgeItemId", "usedAt");
CREATE INDEX IF NOT EXISTS "OperationalKnowledgeUsage_workspaceId_outcome_usedAt_idx" ON "OperationalKnowledgeUsage"("workspaceId", "outcome", "usedAt");
CREATE INDEX IF NOT EXISTS "OperationalKnowledgeUsage_workspaceId_sourceResponseId_idx" ON "OperationalKnowledgeUsage"("workspaceId", "sourceResponseId");
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalKnowledgeEffectiveness_workspaceId_knowledgeKey_key" ON "OperationalKnowledgeEffectiveness"("workspaceId", "knowledgeKey");
CREATE INDEX IF NOT EXISTS "OperationalKnowledgeEffectiveness_workspaceId_lastUsedAt_idx" ON "OperationalKnowledgeEffectiveness"("workspaceId", "lastUsedAt");
CREATE INDEX IF NOT EXISTS "OperationalKnowledgeEffectiveness_workspaceId_confidence_idx" ON "OperationalKnowledgeEffectiveness"("workspaceId", "confidence");
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalDashboardSignal_workspaceId_signalKey_key" ON "OperationalDashboardSignal"("workspaceId", "signalKey");
CREATE INDEX IF NOT EXISTS "OperationalDashboardSignal_workspaceId_visible_generatedAt_idx" ON "OperationalDashboardSignal"("workspaceId", "visible", "generatedAt");
CREATE INDEX IF NOT EXISTS "OperationalDashboardSignal_workspaceId_severity_generatedAt_idx" ON "OperationalDashboardSignal"("workspaceId", "severity", "generatedAt");
CREATE INDEX IF NOT EXISTS "OperationalInsightRevision_workspaceId_insightId_version_idx" ON "OperationalInsightRevision"("workspaceId", "insightId", "version");
CREATE INDEX IF NOT EXISTS "OperationalInsightRevision_workspaceId_status_createdAt_idx" ON "OperationalInsightRevision"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OperationalInsightAudit_workspaceId_action_createdAt_idx" ON "OperationalInsightAudit"("workspaceId", "action", "createdAt");
CREATE INDEX IF NOT EXISTS "OperationalInsightAudit_workspaceId_insightId_createdAt_idx" ON "OperationalInsightAudit"("workspaceId", "insightId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAggregateSignal_signalKey_key" ON "PlatformAggregateSignal"("signalKey");
CREATE INDEX IF NOT EXISTS "PlatformAggregateSignal_category_generatedAt_idx" ON "PlatformAggregateSignal"("category", "generatedAt");
CREATE INDEX IF NOT EXISTS "PlatformAggregateSignal_severity_generatedAt_idx" ON "PlatformAggregateSignal"("severity", "generatedAt");

DO $$
BEGIN
  ALTER TABLE "OperationalInsight" ADD CONSTRAINT "OperationalInsight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalInsight" ADD CONSTRAINT "OperationalInsight_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "OperationalResolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalFinding" ADD CONSTRAINT "OperationalFinding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalEvidence" ADD CONSTRAINT "OperationalEvidence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalExplanation" ADD CONSTRAINT "OperationalExplanation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalDecision" ADD CONSTRAINT "OperationalDecision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalRecommendationHistory" ADD CONSTRAINT "OperationalRecommendationHistory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalRecommendationOutcome" ADD CONSTRAINT "OperationalRecommendationOutcome_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalHealthSnapshot" ADD CONSTRAINT "OperationalHealthSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalSignal" ADD CONSTRAINT "OperationalSignal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalTrend" ADD CONSTRAINT "OperationalTrend_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalPattern" ADD CONSTRAINT "OperationalPattern_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalRisk" ADD CONSTRAINT "OperationalRisk_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalResolution" ADD CONSTRAINT "OperationalResolution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalMetricHistory" ADD CONSTRAINT "OperationalMetricHistory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalKnowledgeUsage" ADD CONSTRAINT "OperationalKnowledgeUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalKnowledgeEffectiveness" ADD CONSTRAINT "OperationalKnowledgeEffectiveness_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalDashboardSignal" ADD CONSTRAINT "OperationalDashboardSignal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalInsightRevision" ADD CONSTRAINT "OperationalInsightRevision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalInsightRevision" ADD CONSTRAINT "OperationalInsightRevision_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "OperationalInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalInsightAudit" ADD CONSTRAINT "OperationalInsightAudit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OperationalInsightAudit" ADD CONSTRAINT "OperationalInsightAudit_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "OperationalInsight"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
