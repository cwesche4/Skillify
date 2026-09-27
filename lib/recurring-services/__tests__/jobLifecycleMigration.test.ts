import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'prisma/migrations/20260926020000_recurring_job_lifecycle/migration.sql',
  ),
  'utf8',
)

describe('Phase 8C recurring Job lifecycle migration', () => {
  it('adds only nullable lifecycle metadata and a migration-safe status invariant', () => {
    expect(migration).toContain(
      'ALTER TYPE "JobStatus" ADD VALUE \'UNABLE_TO_COMPLETE\'',
    )
    expect(migration).toContain('CREATE TYPE "JobCancellationReason"')
    expect(migration).toContain('CREATE TYPE "JobUnableToCompleteReason"')
    expect(migration).toContain('"unableToCompleteReportedByMemberId" TEXT')
    expect(migration).toContain('Job_unable_to_complete_metadata_check')
    expect(migration).not.toContain('ALTER TABLE "RevenueTransaction"')
    expect(migration).not.toContain('DROP TABLE')
  })
})
