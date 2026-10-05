import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationName = '20261004000000_estimate_follow_up_scheduling'
const migrations = readdirSync(resolve(process.cwd(), 'prisma/migrations'))
  .filter((entry) => /^\d/.test(entry))
  .sort()
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations', migrationName, 'migration.sql'),
  'utf8',
)

describe('Phase 11D migration 44', () => {
  it('is the one additive migration after the frozen Phase 11C migration', () => {
    expect(migrations).toHaveLength(45)
    expect(migrations.at(-3)).toBe(
      '20261003000000_estimate_customer_experience',
    )
    expect(migrations.at(-2)).toBe(migrationName)
  })

  it('defaults historical deliveries to manual without creating schedules', () => {
    expect(migration).toContain(
      '"origin" "EstimateDeliveryOrigin" NOT NULL DEFAULT \'MANUAL\'',
    )
    expect(migration).not.toMatch(/INSERT INTO "EstimateFollowUpSchedule"/)
  })

  it('enforces logical identity and workspace-scoped restrictive provenance', () => {
    expect(migration).toContain('EstimateFollowUpSchedule_logical_identity_key')
    expect(migration).toContain('EstimateFollowUpSchedule_source_delivery_fkey')
    expect(migration).toContain(
      'EstimateFollowUpSchedule_generated_delivery_fkey',
    )
    expect(migration).toContain('EstimateFollowUpSchedule_dispatch_run_fkey')
    expect(migration).toContain('SimpleAutomationDispatch_id_workspace_run_key')
    expect(migration).toContain('EstimateFollowUpSchedule_run_fkey')
    expect(migration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE')
  })

  it('contains bounded-claim indexes and explicit lifecycle checks', () => {
    expect(migration).toContain('EstimateFollowUpSchedule_status_due_idx')
    expect(migration).toContain('EstimateFollowUpSchedule_status_lease_idx')
    expect(migration).toContain('EstimateFollowUpSchedule_claim_check')
    expect(migration).toContain('EstimateFollowUpSchedule_dispatch_check')
    expect(migration).toContain('EstimateFollowUpSchedule_retry_check')
  })
})
