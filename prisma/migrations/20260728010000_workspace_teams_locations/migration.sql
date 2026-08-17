-- Authoritative workspace teams and operational locations.
-- Scheduling availability records keep their existing snapshot fields so
-- legacy Team/Location Working Hours remain readable without forced backfills.

CREATE TYPE "WorkspaceTeamType" AS ENUM (
  'GENERAL',
  'OFFICE',
  'FIELD_CREW',
  'SALES',
  'SERVICE',
  'INSTALLATION',
  'WAREHOUSE',
  'MANAGEMENT',
  'OTHER'
);

CREATE TYPE "WorkspaceLocationType" AS ENUM (
  'OFFICE',
  'STORE',
  'WAREHOUSE',
  'SHOP',
  'SERVICE_BASE',
  'BRANCH',
  'REMOTE',
  'OTHER'
);

CREATE TABLE "WorkspaceTeam" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "teamType" "WorkspaceTeamType",
  "leadMemberId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "WorkspaceTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceTeamMember" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "workspaceMemberId" TEXT NOT NULL,
  "roleLabel" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceLocation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "locationType" "WorkspaceLocationType" NOT NULL,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "region" TEXT,
  "postalCode" TEXT,
  "countryCode" TEXT,
  "timezone" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "WorkspaceLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceTeam_workspaceId_isActive_idx" ON "WorkspaceTeam"("workspaceId", "isActive");
CREATE INDEX "WorkspaceTeam_workspaceId_name_idx" ON "WorkspaceTeam"("workspaceId", "name");
CREATE INDEX "WorkspaceTeam_workspaceId_archivedAt_idx" ON "WorkspaceTeam"("workspaceId", "archivedAt");

CREATE UNIQUE INDEX "WorkspaceTeamMember_teamId_workspaceMemberId_key" ON "WorkspaceTeamMember"("teamId", "workspaceMemberId");
CREATE INDEX "WorkspaceTeamMember_workspaceId_workspaceMemberId_idx" ON "WorkspaceTeamMember"("workspaceId", "workspaceMemberId");
CREATE INDEX "WorkspaceTeamMember_workspaceId_teamId_idx" ON "WorkspaceTeamMember"("workspaceId", "teamId");

CREATE INDEX "WorkspaceLocation_workspaceId_isActive_idx" ON "WorkspaceLocation"("workspaceId", "isActive");
CREATE INDEX "WorkspaceLocation_workspaceId_name_idx" ON "WorkspaceLocation"("workspaceId", "name");
CREATE INDEX "WorkspaceLocation_workspaceId_archivedAt_idx" ON "WorkspaceLocation"("workspaceId", "archivedAt");
CREATE INDEX "WorkspaceLocation_workspaceId_isPrimary_idx" ON "WorkspaceLocation"("workspaceId", "isPrimary");

ALTER TABLE "WorkspaceTeam"
  ADD CONSTRAINT "WorkspaceTeam_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkspaceTeamMember"
  ADD CONSTRAINT "WorkspaceTeamMember_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "WorkspaceTeam"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceTeamMember"
  ADD CONSTRAINT "WorkspaceTeamMember_workspaceMemberId_fkey"
  FOREIGN KEY ("workspaceMemberId") REFERENCES "WorkspaceMember"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceLocation"
  ADD CONSTRAINT "WorkspaceLocation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
