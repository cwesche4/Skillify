import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  listEstimates: vi.fn(),
  getEstimate: vi.fn(),
  createEstimate: vi.fn(),
  updateEstimate: vi.fn(),
  transitionEstimate: vi.fn(),
  createRevision: vi.fn(),
  archiveEstimate: vi.fn(),
  operationalize: vi.fn(),
}))

vi.mock('@/lib/estimates/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/estimates/api')>(
    '@/lib/estimates/api',
  )
  return { ...actual, authorizeEstimateRequest: mocks.authorize }
})

vi.mock('@/lib/estimates/defaultService', () => ({
  estimateService: {
    listEstimates: mocks.listEstimates,
    getEstimate: mocks.getEstimate,
    createEstimate: mocks.createEstimate,
    updateEstimate: mocks.updateEstimate,
    transitionEstimate: mocks.transitionEstimate,
    createRevision: mocks.createRevision,
    archiveEstimate: mocks.archiveEstimate,
  },
}))

vi.mock('@/lib/estimates/operationalization', () => ({
  operationalizeAcceptedEstimate: mocks.operationalize,
}))

import * as actionRoute from '@/app/api/workspaces/[workspaceId]/estimates/[estimateId]/[action]/route'
import * as itemRoute from '@/app/api/workspaces/[workspaceId]/estimates/[estimateId]/route'
import * as collectionRoute from '@/app/api/workspaces/[workspaceId]/estimates/route'
import * as operationalizeRoute from '@/app/api/workspaces/[workspaceId]/estimates/[estimateId]/operationalize/route'

const allowed = {
  allowed: true as const,
  userId: 'clerk-manager',
  userProfileId: 'profile-manager',
  role: 'MANAGER',
  workspaceId: 'ws-a',
  workspaceMemberId: 'member-manager',
}

