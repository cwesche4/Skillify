import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrations = readdirSync(resolve(process.cwd(), 'prisma/migrations'))
  .filter((entry) => /^\d/.test(entry))
  .sort()
const name = '20261003000000_estimate_customer_experience'
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations', name, 'migration.sql'),
  'utf8',
)
const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
)

describe('Phase 11C migration 43', () => {
  it('is the only migration after the frozen Phase 11B migration', () => {
    expect(migrations).toHaveLength(44)
    expect(migrations.at(-3)).toBe('20261001000000_estimate_operationalization')
    expect(migrations.at(-2)).toBe(name)
  })

  it('adds workspace-safe share, delivery, and decision authority', () => {
    expect(migration).toContain('CREATE TABLE "EstimateShare"')
    expect(migration).toContain('CREATE TABLE "EstimateDelivery"')
    expect(migration).toContain('CREATE TABLE "EstimateDecision"')
    expect(migration).toContain('EstimateShare_one_active_per_revision_key')
    expect(migration).toContain('WHERE "revokedAt" IS NULL')
    expect(migration).toContain('EstimateDelivery_workspace_idempotency_key')
    expect(migration).toContain('EstimateDecision_workspace_estimate_key')
    expect(migration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE')
  })

  it('backfills management decisions without inventing customer authority', () => {
    expect(migration).toContain('\'MANAGEMENT\'::"EstimateDecisionSource"')
    expect(migration).toContain(
      'CASE WHEN "status" = \'ACCEPTED\' THEN "acceptedByUserId" ELSE "declinedByUserId" END',
    )
    expect(migration).toContain(
      'CASE WHEN "status" = \'ACCEPTED\' THEN "acceptedAt" ELSE "declinedAt" END',
    )
    expect(migration).not.toContain(
      '\'CUSTOMER_LINK\'::"EstimateDecisionSource"',
    )
  })

  it('narrowly permits actorless customer terminal projections', () => {
    expect(migration).toContain(
      'DROP CONSTRAINT "Estimate_acceptance_fields_check"',
    )
    expect(migration).toContain(
      'DROP CONSTRAINT "Estimate_decline_fields_check"',
    )
    expect(migration).toContain('EstimateDecision_source_shape_check')
    expect(migration).toContain('AND "acknowledgmentNameSnapshot" IS NOT NULL')
    expect(migration).toContain(
      '"status" <> \'PROCESSING\' AND "claimedAt" IS NULL AND "claimedBy" IS NULL AND "leaseExpiresAt" IS NULL',
    )
    expect(migration).toContain('EstimateDelivery_failure_check')
    expect(migration).toContain('"leaseExpiresAt" > "claimedAt"')
    expect(migration).toContain('Estimate_decision_projection_check')
    expect(migration).toContain('EstimateDecision_projection_check')
    expect(migration).toContain('EstimateDecision_immutable_check')
    expect(schema).toContain('decisionEvidence')
    expect(schema).toContain('EstimateDecisionSource')
  })

  it('does not create operations, revenue, follow-up, or domain events', () => {
    expect(migration).not.toContain('RevenueTransaction')
    expect(migration).not.toContain('DomainOutboxEvent')
    expect(migration).not.toContain('RecurringService')
    expect(migration).not.toContain('SchedulingEvent')
    expect(migration).not.toContain('Automation')
  })
})
