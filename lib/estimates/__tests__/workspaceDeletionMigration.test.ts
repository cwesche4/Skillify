import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationName = '20261005000000_estimate_decision_workspace_deletion'
const migrations = readdirSync(resolve(process.cwd(), 'prisma/migrations'))
  .filter((entry) => /^\d/.test(entry))
  .sort()
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations', migrationName, 'migration.sql'),
  'utf8',
)
const customerExperienceMigration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20261003000000_estimate_customer_experience/migration.sql',
  ),
  'utf8',
)

describe('Launch Integrity migration 45', () => {
  it('is the only migration after the frozen Phase 11D chain', () => {
    expect(migrations).toHaveLength(45)
    expect(migrations.at(-2)).toBe(
      '20261004000000_estimate_follow_up_scheduling',
    )
    expect(migrations.at(-1)).toBe(migrationName)
    expect(migrations).not.toContain(
      '20261006000000_estimate_decision_workspace_deletion',
    )
  })

  it('keeps UPDATE immutable and adds a deferred Workspace-survival DELETE guard', () => {
    expect(migration).toContain(
      'DROP TRIGGER "EstimateDecision_immutable_check" ON "EstimateDecision"',
    )
    expect(migration).toMatch(
      /CREATE TRIGGER "EstimateDecision_immutable_check"\s+BEFORE UPDATE ON "EstimateDecision"/,
    )
    expect(migration).not.toMatch(/BEFORE UPDATE OR DELETE/)
    expect(migration).not.toContain('DROP FUNCTION')
    expect(migration).not.toContain('CASCADE')
    expect(migration).toContain(
      'CREATE FUNCTION "prevent_live_estimate_decision_delete"()',
    )
    expect(migration).toMatch(
      /CREATE CONSTRAINT TRIGGER "EstimateDecision_live_workspace_delete_check"\s+AFTER DELETE ON "EstimateDecision"\s+DEFERRABLE INITIALLY DEFERRED/,
    )
    expect(migration).toContain('WHERE "id" = OLD."workspaceId"')
    expect(migration).toContain(
      'Estimate decision evidence cannot be deleted while its workspace exists.',
    )
    expect(migration).toContain('RETURN NULL')
    expect(migration).not.toMatch(/session|current_setting|set_config/i)
    expect(migration).not.toMatch(/DISABLE TRIGGER|ENABLE TRIGGER/)
  })

  it('preserves the unchanged deferred projection invariant as an independent check', () => {
    expect(customerExperienceMigration).toMatch(
      /CREATE CONSTRAINT TRIGGER "EstimateDecision_projection_check"[\s\S]*DEFERRABLE INITIALLY DEFERRED/,
    )
    expect(customerExperienceMigration).toContain(
      'Estimate terminal state must match its decision evidence.',
    )
    expect(customerExperienceMigration).toContain(
      'Estimate decision evidence requires matching terminal state.',
    )
    expect(migration).not.toContain(
      'DROP TRIGGER "EstimateDecision_projection_check"',
    )
    expect(migration).not.toContain(
      'CREATE CONSTRAINT TRIGGER "EstimateDecision_projection_check"',
    )
  })
})
