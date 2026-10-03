-- Phase 11C customer Estimate sharing, delivery, and decision evidence.
-- Customer decisions remain commercial-only; operational work is still created
-- exclusively through the Phase 11B management-confirmed handoff.

CREATE TYPE "EstimateDeliveryChannel" AS ENUM ('EMAIL');

CREATE TYPE "EstimateDeliveryStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'PERMANENTLY_FAILED',
  'CANCELED'
);

CREATE TYPE "EstimateDecisionKind" AS ENUM ('ACCEPTED', 'DECLINED');
CREATE TYPE "EstimateDecisionSource" AS ENUM ('MANAGEMENT', 'CUSTOMER_LINK');

CREATE TABLE "EstimateShare" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "estimateId" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "businessIdentitySnapshot" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EstimateShare_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EstimateShare_public_id_check"
    CHECK (length("publicId") BETWEEN 32 AND 200),
  CONSTRAINT "EstimateShare_expiry_check"
    CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "EstimateShare_revocation_check"
    CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
);

CREATE TABLE "EstimateDelivery" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "estimateId" TEXT NOT NULL,
  "estimateShareId" TEXT NOT NULL,
  "channel" "EstimateDeliveryChannel" NOT NULL DEFAULT 'EMAIL',
  "recipientEmail" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "status" "EstimateDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "claimedBy" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "provider" TEXT,
  "providerMessageId" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL DEFAULT 1,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EstimateDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EstimateDelivery_email_check"
    CHECK (length(btrim("recipientEmail")) BETWEEN 3 AND 320),
  CONSTRAINT "EstimateDelivery_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "EstimateDelivery_idempotency_check"
    CHECK (length(btrim("idempotencyKey")) BETWEEN 1 AND 200),
  CONSTRAINT "EstimateDelivery_template_check" CHECK ("templateVersion" >= 1),
  CONSTRAINT "EstimateDelivery_claim_check" CHECK (
    ("status" = 'PROCESSING' AND "claimedAt" IS NOT NULL AND length(btrim("claimedBy")) > 0 AND "leaseExpiresAt" > "claimedAt")
    OR
    ("status" <> 'PROCESSING' AND "claimedAt" IS NULL AND "claimedBy" IS NULL AND "leaseExpiresAt" IS NULL)
  ),
  CONSTRAINT "EstimateDelivery_sent_check" CHECK (
    ("status" = 'SENT') = ("sentAt" IS NOT NULL)
  ),
  CONSTRAINT "EstimateDelivery_failure_check" CHECK (
    (
      "status" IN ('FAILED', 'PERMANENTLY_FAILED')
      AND "failedAt" IS NOT NULL
      AND length(btrim("lastErrorCode")) > 0
      AND length(btrim("lastErrorMessage")) > 0
    )
    OR "status" NOT IN ('FAILED', 'PERMANENTLY_FAILED')
  ),
  CONSTRAINT "EstimateDelivery_failure_evidence_check" CHECK (
    "failedAt" IS NULL
    OR (
      length(btrim("lastErrorCode")) > 0
      AND length(btrim("lastErrorMessage")) > 0
    )
  ),
  CONSTRAINT "EstimateDelivery_terminal_failure_time_check" CHECK (
    "status" NOT IN ('PENDING', 'SENT', 'CANCELED')
    OR "failedAt" IS NULL
  )
);

CREATE TABLE "EstimateDecision" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "estimateId" TEXT NOT NULL,
  "estimateShareId" TEXT,
  "decision" "EstimateDecisionKind" NOT NULL,
  "source" "EstimateDecisionSource" NOT NULL,
  "managementActorUserId" TEXT,
  "acknowledgmentNameSnapshot" TEXT,
  "declineReason" TEXT,
  "declineNote" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EstimateDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EstimateDecision_source_shape_check" CHECK (
    (
      "source" = 'MANAGEMENT'
      AND "managementActorUserId" IS NOT NULL
      AND "estimateShareId" IS NULL
      AND "acknowledgmentNameSnapshot" IS NULL
    )
    OR
    (
      "source" = 'CUSTOMER_LINK'
      AND "managementActorUserId" IS NULL
      AND "estimateShareId" IS NOT NULL
      AND "acknowledgmentNameSnapshot" IS NOT NULL
      AND length(btrim("acknowledgmentNameSnapshot")) BETWEEN 1 AND 200
    )
  ),
  CONSTRAINT "EstimateDecision_decline_fields_check" CHECK (
    "decision" = 'DECLINED'
    OR ("declineReason" IS NULL AND "declineNote" IS NULL)
  ),
  CONSTRAINT "EstimateDecision_decline_reason_check"
    CHECK ("declineReason" IS NULL OR length("declineReason") <= 100),
  CONSTRAINT "EstimateDecision_decline_note_check"
    CHECK ("declineNote" IS NULL OR length("declineNote") <= 1000)
);

