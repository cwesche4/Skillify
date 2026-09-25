import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260922030000_durable_customers/migration.sql',
  ),
  'utf8',
)

describe('durable Customer migration', () => {
  it('is additive and creates only the Customer foundation', () => {
    expect(migration).toContain('CREATE TABLE "Customer"')
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE FROM)\b/)
    expect(migration).not.toContain('ALTER TABLE "Job"')
    expect(migration).not.toContain('ALTER TABLE "RevenueTransaction"')
    expect(migration).not.toContain('ALTER TABLE "SchedulingEvent"')
    expect(migration).not.toContain('ALTER TABLE "Automation"')
  })

  it('enforces workspace identity and workspace-safe assignment', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "Customer_id_workspaceId_key" ON "Customer"("id", "workspaceId")',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("assignedMemberId", "workspaceId") REFERENCES "WorkspaceMember"("id", "workspaceId")',
    )
    expect(migration).toContain('ON DELETE RESTRICT')
  })

  it('supports scoped lookups without unique contact constraints', () => {
    expect(migration).toContain('"Customer_workspaceId_email_idx"')
    expect(migration).toContain('"Customer_workspaceId_phone_idx"')
    expect(migration).not.toContain(
      'CREATE UNIQUE INDEX "Customer_workspaceId_email',
    )
    expect(migration).not.toContain(
      'CREATE UNIQUE INDEX "Customer_workspaceId_phone',
    )
  })

  it('creates the table before indexes and foreign keys', () => {
    expect(migration.indexOf('CREATE TABLE "Customer"')).toBeLessThan(
      migration.indexOf('Customer_id_workspaceId_key'),
    )
    expect(migration.indexOf('CREATE TABLE "Customer"')).toBeLessThan(
      migration.indexOf('Customer_workspaceId_fkey'),
    )
  })
})
