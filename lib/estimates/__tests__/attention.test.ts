import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }))

vi.mock('@/lib/db', () => ({ prisma: { $queryRaw: mocks.queryRaw } }))

import {
  estimateAttentionWhere,
  findOperationalizationViewEstimateIds,
} from '@/lib/estimates/attention'

const base = {
  workspaceDateKey: '2026-10-04',
  now: new Date('2026-10-04T12:00:00.000Z'),
}

describe('Estimate attention predicates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryRaw.mockResolvedValue([])
  })

  it('requires a current active share with a SENT delivery for Awaiting Decision', () => {
    const where = estimateAttentionWhere({ ...base, view: 'AWAITING_DECISION' })
    expect(where).toMatchObject({
      archivedAt: null,
      status: 'PRESENTED',
      decisionEvidence: null,
      shares: {
        some: {
          revokedAt: null,
          deliveries: { some: { status: 'SENT' } },
        },
      },
    })
  })

  it('uses the inclusive three-calendar-day Expiring Soon boundary', () => {
    expect(
      estimateAttentionWhere({ ...base, view: 'EXPIRING_SOON' }),
    ).toMatchObject({
      status: 'PRESENTED',
      expiresOn: { gte: '2026-10-04', lte: '2026-10-07' },
    })
  })

  it('keeps accepted work explicit in the base predicate', () => {
    expect(
      estimateAttentionWhere({ ...base, view: 'READY_TO_CREATE_WORK' }),
    ).toMatchObject({
      status: 'ACCEPTED',
      archivedAt: null,
    })
  })

  it('checks Create Work provenance by workspace/reference family', async () => {
    await findOperationalizationViewEstimateIds({
      workspaceId: 'workspace-a',
      view: 'READY_TO_CREATE_WORK',
      estimateIds: ['estimate-a'],
    })

    const sql = (
      mocks.queryRaw.mock.calls[0]?.[0] as { strings: string[] }
    ).strings.join(' ')
    expect(sql).toContain('NOT EXISTS')
    expect(sql).toContain('work."referenceNumber" = estimate."referenceNumber"')
    expect(sql).toContain('work."workspaceId" = estimate."workspaceId"')
  })
})
