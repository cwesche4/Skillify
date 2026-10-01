import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'lib/estimates/prismaStore.ts'),
  'utf8',
)

describe('Estimate Prisma store security and concurrency structure', () => {
  it('locks and fences Lead, Customer, Estimate, and predecessor reads by workspace', () => {
    expect(source).toMatch(
      /FROM "Lead"[\s\S]*"workspaceId" = \$\{input\.workspaceId\}[\s\S]*FOR SHARE/,
    )
    expect(source).toMatch(
      /FROM "Customer"[\s\S]*"workspaceId" = \$\{input\.workspaceId\}[\s\S]*FOR SHARE/,
    )
    expect(source).toMatch(
      /FROM "Estimate"[\s\S]*"workspaceId" = \$\{workspaceId\}[\s\S]*FOR UPDATE/,
    )
    expect(source).toContain('previousRevisionId: current.id')
    expect(source).toContain('lead.convertedCustomerId !== customerId')
  })

  it('atomically fences final decisions and supersedes the active Presented family revision', () => {
    expect(source).toMatch(
      /referenceNumber" = \$\{current\.referenceNumber\}[\s\S]*FOR UPDATE/,
    )
    expect(source).toContain('revision.status === EstimateStatus.ACCEPTED')
    expect(source).toContain('revision.status === EstimateStatus.DECLINED')
    expect(source).toContain('status: EstimateStatus.SUPERSEDED')
    expect(source).toContain('status: EstimateStatus.PRESENTED')
  })

  it('replaces line items and totals inside a single transaction under an Estimate lock', () => {
    expect(source).toContain('async updateDraft')
    expect(source).toContain('await lockEstimate')
    expect(source).toContain('estimateLineItem.deleteMany')
    expect(source).toContain('estimateLineItem.createMany')
    expect(source).toContain('Object.assign(updateData, totals(lineItems))')
  })

  it('has no Job, Recurring Service, Scheduling, revenue, notification, or outbox write', () => {
    expect(source).not.toMatch(
      /tx\.(job|recurringService|schedulingEvent|revenueTransaction|notification|domainOutboxEvent)\.(create|update|delete)/,
    )
  })
})
