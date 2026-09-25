import { beforeEach, describe, expect, it, vi } from 'vitest'

const authorizeAutomationAccessMock = vi.hoisted(() => vi.fn())
const runAutomationMock = vi.hoisted(() => vi.fn())
const executeAutomationLiveMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/automations/authorization', () => ({
  authorizeAutomationAccess: authorizeAutomationAccessMock,
}))
vi.mock('@/lib/automations/executor', () => ({
  runAutomation: runAutomationMock,
  executeAutomationLive: executeAutomationLiveMock,
}))
vi.mock('@/lib/db', () => ({ prisma: {} }))

import { POST as runAutomationRoute } from '@/app/api/automations/[automationId]/run/route'
import { GET as runAutomationLiveRoute } from '@/app/api/automations/[automationId]/run/live/route'

describe('managed Simple Automation route ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authorizeAutomationAccessMock.mockResolvedValue({
      allowed: true,
      userId: 'clerk-owner',
      userProfileId: 'owner-1',
      role: 'OWNER',
      automation: {
        id: 'automation-1',
        workspaceId: 'workspace-1',
        managedBySimple: true,
      },
    })
  })

  it('blocks the generic run API before executing a managed workflow', async () => {
    const response = await runAutomationRoute(
      new Request('https://skillify.test/api/automations/automation-1/run', {
        method: 'POST',
        body: '{}',
      }),
      { params: { automationId: 'automation-1' } },
    )

    expect(response.status).toBe(409)
    expect(runAutomationMock).not.toHaveBeenCalled()
  })

  it('blocks the Advanced live-run API before creating run history', async () => {
    const response = await runAutomationLiveRoute(
      new Request(
        'https://skillify.test/api/automations/automation-1/run/live',
      ),
      { params: { automationId: 'automation-1' } },
    )

    expect(response.status).toBe(409)
    expect(executeAutomationLiveMock).not.toHaveBeenCalled()
  })
})
