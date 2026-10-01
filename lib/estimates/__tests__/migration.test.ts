import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260930000000_estimate_foundation/migration.sql',
  ),
  'utf8',
)
const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
)

describe('Estimate foundation migration', () => {
  it('adds only the Estimate domain and exact bounded enums', () => {
    expect(migration).toContain('CREATE TABLE "Estimate"')
    expect(migration).toContain('CREATE TABLE "EstimateLineItem"')
    for (const value of [
      'DRAFT',
      'PRESENTED',
      'ACCEPTED',
      'DECLINED',
      'SUPERSEDED',
      'VOIDED',
      'ONE_TIME',
      'PER_VISIT',
    ]) {
      expect(migration).toContain(`'${value}'`)
    }
    expect(migration).not.toMatch(
      /^\s*(DROP|TRUNCATE|DELETE FROM|UPDATE|INSERT INTO)\b/m,
    )
  })

  it('enforces workspace-scoped parents, revision lineage, and child ownership', () => {
    expect(migration).toContain(
      'FOREIGN KEY ("leadId", "workspaceId") REFERENCES "Lead"("id", "workspaceId")',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("customerId", "workspaceId") REFERENCES "Customer"("id", "workspaceId")',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("previousRevisionId", "workspaceId", "referenceNumber") REFERENCES "Estimate"("id", "workspaceId", "referenceNumber")',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("estimateId", "workspaceId") REFERENCES "Estimate"("id", "workspaceId")',
    )
    expect(migration).toContain('Estimate_parent_check')
    expect(migration).toContain(
      'Estimate_previousRevisionId_workspaceId_referenceNumber_key',
    )
    expect(migration).toContain('Estimate_id_workspaceId_referenceNumber_key')
  })

  it('enforces economic and lifecycle invariants without touching downstream domains', () => {
    expect(migration).toContain('EstimateLineItem_amount_check')
    expect(migration).toContain('Estimate_one_time_total_check')
    expect(migration).toContain('Estimate_per_visit_total_check')
    expect(migration).toContain('Estimate_presented_fields_check')
    for (const table of [
      'Job',
      'RecurringService',
      'SchedulingEvent',
      'RevenueTransaction',
      'Automation',
    ]) {
      expect(migration).not.toContain(`ALTER TABLE "${table}"`)
    }
    expect(schema).toContain('model Estimate {')
    expect(schema).toContain('model EstimateLineItem {')
  })
})