describe('Estimate API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authorize.mockResolvedValue(allowed)
  })

  it('uses the authorized management identity and returns 201 then 200 replay', async () => {
    const body = {
      expectedVersion: 2,
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      recurring: [],
    }
    mocks.operationalize.mockResolvedValueOnce({
      operationalizationId: 'handoff-a',
      replayed: false,
    })
    const created = await operationalizeRoute.POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      { params: { workspaceId: 'ws-a', estimateId: 'estimate-a' } },
    )
    expect(created.status).toBe(201)
    expect(mocks.operationalize).toHaveBeenCalledWith({
      actor: expect.objectContaining({
        workspaceId: 'ws-a',
        userProfileId: 'profile-manager',
        workspaceMemberId: 'member-manager',
        canManageScheduling: true,
      }),
      estimateId: 'estimate-a',
      rawInput: body,
    })

    mocks.operationalize.mockResolvedValueOnce({
      operationalizationId: 'handoff-a',
      replayed: true,
    })
    const replay = await operationalizeRoute.POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      { params: { workspaceId: 'ws-a', estimateId: 'estimate-a' } },
    )
    expect(replay.status).toBe(200)
  })

  it('denies operationalization before reading the request body', async () => {
    mocks.authorize.mockResolvedValueOnce({
      allowed: false,
      status: 403,
      message: 'Forbidden',
    })
    const response = await operationalizeRoute.POST(
      new Request('http://localhost', { method: 'POST', body: '{broken' }),
      { params: { workspaceId: 'ws-a', estimateId: 'estimate-a' } },
    )
    expect(response.status).toBe(403)
    expect(mocks.operationalize).not.toHaveBeenCalled()
  })

  it('passes only bounded saved-view and cursor inputs to the list service', async () => {
    mocks.listEstimates.mockResolvedValue({
      estimates: [],
      nextCursor: null,
      workspaceDateKey: '2026-09-30',
    })
    const response = await collectionRoute.GET(
      new Request(
        'http://localhost/api/workspaces/ws-a/estimates?view=PAST_EXPIRY&pageSize=25&cursor=est-a&leadId=lead-a',
      ),
      { params: { workspaceId: 'ws-a' } },
    )
    expect(response.status).toBe(200)
    expect(mocks.listEstimates).toHaveBeenCalledWith('ws-a', {
      view: 'PAST_EXPIRY',
      pageSize: '25',
      cursor: 'est-a',
      leadId: 'lead-a',
      customerId: undefined,
    })
  })

  it('uses server identity and ignores any attempted actor in the create body', async () => {
    mocks.createEstimate.mockResolvedValue({ id: 'estimate-a' })
    const body = {
      leadId: 'lead-a',
      title: 'Cleanup',
      actor: 'spoofed',
    }
    await collectionRoute.POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      { params: { workspaceId: 'ws-a' } },
    )
    expect(mocks.createEstimate).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-manager' },
      body,
    )
  })

  it('scopes detail, edit, and archive to the route workspace and Estimate id', async () => {
    mocks.getEstimate.mockResolvedValue({ estimate: { id: 'estimate-a' } })
    mocks.updateEstimate.mockResolvedValue({ id: 'estimate-a', version: 2 })
    mocks.archiveEstimate.mockResolvedValue({ id: 'estimate-a' })

    await itemRoute.GET(new Request('http://localhost'), {
      params: { workspaceId: 'ws-a', estimateId: 'estimate-a' },
    })
    await itemRoute.PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ expectedVersion: 1, title: 'Updated' }),
      }),
      { params: { workspaceId: 'ws-a', estimateId: 'estimate-a' } },
    )
    await itemRoute.DELETE(
      new Request('http://localhost', {
        method: 'DELETE',
        body: JSON.stringify({ expectedVersion: 2 }),
      }),
      { params: { workspaceId: 'ws-a', estimateId: 'estimate-a' } },
    )

    expect(mocks.getEstimate).toHaveBeenCalledWith('ws-a', 'estimate-a')
    expect(mocks.updateEstimate).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-manager' },
      'estimate-a',
      { expectedVersion: 1, title: 'Updated' },
    )
    expect(mocks.archiveEstimate).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-manager' },
      'estimate-a',
      { expectedVersion: 2 },
    )
  })

  it.each(['present', 'accept', 'decline', 'void'] as const)(
    'routes %s as an explicit lifecycle action',
    async (action) => {
      mocks.transitionEstimate.mockResolvedValue({ id: 'estimate-a' })
      const response = await actionRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({ expectedVersion: 3 }),
        }),
        {
          params: {
            workspaceId: 'ws-a',
            estimateId: 'estimate-a',
            action,
          },
        },
      )
      expect(response.status).toBe(200)
      expect(mocks.transitionEstimate).toHaveBeenCalledWith(
        { workspaceId: 'ws-a', userProfileId: 'profile-manager' },
        'estimate-a',
        action,
        { expectedVersion: 3 },
      )
    },
  )

  it('routes revision creation separately and rejects unsupported actions', async () => {
    mocks.createRevision.mockResolvedValue({ id: 'estimate-rev-2' })
    const revised = await actionRoute.POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: 4 }),
      }),
      {
        params: {
          workspaceId: 'ws-a',
          estimateId: 'estimate-a',
          action: 'revise',
        },
      },
    )
    expect(revised.status).toBe(200)
    expect(mocks.createRevision).toHaveBeenCalled()

    const unsupported = await actionRoute.POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: 4 }),
      }),
      {
        params: {
          workspaceId: 'ws-a',
          estimateId: 'estimate-a',
          action: 'send',
        },
      },
    )
    expect(unsupported.status).toBe(404)
  })

  it('denies Members before disclosing list, detail, or pricing data', async () => {
    mocks.authorize.mockResolvedValue({
      allowed: false,
      status: 403,
      message: 'Forbidden',
    })
    const listResponse = await collectionRoute.GET(
      new Request('http://localhost'),
      { params: { workspaceId: 'ws-a' } },
    )
    const detailResponse = await itemRoute.GET(
      new Request('http://localhost'),
      { params: { workspaceId: 'ws-a', estimateId: 'foreign-estimate' } },
    )
    expect(listResponse.status).toBe(403)
    expect(detailResponse.status).toBe(403)
    expect(mocks.listEstimates).not.toHaveBeenCalled()
    expect(mocks.getEstimate).not.toHaveBeenCalled()
  })
})
