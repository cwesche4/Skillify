-- Add workspace-member-aware ownership and privacy state for external calendar
-- provider connections without disconnecting or rewriting existing credentials.

CREATE TYPE "CalendarConnectionOwnershipType" AS ENUM ('MEMBER', 'WORKSPACE');
CREATE TYPE "ExternalCalendarVisibilityMode" AS ENUM ('BUSY_ONLY', 'TITLE_ONLY', 'FULL_DETAILS');
CREATE TYPE "CalendarConnectionApprovalStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'NEEDS_REVIEW');

ALTER TABLE "CalendarConnection"
  ADD COLUMN "workspaceMemberId" TEXT,
  ADD COLUMN "connectedByWorkspaceMemberId" TEXT,
  ADD COLUMN "ownershipType" "CalendarConnectionOwnershipType" NOT NULL DEFAULT 'MEMBER',
  ADD COLUMN "visibilityMode" "ExternalCalendarVisibilityMode" NOT NULL DEFAULT 'BUSY_ONLY',
  ADD COLUMN "approvalStatus" "CalendarConnectionApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "disabledReason" TEXT,
  ADD COLUMN "ownerInactiveAt" TIMESTAMP(3);

UPDATE "CalendarConnection" AS connection
SET
  "workspaceMemberId" = member.id,
  "connectedByWorkspaceMemberId" = member.id,
  "ownershipType" = 'MEMBER'
FROM "WorkspaceMember" AS member
WHERE
  member."workspaceId" = connection."workspaceId"
  AND member."userId" = connection."connectedByUserId";

UPDATE "CalendarConnection"
SET
  "ownershipType" = 'WORKSPACE',
  "approvalStatus" = 'NEEDS_REVIEW',
  "visibilityMode" = 'TITLE_ONLY',
  "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object(
    'ownershipBackfill',
    jsonb_build_object(
      'status', 'needsReview',
      'reason', 'No deterministic WorkspaceMember matched connectedByUserId during migration.'
    )
  )
WHERE "workspaceMemberId" IS NULL;

CREATE INDEX "CalendarConnection_workspaceId_workspaceMemberId_idx"
  ON "CalendarConnection"("workspaceId", "workspaceMemberId");

CREATE INDEX "CalendarConnection_workspaceId_ownershipType_idx"
  ON "CalendarConnection"("workspaceId", "ownershipType");

CREATE INDEX "CalendarConnection_connectedByWorkspaceMemberId_idx"
  ON "CalendarConnection"("connectedByWorkspaceMemberId");

ALTER TABLE "CalendarConnection"
  ADD CONSTRAINT "CalendarConnection_workspaceMemberId_fkey"
  FOREIGN KEY ("workspaceMemberId")
  REFERENCES "WorkspaceMember"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "CalendarConnection"
  ADD CONSTRAINT "CalendarConnection_connectedByWorkspaceMemberId_fkey"
  FOREIGN KEY ("connectedByWorkspaceMemberId")
  REFERENCES "WorkspaceMember"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
