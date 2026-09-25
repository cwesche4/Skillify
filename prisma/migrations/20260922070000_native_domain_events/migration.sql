-- Extend the existing shared transactional outbox with durable processing
-- trace fields. Existing Scheduling events remain unchanged.
ALTER TABLE "DomainOutboxEvent"
ADD COLUMN "processingOutcome" TEXT,
ADD COLUMN "dispatchId" TEXT,
ADD COLUMN "automationRunId" TEXT,
ADD COLUMN "deduplicationKey" TEXT;

CREATE INDEX "DomainOutboxEvent_workspaceId_topic_createdAt_idx"
ON "DomainOutboxEvent"("workspaceId", "topic", "createdAt");

-- Existing Scheduling rows keep NULL and remain unconstrained. Native event
-- producers provide a stable key, giving each Lead one lead.created record.
CREATE UNIQUE INDEX "DomainOutboxEvent_deduplicationKey_key"
ON "DomainOutboxEvent"("deduplicationKey");
