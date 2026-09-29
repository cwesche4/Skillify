import { readFileSync } from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  path.join(
    process.cwd(),
    'prisma/migrations/20260928000000_job_operational_context/migration.sql',
  ),
  'utf8',
)

describe('Phase 9A Job operational context migration', () => {
  it('adds only the four nullable Job snapshot columns and backfills scoped linked Jobs', () => {
    expect(migration).toContain('ADD COLUMN "serviceLocationSnapshot" TEXT')
    expect(migration).toContain('ADD COLUMN "customerContactNameSnapshot" TEXT')
    expect(migration).toContain('ADD COLUMN "customerPhoneSnapshot" TEXT')
    expect(migration).toContain('ADD COLUMN "customerEmailSnapshot" TEXT')
    expect(migration).toContain('customer."workspaceId" = job."workspaceId"')
    expect(migration).toContain('event."workspaceId" = job."workspaceId"')
    expect(migration).not.toContain('NOT NULL')
  })
})
