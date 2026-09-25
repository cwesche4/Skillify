import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260922050000_durable_leads/migration.sql',
  ),
  'utf8',
)
const previous = readFileSync(
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

describe('durable Leads migration', () => {
  it('creates the Lead table and exact Simple Service stages additively', () => {
    expect(migration).toContain('CREATE TABLE "Lead"')
    for (const stage of [
      'NEW',
      'CONTACTED',
      'ESTIMATE_VISIT',
      'FOLLOW_UP',
      'WON',
      'LOST',
    ]) {
      expect(migration).toContain(`'${stage}'`)
    }
    expect(migration).not.toMatch(
      /^\s*(DROP|TRUNCATE|DELETE FROM|UPDATE|INSERT INTO)\b/m,
    )
  })

  it('uses workspace-safe assignment and creator relations', () => {
    expect(migration).toContain(
      'FOREIGN KEY ("assignedMemberId", "workspaceId")',
    )
    expect(migration).toContain(
      'REFERENCES "WorkspaceMember"("id", "workspaceId")',
    )
    expect(migration).toContain('Lead_createdByUserId_fkey')
    expect(schema).toContain('assignedLeads')
    expect(schema).toContain('leadsCreated')
  })

  it('contains no preview backfill or Customer, Job, Revenue, Scheduling, or Automation mutation', () => {
    expect(migration).not.toMatch(
      /preview|sessionStorage|SharedContactIdentity/i,
    )
    for (const table of [
      'Customer',
      'Job',
      'RevenueTransaction',
      'SchedulingEvent',
      'Automation',
    ]) {
      expect(migration).not.toContain(`ALTER TABLE "${table}"`)
    }
    expect(previous).not.toContain('CREATE TABLE "Lead"')
  })
})
