CREATE TYPE "RevenueTransactionSourceType" AS ENUM (
  'MANUAL',
  'JOB',
  'ORDER',
  'INVOICE',
  'PAYMENT',
  'REFUND',
  'ADJUSTMENT'
);

CREATE TYPE "RevenueTransactionStatus" AS ENUM (
  'ACTIVE',
  'VOIDED'
);

CREATE TABLE "RevenueTransaction" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT,
  "customerId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "sourceType" "RevenueTransactionSourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceId" TEXT,
  "status" "RevenueTransactionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT,
  "createdByWorkspaceMemberId" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RevenueTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RevenueTransaction_workspaceId_occurredAt_idx"
  ON "RevenueTransaction"("workspaceId", "occurredAt");

CREATE INDEX "RevenueTransaction_workspaceId_clientId_idx"
  ON "RevenueTransaction"("workspaceId", "clientId");

CREATE INDEX "RevenueTransaction_workspaceId_customerId_idx"
  ON "RevenueTransaction"("workspaceId", "customerId");

CREATE INDEX "RevenueTransaction_workspaceId_sourceType_sourceId_idx"
  ON "RevenueTransaction"("workspaceId", "sourceType", "sourceId");

CREATE INDEX "RevenueTransaction_workspaceId_status_idx"
  ON "RevenueTransaction"("workspaceId", "status");

ALTER TABLE "RevenueTransaction"
  ADD CONSTRAINT "RevenueTransaction_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