CREATE UNIQUE INDEX "EstimateShare_publicId_key"
ON "EstimateShare"("publicId");

CREATE UNIQUE INDEX "EstimateShare_id_workspace_estimate_key"
ON "EstimateShare"("id", "workspaceId", "estimateId");

CREATE UNIQUE INDEX "EstimateShare_one_active_per_revision_key"
ON "EstimateShare"("workspaceId", "estimateId")
WHERE "revokedAt" IS NULL;

CREATE INDEX "EstimateShare_workspace_estimate_time_idx"
ON "EstimateShare"("workspaceId", "estimateId", "createdAt");

CREATE INDEX "EstimateShare_workspace_active_idx"
ON "EstimateShare"("workspaceId", "revokedAt", "expiresAt");

CREATE INDEX "EstimateShare_creator_idx"
ON "EstimateShare"("createdByUserId");

CREATE UNIQUE INDEX "EstimateDelivery_workspace_idempotency_key"
ON "EstimateDelivery"("workspaceId", "idempotencyKey");

CREATE INDEX "EstimateDelivery_status_next_attempt_idx"
ON "EstimateDelivery"("status", "nextAttemptAt");

CREATE INDEX "EstimateDelivery_status_lease_idx"
ON "EstimateDelivery"("status", "leaseExpiresAt");

CREATE INDEX "EstimateDelivery_workspace_estimate_time_idx"
ON "EstimateDelivery"("workspaceId", "estimateId", "requestedAt");

CREATE INDEX "EstimateDelivery_share_idx"
ON "EstimateDelivery"("estimateShareId");

CREATE INDEX "EstimateDelivery_requester_idx"
ON "EstimateDelivery"("requestedByUserId");

CREATE UNIQUE INDEX "EstimateDecision_workspace_estimate_key"
ON "EstimateDecision"("workspaceId", "estimateId");

CREATE UNIQUE INDEX "EstimateDecision_estimate_workspace_key"
ON "EstimateDecision"("estimateId", "workspaceId");

CREATE INDEX "EstimateDecision_workspace_time_idx"
ON "EstimateDecision"("workspaceId", "occurredAt");

CREATE INDEX "EstimateDecision_share_idx"
ON "EstimateDecision"("estimateShareId");

CREATE INDEX "EstimateDecision_actor_idx"
ON "EstimateDecision"("managementActorUserId");

ALTER TABLE "EstimateShare" ADD CONSTRAINT "EstimateShare_workspace_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateShare" ADD CONSTRAINT "EstimateShare_estimate_fkey"
FOREIGN KEY ("estimateId", "workspaceId") REFERENCES "Estimate"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateShare" ADD CONSTRAINT "EstimateShare_creator_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateDelivery" ADD CONSTRAINT "EstimateDelivery_workspace_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateDelivery" ADD CONSTRAINT "EstimateDelivery_estimate_fkey"
FOREIGN KEY ("estimateId", "workspaceId") REFERENCES "Estimate"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateDelivery" ADD CONSTRAINT "EstimateDelivery_share_fkey"
FOREIGN KEY ("estimateShareId", "workspaceId", "estimateId")
REFERENCES "EstimateShare"("id", "workspaceId", "estimateId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateDelivery" ADD CONSTRAINT "EstimateDelivery_requester_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateDecision" ADD CONSTRAINT "EstimateDecision_workspace_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateDecision" ADD CONSTRAINT "EstimateDecision_estimate_fkey"
FOREIGN KEY ("estimateId", "workspaceId") REFERENCES "Estimate"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateDecision" ADD CONSTRAINT "EstimateDecision_share_fkey"
FOREIGN KEY ("estimateShareId", "workspaceId", "estimateId")
REFERENCES "EstimateShare"("id", "workspaceId", "estimateId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateDecision" ADD CONSTRAINT "EstimateDecision_actor_fkey"
FOREIGN KEY ("managementActorUserId") REFERENCES "UserProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing accepted/declined rows are management decisions by construction.
INSERT INTO "EstimateDecision" (
  "id",
  "workspaceId",
  "estimateId",
  "decision",
  "source",
  "managementActorUserId",
  "occurredAt"
)
SELECT
  'phase11c-management-' || "id",
  "workspaceId",
  "id",
  CASE WHEN "status" = 'ACCEPTED'
    THEN 'ACCEPTED'::"EstimateDecisionKind"
    ELSE 'DECLINED'::"EstimateDecisionKind"
  END,
  'MANAGEMENT'::"EstimateDecisionSource",
  CASE WHEN "status" = 'ACCEPTED' THEN "acceptedByUserId" ELSE "declinedByUserId" END,
  CASE WHEN "status" = 'ACCEPTED' THEN "acceptedAt" ELSE "declinedAt" END
FROM "Estimate"
WHERE "status" IN ('ACCEPTED', 'DECLINED');

ALTER TABLE "Estimate" DROP CONSTRAINT "Estimate_acceptance_fields_check";
ALTER TABLE "Estimate" DROP CONSTRAINT "Estimate_decline_fields_check";

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_acceptance_fields_check" CHECK (
  (
    "status" = 'ACCEPTED'
    AND "acceptedAt" IS NOT NULL
  )
  OR
  (
    "status" <> 'ACCEPTED'
    AND "acceptedAt" IS NULL
    AND "acceptedByUserId" IS NULL
  )
);

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_decline_fields_check" CHECK (
  (
    "status" = 'DECLINED'
    AND "declinedAt" IS NOT NULL
  )
  OR
  (
    "status" <> 'DECLINED'
    AND "declinedAt" IS NULL
    AND "declinedByUserId" IS NULL
  )
);

