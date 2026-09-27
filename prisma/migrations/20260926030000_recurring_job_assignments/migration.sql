-- Phase 8D snapshots Scheduling's member/team principals on Jobs while
-- preserving legacy Job.assigneeMemberId for compatible manual Jobs.

CREATE UNIQUE INDEX "WorkspaceTeam_id_workspaceId_key"
ON "WorkspaceTeam"("id", "workspaceId");

CREATE TABLE "JobAssignment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "assignmentType" "SchedulingAssignmentType" NOT NULL,
  "workspaceMemberId" TEXT,
  "teamId" TEXT,
  "roleLabel" TEXT,
  "displaySnapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobAssignment_target_check" CHECK (
    ("assignmentType" = 'MEMBER' AND "workspaceMemberId" IS NOT NULL AND "teamId" IS NULL)
    OR
    ("assignmentType" = 'TEAM' AND "teamId" IS NOT NULL AND "workspaceMemberId" IS NULL)
  )
);

CREATE UNIQUE INDEX "JobAssignment_jobId_workspaceMemberId_key"
ON "JobAssignment"("jobId", "workspaceMemberId");

CREATE UNIQUE INDEX "JobAssignment_jobId_teamId_key"
ON "JobAssignment"("jobId", "teamId");

CREATE INDEX "JobAssignment_workspaceId_jobId_idx"
ON "JobAssignment"("workspaceId", "jobId");

CREATE INDEX "JobAssignment_workspaceId_workspaceMemberId_jobId_idx"
ON "JobAssignment"("workspaceId", "workspaceMemberId", "jobId");

CREATE INDEX "JobAssignment_workspaceId_teamId_jobId_idx"
ON "JobAssignment"("workspaceId", "teamId", "jobId");

ALTER TABLE "JobAssignment"
ADD CONSTRAINT "JobAssignment_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobAssignment"
ADD CONSTRAINT "JobAssignment_jobId_workspaceId_fkey"
FOREIGN KEY ("jobId", "workspaceId") REFERENCES "Job"("id", "workspaceId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobAssignment"
ADD CONSTRAINT "JobAssignment_workspaceMemberId_workspaceId_fkey"
FOREIGN KEY ("workspaceMemberId", "workspaceId") REFERENCES "WorkspaceMember"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobAssignment"
ADD CONSTRAINT "JobAssignment_teamId_workspaceId_fkey"
FOREIGN KEY ("teamId", "workspaceId") REFERENCES "WorkspaceTeam"("id", "workspaceId")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill already-materialized 8B Jobs from their authoritative occurrence.
-- Structurally invalid legacy Scheduling rows are intentionally ignored so
-- they cannot grant execution authorization through the new model.
INSERT INTO "JobAssignment" (
  "id", "workspaceId", "jobId", "assignmentType",
  "workspaceMemberId", "teamId", "roleLabel", "displaySnapshot",
  "createdAt", "updatedAt"
)
SELECT
  'ja_' || md5(job."id" || ':' || assignment."id"),
  job."workspaceId",
  job."id",
  'MEMBER'::"SchedulingAssignmentType",
  assignment."workspaceMemberId",
  NULL,
  assignment."roleLabel",
  assignment."displaySnapshot",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Job" AS job
INNER JOIN "SchedulingAssignment" AS assignment
  ON assignment."eventId" = job."schedulingEventId"
  AND assignment."workspaceId" = job."workspaceId"
INNER JOIN "WorkspaceMember" AS member
  ON member."id" = assignment."workspaceMemberId"
  AND member."workspaceId" = assignment."workspaceId"
WHERE job."schedulingEventId" IS NOT NULL
  AND assignment."assignmentType" = 'MEMBER'
  AND assignment."workspaceMemberId" IS NOT NULL
  AND assignment."teamId" IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "JobAssignment" (
  "id", "workspaceId", "jobId", "assignmentType",
  "workspaceMemberId", "teamId", "roleLabel", "displaySnapshot",
  "createdAt", "updatedAt"
)
SELECT
  'ja_' || md5(job."id" || ':' || assignment."id"),
  job."workspaceId",
  job."id",
  'TEAM'::"SchedulingAssignmentType",
  NULL,
  assignment."teamId",
  assignment."roleLabel",
  COALESCE(assignment."displaySnapshot", team."name"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Job" AS job
INNER JOIN "SchedulingAssignment" AS assignment
  ON assignment."eventId" = job."schedulingEventId"
  AND assignment."workspaceId" = job."workspaceId"
INNER JOIN "WorkspaceTeam" AS team
  ON team."id" = assignment."teamId"
  AND team."workspaceId" = assignment."workspaceId"
WHERE job."schedulingEventId" IS NOT NULL
  AND assignment."assignmentType" = 'TEAM'
  AND assignment."workspaceMemberId" IS NULL
  AND assignment."teamId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Compatibility mirror: only one direct member and no richer assignment may
-- populate assigneeMemberId for a Scheduling-backed Job.
UPDATE "Job" AS job
SET "assigneeMemberId" = snapshot."workspaceMemberId"
FROM (
  SELECT
    assignment."jobId",
    MIN(assignment."workspaceMemberId") AS "workspaceMemberId"
  FROM "JobAssignment" AS assignment
  GROUP BY assignment."jobId"
  HAVING COUNT(*) = 1
    AND COUNT(*) FILTER (
      WHERE assignment."assignmentType" = 'MEMBER'
        AND assignment."workspaceMemberId" IS NOT NULL
    ) = 1
) AS snapshot
WHERE job."id" = snapshot."jobId"
  AND job."schedulingEventId" IS NOT NULL;

UPDATE "Job" AS job
SET "assigneeMemberId" = NULL
WHERE job."schedulingEventId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "JobAssignment" AS assignment
    WHERE assignment."jobId" = job."id"
    GROUP BY assignment."jobId"
    HAVING COUNT(*) = 1
      AND COUNT(*) FILTER (
        WHERE assignment."assignmentType" = 'MEMBER'
          AND assignment."workspaceMemberId" IS NOT NULL
      ) = 1
  );
