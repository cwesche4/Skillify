import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dispatchCreate: vi.fn(),
  dispatchFind: vi.fn(),
  dispatchUpdateMany: vi.fn(),
  runFind: vi.fn(),
  runAutomation: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    simpleAutomationDispatch: {
      create: mocks.dispatchCreate,
      findUnique: mocks.dispatchFind,
      updateMany: mocks.dispatchUpdateMany,
    },
    automationRun: { findUnique: mocks.runFind },
  },
}))
vi.mock('@/lib/automations/executor', () => ({
  runAutomation: mocks.runAutomation,
}))

import { dispatchSimpleAutomationEvent } from '@/lib/automations/simpleAutomationDispatch'

const input = {
  installationId: 'installation-a',
  automationId: 'automation-a',
  workspaceId: 'workspace-a',
  eventKey: 'native:domain-event:event-a',
  triggerPayload: {
    source: 'skillify-native',
    simpleEventKey: 'native:domain-event:event-a',
  },
}

describe('persisted Simple Automation dispatch reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dispatchUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('reconciles a successful bound run without executing a second run', async () => {
    mocks.dispatchCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate dispatch', {
        code: 'P2002',
        clientVersion: '7.1.0',
      }),
    )
    mocks.dispatchFind.mockResolvedValue({
      id: 'dispatch-a',
      status: 'PROCESSING',
      runId: 'run-a',
    })
    mocks.runFind.mockResolvedValue({ status: 'SUCCESS' })

    await expect(dispatchSimpleAutomationEvent(input)).resolves.toEqual({
      dispatched: false,
      duplicate: true,
    })
    expect(mocks.runAutomation).not.toHaveBeenCalled()
    expect(mocks.dispatchUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'dispatch-a',
          runId: 'run-a',
        }),
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    )
  })

  it('binds the run before execution and conditionally finalizes it', async () => {
    mocks.dispatchCreate.mockResolvedValue({ id: 'dispatch-a' })
    mocks.runAutomation.mockImplementation(async (_automationId, options) => {
      await options.onRunCreated('run-a')
      return 'run-a'
    })

    await expect(dispatchSimpleAutomationEvent(input)).resolves.toEqual({
      dispatched: true,
      duplicate: false,
      runId: 'run-a',
    })
    expect(mocks.dispatchUpdateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PROCESSING',
          runId: null,
        }),
        data: { runId: 'run-a' },
      }),
    )
    expect(mocks.dispatchUpdateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PROCESSING',
          runId: 'run-a',
        }),
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    )
  })
})
