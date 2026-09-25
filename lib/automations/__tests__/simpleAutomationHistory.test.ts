import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  automationRun: { findMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMocks }))

import { listSimpleAutomationExecutionHistory } from '@/lib/automations/simpleAutomationHistory'

describe('Simple Automation execution history', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scopes managed runs to the workspace and returns customer-safe summaries', async () => {
    prismaMocks.automationRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        status: 'FAILED',
        startedAt: new Date('2026-09-24T12:00:00.000Z'),
        finishedAt: new Date('2026-09-24T12:00:01.000Z'),
        durationMs: null,
        events: [
          { status: 'RUNNING', message: 'Delivery started.' },
          { status: 'FAILED', message: 'Recipient is no longer available.' },
        ],
        automation: {
          name: 'Managed recipe',
          simpleAutomationInstallation: {
            definitionKey: 'appointment-reminder',
          },
        },
      },
    ])

    const runs = await listSimpleAutomationExecutionHistory({
      workspaceId: 'workspace-a',
      limit: 500,
    })

    expect(prismaMocks.automationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'workspace-a' }),
        take: 100,
      }),
    )
    expect(runs).toEqual([
      expect.objectContaining({
        id: 'run-1',
        recipeName: 'Appointment Reminder',
        failureReason: 'Recipient is no longer available.',
        action: expect.stringMatching(/assignees|workspace owner/i),
      }),
    ])
    expect(runs[0]).not.toHaveProperty('events')
    expect(runs[0]).not.toHaveProperty('payload')
  })
})
