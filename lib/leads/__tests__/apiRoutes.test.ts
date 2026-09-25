import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  listLeads: vi.fn(),
  getLead: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  archiveLead: vi.fn(),
  convertLeadToCustomer: vi.fn(),
}))

vi.mock('@/lib/leads/api', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/leads/api')>('@/lib/leads/api')
  return { ...actual, authorizeLeadRequest: mocks.authorize }
})

vi.mock('@/lib/leads/defaultService', () => ({
  leadService: {
    listLeads: mocks.listLeads,
    getLead: mocks.getLead,
    createLead: mocks.createLead,
    updateLead: mocks.updateLead,
    archiveLead: mocks.archiveLead,
    convertLeadToCustomer: mocks.convertLeadToCustomer,
  },
}))

import * as collection from '@/app/api/workspaces/[workspaceId]/leads/route'
import * as item from '@/app/api/workspaces/[workspaceId]/leads/[leadId]/route'
import * as conversion from '@/app/api/workspaces/[workspaceId]/leads/[leadId]/convert/route'

const allowed = {
  allowed: true as const,
  userId: 'clerk-a',
  userProfileId: 'profile-a',
  role: 'MANAGER',
  workspaceId: 'ws-a',
  workspaceMemberId: 'member-a',
}

describe('Lead API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authorize.mockResolvedValue(allowed)
  })

  it('passes search and stage filters through the workspace-scoped list', async () => {
    mocks.listLeads.mockResolvedValue([])
    const response = await collection.GET(
      new Request(
        'http://localhost/api/workspaces/ws-a/leads?search=smith&stage=FOLLOW_UP',
      ),
      { params: { workspaceId: 'ws-a' } },
    )
    expect(response.status).toBe(200)
    expect(mocks.listLeads).toHaveBeenCalledWith('ws-a', {
      search: 'smith',
      stage: 'FOLLOW_UP',
    })
  })

  it('uses server authorization identity for create, update, and archive', async () => {
    mocks.createLead.mockResolvedValue({ id: 'lead-a' })
    mocks.updateLead.mockResolvedValue({ id: 'lead-a', stage: 'WON' })
    mocks.archiveLead.mockResolvedValue({
      id: 'lead-a',
      archivedAt: new Date(),
    })

    await collection.POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ displayName: 'Smith Home' }),
      }),
      { params: { workspaceId: 'ws-a' } },
    )
    await item.PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ stage: 'WON' }),
      }),
      { params: { workspaceId: 'ws-a', leadId: 'lead-a' } },
    )
    await item.DELETE(new Request('http://localhost', { method: 'DELETE' }), {
      params: { workspaceId: 'ws-a', leadId: 'lead-a' },
    })

    expect(mocks.createLead).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-a' },
      { displayName: 'Smith Home' },
    )
    expect(mocks.updateLead).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-a' },
      'lead-a',
      { stage: 'WON' },
    )
    expect(mocks.archiveLead).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-a' },
      'lead-a',
    )
  })

  it('denies Members before invoking the durable Lead service', async () => {
    mocks.authorize.mockResolvedValue({
      allowed: false,
      status: 403,
      message: 'Forbidden',
    })
    const response = await collection.GET(new Request('http://localhost'), {
      params: { workspaceId: 'ws-a' },
    })
    expect(response.status).toBe(403)
    expect(mocks.listLeads).not.toHaveBeenCalled()
  })

  it('fails closed for a foreign Lead id', async () => {
    mocks.getLead.mockResolvedValue(null)
    const response = await item.GET(new Request('http://localhost'), {
      params: { workspaceId: 'ws-a', leadId: 'lead-foreign' },
    })
    expect(response.status).toBe(404)
  })

  it('uses server identity and only accepts duplicate-confirmation intent for conversion', async () => {
    mocks.convertLeadToCustomer.mockResolvedValue({
      status: 'SUCCESS',
      lead: { id: 'lead-a', stage: 'WON' },
      customer: { id: 'customer-a' },
    })
    const response = await conversion.POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ confirmDuplicate: true }),
      }),
      { params: { workspaceId: 'ws-a', leadId: 'lead-a' } },
    )
    expect(response.status).toBe(200)
    expect(mocks.convertLeadToCustomer).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-a' },
      'lead-a',
      { confirmDuplicate: true },
    )
  })

  it('denies Members and foreign Leads without converting', async () => {
    mocks.authorize.mockResolvedValueOnce({
      allowed: false,
      status: 403,
      message: 'Forbidden',
    })
    const denied = await conversion.POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ confirmDuplicate: false }),
      }),
      { params: { workspaceId: 'ws-a', leadId: 'lead-a' } },
    )
    expect(denied.status).toBe(403)
    expect(mocks.convertLeadToCustomer).not.toHaveBeenCalled()

    mocks.authorize.mockResolvedValue(allowed)
    const { LeadServiceError } = await import('@/lib/leads/service')
    mocks.convertLeadToCustomer.mockRejectedValue(
      new LeadServiceError('Lead not found.', 404, 'NOT_FOUND'),
    )
    const foreign = await conversion.POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: { workspaceId: 'ws-a', leadId: 'lead-foreign' } },
    )
    expect(foreign.status).toBe(404)
  })
})
