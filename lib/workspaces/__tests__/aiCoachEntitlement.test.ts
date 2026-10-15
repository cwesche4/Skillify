import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorizeWorkspaceAccess: vi.fn(),
  getWorkspacePlan: vi.fn(),
  assertAiActionsEnabled: vi.fn(),
  emitAiMetric: vi.fn(),
  workspaceFindUnique: vi.fn(),
  automationCount: vi.fn(),
  automationFindMany: vi.fn(),
  automationRunFindMany: vi.fn(),
  getLiveCoachSnapshot: vi.fn(),
}))

vi.mock('@/lib/automations/authorization', () => ({
  authorizeWorkspaceAccess: mocks.authorizeWorkspaceAccess,
}))
vi.mock('@/lib/subscriptions/getWorkspacePlan', () => ({
  getWorkspacePlan: mocks.getWorkspacePlan,
}))
vi.mock('@/lib/builder/ai/server/assertAiActionsEnabled', () => ({
  assertAiActionsEnabled: mocks.assertAiActionsEnabled,
}))
vi.mock('@/lib/observability/aiMetrics', () => ({
  buildAiMetric: vi.fn((input) => input),
  emitAiMetric: mocks.emitAiMetric,
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    workspace: { findUnique: mocks.workspaceFindUnique },
    automation: {
      count: mocks.automationCount,
      findMany: mocks.automationFindMany,
    },
    automationRun: { findMany: mocks.automationRunFindMany },
  },
}))
vi.mock('@/lib/analytics/liveCoach', () => ({
  getLiveCoachSnapshot: mocks.getLiveCoachSnapshot,
}))

import { POST as commandCenterAi } from '@/app/api/command-center/ai/route'
import { GET as getFlow } from '@/app/api/ai-coach/flow/route'
import { GET as getAnomalies } from '@/app/api/ai-coach/anomalies/route'
import { GET as getCost } from '@/app/api/ai-coach/cost/route'
import { GET as getLive } from '@/app/api/workspaces/[workspaceId]/coach/live/route'
import { GET as getLiveStream } from '@/app/api/workspaces/[workspaceId]/coach/live/stream/route'

describe('AI Coach API entitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authorizeWorkspaceAccess.mockResolvedValue({
      allowed: true,
      workspaceId: 'workspace-a',
      userId: 'clerk-actor',
      userProfileId: 'profile-actor',
      workspaceMemberId: 'member-actor',
      role: 'OWNER',
    })
  })

  it.each(['Free', 'Basic'])('denies %s before AI execution', async (plan) => {
    mocks.getWorkspacePlan.mockResolvedValue(plan)

    const response = await commandCenterAi(
      new Request('http://localhost/api/command-center/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'workspace-a',
          question: 'What should I improve?',
        }),
      }) as never,
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'AI Coach requires a Pro or Elite workspace plan.',
    })
    expect(mocks.assertAiActionsEnabled).not.toHaveBeenCalled()
    expect(mocks.workspaceFindUnique).not.toHaveBeenCalled()
  })

  it.each(['Pro', 'Elite'])(
    'allows %s to reach the workspace AI guard',
    async (plan) => {
      mocks.getWorkspacePlan.mockResolvedValue(plan)
      const disabled = Response.json({ error: 'disabled' }, { status: 403 })
      mocks.assertAiActionsEnabled.mockResolvedValue(disabled)

      const response = await commandCenterAi(
        new Request('http://localhost/api/command-center/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: 'workspace-a',
            question: 'What should I improve?',
          }),
        }) as never,
      )

      expect(response).toBe(disabled)
      expect(mocks.assertAiActionsEnabled).toHaveBeenCalledWith('workspace-a')
    },
  )

  it.each([
    ['flow', getFlow],
    ['anomalies', getAnomalies],
    ['cost', getCost],
  ] as const)(
    'enforces Pro/Elite workspace entitlement on the %s optimization API',
    async (_name, handler) => {
      for (const plan of ['Free', 'Basic'] as const) {
        mocks.getWorkspacePlan.mockResolvedValueOnce(plan)
        const response = await handler(
          new Request(
            'http://localhost/api/ai-coach/test?workspaceId=workspace-a',
          ),
        )
        expect(response.status).toBe(403)
      }
      expect(mocks.assertAiActionsEnabled).not.toHaveBeenCalled()

      mocks.getWorkspacePlan.mockResolvedValue('Pro')
      const disabled = Response.json({ error: 'disabled' }, { status: 403 })
      mocks.assertAiActionsEnabled.mockResolvedValue(disabled)
      const response = await handler(
        new Request(
          'http://localhost/api/ai-coach/test?workspaceId=workspace-a',
        ),
      )
      expect(response).toBe(disabled)
    },
  )

  it('requires Elite workspace entitlement for the live coach API', async () => {
    mocks.getWorkspacePlan.mockResolvedValue('Pro')
    const denied = await getLive(new Request('http://localhost') as never, {
      params: { workspaceId: 'workspace-a' },
    })
    expect(denied.status).toBe(403)
    expect(mocks.assertAiActionsEnabled).not.toHaveBeenCalled()
    expect(mocks.getLiveCoachSnapshot).not.toHaveBeenCalled()

    mocks.getWorkspacePlan.mockResolvedValue('Elite')
    const disabled = Response.json({ error: 'disabled' }, { status: 403 })
    mocks.assertAiActionsEnabled.mockResolvedValue(disabled)
    const allowed = await getLive(new Request('http://localhost') as never, {
      params: { workspaceId: 'workspace-a' },
    })
    expect(allowed).toBe(disabled)
  })

  it('requires Elite before creating the live coach stream', async () => {
    mocks.getWorkspacePlan.mockResolvedValue('Pro')
    const response = await getLiveStream(
      new Request('http://localhost') as never,
      { params: { workspaceId: 'workspace-a' } },
    )
    expect(response.status).toBe(403)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(mocks.assertAiActionsEnabled).not.toHaveBeenCalled()
    expect(mocks.getLiveCoachSnapshot).not.toHaveBeenCalled()
  })
})
