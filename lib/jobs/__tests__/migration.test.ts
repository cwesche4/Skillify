import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260922020000_durable_jobs_work_items/migration.sql',
  ),
  'utf8',
)

const customerRelationMigration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260922040000_job_customer_relation/migration.sql',
  ),
  'utf8',
)
const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
)

describe('durable Jobs and Work Items migration', () => {
  it('enforces explicit Job Step and To-Do parent semantics', () => {
    expect(migration).toContain('CONSTRAINT "WorkItem_kind_job_check"')
    expect(migration).toContain(
      '("kind" = \'JOB_STEP\' AND "jobId" IS NOT NULL)',
    )
    expect(migration).toContain('("kind" = \'TODO\' AND "jobId" IS NULL)')
  })

  it('enforces same-workspace Job and member relationships', () => {
    expect(migration).toContain(
      'FOREIGN KEY ("jobId", "workspaceId") REFERENCES "Job"("id", "workspaceId")',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("assigneeMemberId", "workspaceId") REFERENCES "WorkspaceMember"("id", "workspaceId")',
    )
  })

  it('restricts Job deletion and keeps automation and revenue schemas untouched', () => {
    expect(migration).toContain('CONSTRAINT "WorkItem_jobId_workspaceId_fkey"')
    expect(migration).toContain('ON DELETE RESTRICT')
    expect(migration).not.toContain('ALTER TABLE "Automation"')
    expect(migration).not.toContain('ALTER TABLE "RevenueTransaction"')
  })

  it('is additive and creates referenced structures before foreign keys', () => {
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE FROM)\b/)
    expect(migration.indexOf('CREATE TABLE "Job"')).toBeLessThan(
      migration.indexOf('WorkItem_jobId_workspaceId_fkey'),
    )
    expect(migration.indexOf('CREATE TABLE "WorkItem"')).toBeLessThan(
      migration.indexOf('WorkItem_workspaceId_fkey'),
    )
    expect(
      migration.indexOf('WorkspaceMember_id_workspaceId_key'),
    ).toBeLessThan(migration.indexOf('Job_assigneeMemberId_workspaceId_fkey'))
  })
})

describe('durable Job Customer relation migration', () => {
  it('adds a nullable customerId and workspace-safe composite relation', () => {
    expect(customerRelationMigration).toContain(
      'ALTER TABLE "Job" ADD COLUMN "customerId" TEXT;',
    )
    expect(customerRelationMigration).toContain(
      'FOREIGN KEY ("customerId", "workspaceId")',
    )
    expect(customerRelationMigration).toContain(
      'REFERENCES "Customer"("id", "workspaceId")',
    )
    expect(customerRelationMigration).toContain('ON DELETE RESTRICT')
    expect(schema).toMatch(/customerId\s+String\?/)
  })

  it('preserves legacy fields and performs no speculative backfill', () => {
    expect(customerRelationMigration).not.toMatch(
      /^\s*(UPDATE|INSERT|DELETE FROM|DROP|TRUNCATE)\b/m,
    )
    expect(schema).toMatch(/customerReferenceId\s+String\?/)
    expect(schema).toMatch(/customerDisplayName\s+String\?/)
    expect(migration).not.toContain('customerId')
  })
})
