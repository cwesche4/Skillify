import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    redirect: (url: string) =>
      new Response(null, { status: 307, headers: { Location: url } }),
  },
}))

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  workspaceFindUnique: vi.fn(),
  integrationUpsert: vi.fn(),
  getWorkspacePlan: vi.fn(),
  logAudit: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({
  prisma: {
    workspace: { findUnique: mocks.workspaceFindUnique },
    integration: { upsert: mocks.integrationUpsert },
  },
}))
vi.mock('@/lib/subscriptions/getWorkspacePlan', () => ({
  getWorkspacePlan: mocks.getWorkspacePlan,
}))
vi.mock('@/lib/integrations/hubspot/auth', () => ({
  buildHubSpotAuthUrl: ({ workspaceId }: { workspaceId: string }) =>
    `https://hubspot.example.test/oauth?workspaceId=${workspaceId}`,
}))
vi.mock('@/lib/audit/log', () => ({ logAudit: mocks.logAudit }))

import { GET } from '@/app/api/integrations/hubspot/connect/route'

function request(workspaceId = 'workspace-1') {
  return new Request(
    `http://localhost/api/integrations/hubspot/connect?workspaceId=${workspaceId}`,
  )
}

function workspace(role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  return {
    id: 'workspace-1',
    ownerId: 'owner-user',
    members: [{ userId: 'actor-user', role }],
  }
}

describe('direct HubSpot Workspace authority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-user' })
    mocks.workspaceFindUnique.mockResolvedValue(workspace('OWNER'))
    mocks.getWorkspacePlan.mockResolvedValue('Pro')
    mocks.integrationUpsert.mockResolvedValue({ id: 'integration-1' })
    mocks.logAudit.mockResolvedValue(undefined)
  })

  it('rejects non-members before resolving plan authority', async () => {
    mocks.workspaceFindUnique.mockResolvedValue(null)

    const response = await GET(request('foreign-workspace'))

    expect(response.status).toBe(403)
    expect(mocks.getWorkspacePlan).not.toHaveBeenCalled()
    expect(mocks.integrationUpsert).not.toHaveBeenCalled()
  })

  it('rejects regular members from managing a connection', async () => {
    mocks.workspaceFindUnique.mockResolvedValue(workspace('MEMBER'))

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(mocks.getWorkspacePlan).not.toHaveBeenCalled()
    expect(mocks.integrationUpsert).not.toHaveBeenCalled()
  })

  it('checks the exact Workspace plan and rejects expired/free authority', async () => {
    mocks.workspaceFindUnique.mockResolvedValue(workspace('ADMIN'))
    mocks.getWorkspacePlan.mockResolvedValue('Free')

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(mocks.getWorkspacePlan).toHaveBeenCalledWith('workspace-1')
    expect(mocks.integrationUpsert).not.toHaveBeenCalled()
  })

  it.each(['OWNER', 'ADMIN'] as const)(
    'allows a %s with an authoritative Pro Workspace plan',
    async (role) => {
      mocks.workspaceFindUnique.mockResolvedValue(workspace(role))

      const response = await GET(request())

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain(
        'workspaceId=workspace-1',
      )
      expect(mocks.getWorkspacePlan).toHaveBeenCalledWith('workspace-1')
      expect(mocks.integrationUpsert).toHaveBeenCalledOnce()
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          actorId: 'actor-user',
        }),
      )
    },
  )
})
