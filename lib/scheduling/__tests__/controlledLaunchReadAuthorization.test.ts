import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSchedulingActor: vi.fn(),
  workspaceFindFirst: vi.fn(),
  workspaceFindUnique: vi.fn(),
  loadSchedulingPageProps: vi.fn(),
  listSchedulingWorkspaceData: vi.fn(),
  getPersistedSchedulingSettings: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/app/api/workspaces/[workspaceId]/scheduling/_lib/auth', () => ({
  getSchedulingActor: mocks.getSchedulingActor,
  isResponse: (value: unknown) => value instanceof Response,
  schedulingErrorResponse: () => Response.json({}, { status: 500 }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    workspace: {
      findFirst: mocks.workspaceFindFirst,
      findUnique: mocks.workspaceFindUnique,
    },
  },
}))
vi.mock('@/lib/scheduling/loadSchedulingPageProps', () => ({
  loadSchedulingPageProps: mocks.loadSchedulingPageProps,
}))
vi.mock('@/lib/scheduling/services/schedulingService', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/scheduling/services/schedulingService')
  >('@/lib/scheduling/services/schedulingService')
  return {
    ...actual,
    listSchedulingWorkspaceData: mocks.listSchedulingWorkspaceData,
    getPersistedSchedulingSettings: mocks.getPersistedSchedulingSettings,
  }
})

import { GET as getEvents } from '@/app/api/workspaces/[workspaceId]/scheduling/events/route'
import { GET as getAvailability } from '@/app/api/workspaces/[workspaceId]/scheduling/availability/route'
import { GET as getSettings } from '@/app/api/workspaces/[workspaceId]/scheduling/settings/route'
import { POST as postSchedulingAI } from '@/app/api/workspaces/[workspaceId]/scheduling/ai/route'

describe('Simple Service controlled-launch Scheduling reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SCHEDULING_AI_ENABLED', 'true')
    vi.stubEnv('OPENAI_API_KEY', 'test-only-provider-key')
    mocks.auth.mockReturnValue({ userId: 'clerk-member' })
    mocks.workspaceFindUnique.mockResolvedValue({
      id: 'workspace-a',
      businessModel: 'SIMPLE_SERVICE_BUSINESS',
      plan: 'ELITE',
      features: {},
    })
    mocks.workspaceFindFirst.mockResolvedValue({
      id: 'workspace-a',
      slug: 'workspace-a',
      name: 'Workspace A',
      businessModel: 'SIMPLE_SERVICE_BUSINESS',
      members: [
        {
          id: 'member-a',
          userId: 'profile-a',
          role: 'MEMBER',
          user: { clerkId: 'clerk-member' },
        },
      ],
    })
  })

  it('denies an ordinary Member before workspace-wide Scheduling data is loaded', async () => {
    mocks.getSchedulingActor.mockResolvedValue({
      workspaceId: 'workspace-a',
      actorUserId: 'profile-a',
      workspaceMemberId: 'member-a',
      canManageScheduling: false,
    })
    const context = { params: { workspaceId: 'workspace-a' } }

    const responses = await Promise.all([
      getEvents(
        new NextRequest(
          'http://localhost/api/workspaces/workspace-a/scheduling/events',
        ),
        context,
      ),
      getAvailability(
        new NextRequest(
          'http://localhost/api/workspaces/workspace-a/scheduling/availability',
        ),
        context,
      ),
      getSettings(
        new NextRequest(
          'http://localhost/api/workspaces/workspace-a/scheduling/settings',
        ),
        context,
      ),
    ])

    expect(responses.map((response) => response.status)).toEqual([
      403, 403, 403,
    ])
    expect(mocks.listSchedulingWorkspaceData).not.toHaveBeenCalled()
    expect(mocks.getPersistedSchedulingSettings).not.toHaveBeenCalled()
  })

  it('preserves management reads and other workspace-model behavior', async () => {
    mocks.getSchedulingActor.mockResolvedValue({
      workspaceId: 'workspace-a',
      actorUserId: 'profile-manager',
      workspaceMemberId: 'member-manager',
      canManageScheduling: true,
    })
    mocks.listSchedulingWorkspaceData.mockResolvedValue({
      settings: {},
      events: [],
      series: [],
      availability: [],
    })
    mocks.getPersistedSchedulingSettings.mockResolvedValue({ timezone: 'UTC' })
    const context = { params: { workspaceId: 'workspace-a' } }

    const responses = await Promise.all([
      getEvents(
        new NextRequest(
          'http://localhost/api/workspaces/workspace-a/scheduling/events',
        ),
        context,
      ),
      getAvailability(
        new NextRequest(
          'http://localhost/api/workspaces/workspace-a/scheduling/availability',
        ),
        context,
      ),
      getSettings(
        new NextRequest(
          'http://localhost/api/workspaces/workspace-a/scheduling/settings',
        ),
        context,
      ),
    ])

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ])
  })

  it('denies the Scheduling AI data-loading bypass for a Simple Service Member', async () => {
    const response = await postSchedulingAI(
      new NextRequest(
        'http://localhost/api/workspaces/workspace-a/scheduling/ai',
        { method: 'POST', body: JSON.stringify({}) },
      ),
      { params: { workspaceId: 'workspace-a' } },
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(mocks.loadSchedulingPageProps).not.toHaveBeenCalled()
    expect(mocks.listSchedulingWorkspaceData).not.toHaveBeenCalled()
  })
})
