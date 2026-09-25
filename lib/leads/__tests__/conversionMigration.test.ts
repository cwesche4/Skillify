import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260922060000_lead_customer_conversion/migration.sql',
  ),
  'utf8',
)
const previous = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260922050000_durable_leads/migration.sql',
  ),
  'utf8',
)
const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
)
const store = readFileSync(
  resolve(process.cwd(), 'lib/leads/prismaStore.ts'),
  'utf8',
)

describe('Lead to Customer conversion migration', () => {
  it('adds nullable conversion identity without backfill or destructive SQL', () => {
    expect(migration).toContain('ADD COLUMN "convertedCustomerId" TEXT')
    expect(migration).toContain('ADD COLUMN "convertedAt" TIMESTAMP(3)')
    expect(migration).not.toMatch(
      /^\s*(DROP|TRUNCATE|DELETE FROM|UPDATE|INSERT INTO)\b/m,
    )
    expect(migration).not.toContain('NOT NULL')
    expect(previous).not.toContain('convertedCustomerId')
    expect(previous).not.toContain('convertedAt')
  })

  it('enforces one conversion target and a workspace-composite relationship', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "Lead_convertedCustomerId_workspaceId_key"',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("convertedCustomerId", "workspaceId")',
    )
    expect(migration).toContain('REFERENCES "Customer"("id", "workspaceId")')
    expect(migration).toContain('ON DELETE RESTRICT')
    expect(schema).toContain('@@unique([convertedCustomerId, workspaceId])')
  })

  it('uses a transactional Lead row lock and does not touch adjacent domains', () => {
    expect(store).toContain('FOR UPDATE')
    expect(store).toContain('prisma.$transaction')
    for (const table of [
      'Job',
      'RevenueTransaction',
      'SchedulingEvent',
      'Automation',
    ]) {
      expect(migration).not.toContain(`ALTER TABLE "${table}"`)
    }
  })
})
