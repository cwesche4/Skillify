import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260926000000_recurring_service_foundation/migration.sql',
  ),
  'utf8',
)
const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
)

describe('Recurring Service foundation migration', () => {
  it('is additive and does not materialize Jobs or WorkItems', () => {
    expect(migration).toContain('CREATE TABLE "RecurringService"')
    expect(migration).toContain('CREATE TABLE "RecurringServiceStepTemplate"')
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE FROM)\b/m)
    expect(migration).not.toContain('ALTER TABLE "Job"')
    expect(migration).not.toContain('ALTER TABLE "WorkItem"')
    expect(migration).not.toContain('ALTER TABLE "RevenueTransaction"')
  })

  it('enforces same-workspace Customer and Scheduling series relations', () => {
    expect(migration).toContain(
      'FOREIGN KEY ("customerId", "workspaceId") REFERENCES "Customer"("id", "workspaceId")',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("recurrenceSeriesId", "workspaceId") REFERENCES "SchedulingRecurrenceSeries"("id", "workspaceId")',
    )
    expect(migration).toContain(
      '"SchedulingRecurrenceSeries_id_workspaceId_key"',
    )
    expect(migration).toContain('ON DELETE RESTRICT')
  })

  it('enforces one service per series and deterministic step ordering', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "RecurringService_recurrenceSeriesId_workspaceId_key"',
    )
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "RecurringServiceStepTemplate_recurringServiceId_sortOrder_key"',
    )
    expect(migration).toContain(
      'CONSTRAINT "RecurringServiceStepTemplate_sort_order_check"',
    )
  })

  it('keeps recurrence fields exclusively on Scheduling models', () => {
    const recurringServiceModel = schema.match(
      /model RecurringService \{[\s\S]*?\n\}/,
    )?.[0]
    expect(recurringServiceModel).toBeTruthy()
    expect(recurringServiceModel).toContain('recurrenceSeriesId')
    expect(recurringServiceModel).not.toMatch(
      /\b(rrule|recurrenceRule|timezone|startsAt|durationMinutes)\b/,
    )
  })
})
