import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrations = readdirSync(resolve(process.cwd(), 'prisma/migrations'))
  .filter((entry) => /^\d/.test(entry))
  .sort()
const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20261001000000_estimate_operationalization/migration.sql',
  ),
  'utf8',
)
const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
)

describe('Estimate operationalization migration', () => {
  it('remains the frozen additive migration 42', () => {
    expect(migrations).toHaveLength(43)
    expect(migrations.at(-2)).toBe('20261001000000_estimate_operationalization')
    expect(migration).not.toMatch(
      /^\s*(DROP|TRUNCATE|DELETE FROM|UPDATE|INSERT INTO)\b/m,
    )
  })

  it('enforces exact-estimate, family, idempotency, and line uniqueness', () => {
    expect(migration).toContain(
      'EstimateOperationalization_workspace_estimate_key',
    )
    expect(migration).toContain(
      'EstimateOperationalization_workspace_reference_key',
    )
    expect(migration).toContain(
      'EstimateOperationalization_workspace_idempotency_key',
    )
    expect(migration).toContain(
      'EstimateOperationalizationItem_workspace_line_key',
    )
  })

  it('uses restrictive workspace-safe provenance and target-shape constraints', () => {
    expect(migration).toContain('EstimateOperationalizationItem_target_check')
    expect(migration).toContain('EstimateOperationalizationItem_step_fkey')
    expect(migration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE')
    expect(migration).toContain(
      'REFERENCES "WorkItem"("id", "jobId", "workspaceId")',
    )
  })

  it('keeps Prisma-generated names aligned with the explicit migration names', () => {
    expect(schema).toContain(
      '@@unique([id, jobId, workspaceId], map: "WorkItem_id_job_workspace_key")',
    )
    expect(schema).toContain(
      '@@unique([id, workspaceId, estimateId], map: "EstimateLineItem_id_workspace_estimate_key")',
    )
    expect(schema).toContain(
      'map: "EstimateOperationalization_workspace_estimate_key"',
    )
    expect(schema).toContain('map: "EstimateOperationalizationItem_step_fkey"')
  })

  it('does not create economic or automation records', () => {
    expect(migration).not.toContain('RevenueTransaction')
    expect(migration).not.toContain('DomainOutboxEvent')
    expect(migration).not.toContain('Automation')
  })
})
