/*
  Warnings:

  - Added the required column `integrityHash` to the `AiActionAudit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SecurityPackIndustry" AS ENUM ('FINTECH', 'HEALTHCARE', 'SAAS', 'ENTERPRISE', 'PUBLIC_SECTOR', 'BANK_PAYMENTS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SecurityPackReviewType" AS ENUM ('SECURITY_REVIEW', 'SOC2_ESCALATION', 'AUDIT_REQUEST');

-- CreateEnum
CREATE TYPE "SecurityPackArtifactType" AS ENUM ('TRUST_CENTER_ONLY', 'SOC2_PACKET', 'AUDIT_CSV', 'EVIDENCE_BUNDLE');

-- CreateEnum
CREATE TYPE "SecurityPackEventType" AS ENUM ('REQUEST_SUBMITTED', 'VALIDATION_FAILED', 'APPROVAL_REQUESTED', 'APPROVED', 'REJECTED', 'DELIVERY_MARKED', 'DELIVERY_FAILED');

-- CreateEnum
CREATE TYPE "SecurityPackApproverRole" AS ENUM ('SECURITY', 'LEGAL', 'GRC', 'OTHER');

-- CreateEnum
CREATE TYPE "SecurityPackDeliveryMethod" AS ENUM ('MANUAL', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "SecurityPackAutomationSystem" AS ENUM ('N8N', 'SKILLIFY', 'OTHER');

-- AlterTable
ALTER TABLE "AiActionAudit" ADD COLUMN     "integrityHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "SecurityPackRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "industry" "SecurityPackIndustry" NOT NULL DEFAULT 'UNKNOWN',
    "reviewType" "SecurityPackReviewType" NOT NULL,
    "requestedArtifacts" "SecurityPackArtifactType"[],
    "templateFile" TEXT,
    "bundles" JSONB,
    "links" JSONB,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityPackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityPackAuditEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventType" "SecurityPackEventType" NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "SecurityPackApproverRole",
    "templateFile" TEXT,
    "bundles" JSONB,
    "links" JSONB,
    "decisionNotes" TEXT,
    "deliveryMethod" "SecurityPackDeliveryMethod",
    "automationSystem" "SecurityPackAutomationSystem",
    "sent" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityPackAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityPackRequest_workspaceId_createdAt_idx" ON "SecurityPackRequest"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityPackAuditEvent_workspaceId_createdAt_idx" ON "SecurityPackAuditEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityPackAuditEvent_requestId_createdAt_idx" ON "SecurityPackAuditEvent"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityPackAuditEvent_workspaceId_eventType_createdAt_idx" ON "SecurityPackAuditEvent"("workspaceId", "eventType", "createdAt");
