import { readFileSync } from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  path.join(
    process.cwd(),
    'prisma/migrations/20260926030000_recurring_job_assignments/migration.sql',
  ),
  'utf8',
)

describe('Phase 8D Job assignment migration', () => {
  it('enforces one MEMBER or TEAM target and blocks duplicate principals per Job', () => {
    expect(migration).toContain('CONSTRAINT "JobAssignment_target_check"')
    expect(migration).toContain(
      '"assignmentType" = \'MEMBER\' AND "workspaceMemberId" IS NOT NULL AND "teamId" IS NULL',
    )
    expect(migration).toContain(
      '"assignmentType" = \'TEAM\' AND "teamId" IS NOT NULL AND "workspaceMemberId" IS NULL',
    )
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "JobAssignment_jobId_workspaceMemberId_key"',
    )
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "JobAssignment_jobId_teamId_key"',
    )
  })

  it('uses workspace-safe Job/member/team foreign keys with history-preserving deletion rules', () => {
    expect(migration).toContain(
      'FOREIGN KEY ("jobId", "workspaceId") REFERENCES "Job"("id", "workspaceId")',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("workspaceMemberId", "workspaceId") REFERENCES "WorkspaceMember"("id", "workspaceId")',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("teamId", "workspaceId") REFERENCES "WorkspaceTeam"("id", "workspaceId")',
    )
    expect(migration).toContain('ON DELETE CASCADE ON UPDATE CASCADE;')
    expect(
      migration.match(/ON DELETE RESTRICT ON UPDATE CASCADE;/g),
    ).toHaveLength(3)
  })

  it('backfills authoritative Scheduling principals and applies the single-member compatibility mirror', () => {
    expect(migration.match(/INSERT INTO "JobAssignment"/g)).toHaveLength(2)
    expect(migration).toContain(
      'INNER JOIN "SchedulingAssignment" AS assignment',
    )
    expect(migration).toContain(
      'COALESCE(assignment."displaySnapshot", team."name")',
    )
    expect(migration).toContain('HAVING COUNT(*) = 1')
    expect(migration).toContain('SET "assigneeMemberId" = NULL')
  })
})
