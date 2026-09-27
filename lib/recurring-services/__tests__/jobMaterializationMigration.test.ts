import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'prisma/migrations/20260926010000_recurring_service_job_materialization/migration.sql',
  ),
  'utf8',
)

describe('Phase 8B migration', () => {
  it('adds immutable Job source/snapshot fields and explicit step ordering', () => {
    expect(migration).toContain('"recurringServiceId" TEXT')
    expect(migration).toContain('"schedulingEventId" TEXT')
    expect(migration).toContain('"serviceInstructionsSnapshot" TEXT')
    expect(migration).toContain('ADD COLUMN "sortOrder" INTEGER')
  })

  it('enforces one Job per Scheduling occurrence and ordered steps per Job', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "Job_schedulingEventId_workspaceId_key"',
    )
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "WorkItem_jobId_sortOrder_key"',
    )
  })

  it('uses workspace-safe restrictive historical relations', () => {
    expect(migration).toContain(
      'FOREIGN KEY ("recurringServiceId", "workspaceId") REFERENCES "RecurringService"("id", "workspaceId") ON DELETE RESTRICT',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("schedulingEventId", "workspaceId") REFERENCES "SchedulingEvent"("id", "workspaceId") ON DELETE RESTRICT',
    )
  })

  it('does not alter recurrence rules, revenue, or original migrations', () => {
    expect(migration).not.toContain('"rrule"')
    expect(migration).not.toContain('"RevenueTransaction"')
    expect(migration).not.toContain('CREATE TABLE "Job"')
  })
})