-- Estimate.status is a projection of immutable decision evidence. Both
-- management and customer flows write the two records inside one transaction,
-- so a deferred constraint trigger can reject split-brain terminal state while
-- allowing either write order within that transaction.
CREATE FUNCTION "enforce_estimate_decision_projection"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_workspace_id TEXT;
  target_estimate_id TEXT;
  estimate_status "EstimateStatus";
  accepted_actor_id TEXT;
  declined_actor_id TEXT;
  evidence_decision "EstimateDecisionKind";
  evidence_source "EstimateDecisionSource";
  evidence_actor_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Estimate' THEN
    target_workspace_id := NEW."workspaceId";
    target_estimate_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    target_workspace_id := OLD."workspaceId";
    target_estimate_id := OLD."estimateId";
  ELSE
    target_workspace_id := NEW."workspaceId";
    target_estimate_id := NEW."estimateId";
  END IF;

  SELECT "status", "acceptedByUserId", "declinedByUserId"
  INTO estimate_status, accepted_actor_id, declined_actor_id
  FROM "Estimate"
  WHERE "workspaceId" = target_workspace_id AND "id" = target_estimate_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT "decision", "source", "managementActorUserId"
  INTO evidence_decision, evidence_source, evidence_actor_id
  FROM "EstimateDecision"
  WHERE "workspaceId" = target_workspace_id
    AND "estimateId" = target_estimate_id;

  IF estimate_status IN ('ACCEPTED', 'DECLINED') THEN
    IF evidence_decision IS NULL
      OR evidence_decision::TEXT <> estimate_status::TEXT
      OR (
        evidence_source = 'MANAGEMENT'
        AND (
          (estimate_status = 'ACCEPTED' AND accepted_actor_id IS DISTINCT FROM evidence_actor_id)
          OR
          (estimate_status = 'DECLINED' AND declined_actor_id IS DISTINCT FROM evidence_actor_id)
        )
      )
      OR (
        evidence_source = 'CUSTOMER_LINK'
        AND (
          (estimate_status = 'ACCEPTED' AND accepted_actor_id IS NOT NULL)
          OR
          (estimate_status = 'DECLINED' AND declined_actor_id IS NOT NULL)
        )
      )
    THEN
      RAISE EXCEPTION 'Estimate terminal state must match its decision evidence.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF evidence_decision IS NOT NULL THEN
    RAISE EXCEPTION 'Estimate decision evidence requires matching terminal state.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Estimate_decision_projection_check"
AFTER INSERT OR UPDATE ON "Estimate"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_estimate_decision_projection"();

CREATE CONSTRAINT TRIGGER "EstimateDecision_projection_check"
AFTER INSERT OR UPDATE OR DELETE ON "EstimateDecision"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_estimate_decision_projection"();

CREATE FUNCTION "prevent_estimate_decision_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Estimate decision evidence is immutable.'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "EstimateDecision_immutable_check"
BEFORE UPDATE OR DELETE ON "EstimateDecision"
FOR EACH ROW
EXECUTE FUNCTION "prevent_estimate_decision_mutation"();
