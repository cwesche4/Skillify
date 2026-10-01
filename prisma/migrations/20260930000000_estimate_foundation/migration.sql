-- Phase 11A durable Estimate and acceptance foundation. Estimate lifecycle
-- records commercial history only; it creates no Jobs, Scheduling events,
-- RevenueTransactions, or customer-delivery work.

CREATE TYPE "EstimateStatus" AS ENUM (
  'DRAFT',
  'PRESENTED',
  'ACCEPTED',
  'DECLINED',
  'SUPERSEDED',
  'VOIDED'
);

CREATE TYPE "EstimateBillingBasis" AS ENUM ('ONE_TIME', 'PER_VISIT');

CREATE TABLE "Estimate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL DEFAULT 1,
  "previousRevisionId" TEXT,
  "leadId" TEXT,
  "customerId" TEXT,
  "title" TEXT NOT NULL,
  "scopeDescription" TEXT,
  "contactNameSnapshot" TEXT,
  "contactEmailSnapshot" TEXT,
  "contactPhoneSnapshot" TEXT,
  "serviceAddressLine1Snapshot" TEXT,
  "serviceAddressLine2Snapshot" TEXT,
  "serviceAddressCitySnapshot" TEXT,
  "serviceAddressRegionSnapshot" TEXT,
  "serviceAddressPostalCodeSnapshot" TEXT,
  "serviceAddressCountrySnapshot" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "oneTimeSubtotalCents" INTEGER NOT NULL DEFAULT 0,
  "recurringPerVisitSubtotalCents" INTEGER NOT NULL DEFAULT 0,
  "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
  "expiresOn" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT NOT NULL,
  "presentedByUserId" TEXT,
  "acceptedByUserId" TEXT,
  "declinedByUserId" TEXT,
  "voidedByUserId" TEXT,
  "presentedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Estimate_parent_check" CHECK ("leadId" IS NOT NULL OR "customerId" IS NOT NULL),
  CONSTRAINT "Estimate_title_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "Estimate_reference_check" CHECK ("referenceNumber" ~ '^EST-[A-F0-9]{10}$'),
  CONSTRAINT "Estimate_revision_check" CHECK ("revisionNumber" >= 1),
  CONSTRAINT "Estimate_version_check" CHECK ("version" >= 1),
  CONSTRAINT "Estimate_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Estimate_one_time_total_check" CHECK ("oneTimeSubtotalCents" BETWEEN 0 AND 100000000),
  CONSTRAINT "Estimate_per_visit_total_check" CHECK ("recurringPerVisitSubtotalCents" BETWEEN 0 AND 100000000),
  CONSTRAINT "Estimate_expiry_key_check" CHECK ("expiresOn" IS NULL OR "expiresOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  CONSTRAINT "Estimate_acceptance_fields_check" CHECK (
    ("status" = 'ACCEPTED') = ("acceptedAt" IS NOT NULL AND "acceptedByUserId" IS NOT NULL)
  ),
  CONSTRAINT "Estimate_decline_fields_check" CHECK (
    ("status" = 'DECLINED') = ("declinedAt" IS NOT NULL AND "declinedByUserId" IS NOT NULL)
  ),
  CONSTRAINT "Estimate_void_fields_check" CHECK (
    ("status" = 'VOIDED') = ("voidedAt" IS NOT NULL AND "voidedByUserId" IS NOT NULL)
  ),
  CONSTRAINT "Estimate_presented_fields_check" CHECK (
    ("status" IN ('PRESENTED', 'ACCEPTED', 'DECLINED', 'SUPERSEDED')) =
    ("presentedAt" IS NOT NULL AND "presentedByUserId" IS NOT NULL)
    OR "status" = 'VOIDED'
  )
);

CREATE TABLE "EstimateLineItem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "estimateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "billingBasis" "EstimateBillingBasis" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EstimateLineItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EstimateLineItem_title_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "EstimateLineItem_amount_check" CHECK ("amountCents" BETWEEN 0 AND 100000000),
  CONSTRAINT "EstimateLineItem_sort_check" CHECK ("sortOrder" >= 0)
);

CREATE UNIQUE INDEX "Estimate_id_workspaceId_key"
ON "Estimate"("id", "workspaceId");

CREATE UNIQUE INDEX "Estimate_id_workspaceId_referenceNumber_key"
ON "Estimate"("id", "workspaceId", "referenceNumber");

CREATE UNIQUE INDEX "Estimate_workspaceId_referenceNumber_revisionNumber_key"
ON "Estimate"("workspaceId", "referenceNumber", "revisionNumber");

CREATE UNIQUE INDEX "Estimate_previousRevisionId_workspaceId_referenceNumber_key"
ON "Estimate"("previousRevisionId", "workspaceId", "referenceNumber");

CREATE INDEX "Estimate_workspaceId_status_updatedAt_idx"
ON "Estimate"("workspaceId", "status", "updatedAt");

CREATE INDEX "Estimate_workspaceId_status_expiresOn_idx"
ON "Estimate"("workspaceId", "status", "expiresOn");

CREATE INDEX "Estimate_workspaceId_leadId_archivedAt_idx"
ON "Estimate"("workspaceId", "leadId", "archivedAt");

CREATE INDEX "Estimate_workspaceId_customerId_archivedAt_idx"
ON "Estimate"("workspaceId", "customerId", "archivedAt");

CREATE INDEX "Estimate_createdByUserId_idx" ON "Estimate"("createdByUserId");
CREATE INDEX "Estimate_presentedByUserId_idx" ON "Estimate"("presentedByUserId");
CREATE INDEX "Estimate_acceptedByUserId_idx" ON "Estimate"("acceptedByUserId");
CREATE INDEX "Estimate_declinedByUserId_idx" ON "Estimate"("declinedByUserId");
CREATE INDEX "Estimate_voidedByUserId_idx" ON "Estimate"("voidedByUserId");

CREATE UNIQUE INDEX "EstimateLineItem_id_workspaceId_key"
ON "EstimateLineItem"("id", "workspaceId");

CREATE UNIQUE INDEX "EstimateLineItem_estimateId_sortOrder_key"
ON "EstimateLineItem"("estimateId", "sortOrder");

CREATE INDEX "EstimateLineItem_workspaceId_estimateId_sortOrder_idx"
ON "EstimateLineItem"("workspaceId", "estimateId", "sortOrder");

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_leadId_workspaceId_fkey"
FOREIGN KEY ("leadId", "workspaceId") REFERENCES "Lead"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_customerId_workspaceId_fkey"
FOREIGN KEY ("customerId", "workspaceId") REFERENCES "Customer"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_previousRevisionId_workspaceId_referenceNumber_fkey"
FOREIGN KEY ("previousRevisionId", "workspaceId", "referenceNumber") REFERENCES "Estimate"("id", "workspaceId", "referenceNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_presentedByUserId_fkey"
FOREIGN KEY ("presentedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_acceptedByUserId_fkey"
FOREIGN KEY ("acceptedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_declinedByUserId_fkey"
FOREIGN KEY ("declinedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_voidedByUserId_fkey"
FOREIGN KEY ("voidedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_estimateId_workspaceId_fkey"
FOREIGN KEY ("estimateId", "workspaceId") REFERENCES "Estimate"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
