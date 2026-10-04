import { Prisma } from '@prisma/client'

type ClaimResult = 'claimed' | 'duplicate'

export type SimpleAutomationDispatchDependencies = {
  claim: (input: {
    workspaceId: string
    installationId: string
    eventKey: string
  }) => Promise<ClaimResult>
  run: (input: {
    automationId: string
    workspaceId: string
    installationId: string
    eventKey: string
    triggerPayload: Record<string, unknown>
    onRunCreated: (runId: string) => void
  }) => Promise<string>
  succeed: (input: {
    installationId: string
    eventKey: string
    runId: string
  }) => Promise<void>
  fail: (input: {
    installationId: string
    eventKey: string
    runId: string | null
    error: string
  }) => Promise<void>
  cancel: (input: {
    installationId: string
    eventKey: string
    runId: string | null
    reason: string
  }) => Promise<void>
}

const defaultDependencies: SimpleAutomationDispatchDependencies = {
  async claim(input) {
    const { prisma } = await import('@/lib/db')
    try {
      await prisma.simpleAutomationDispatch.create({
        data: {
          workspaceId: input.workspaceId,
          installationId: input.installationId,
          eventKey: input.eventKey,
          status: 'PROCESSING',
        },
      })
      return 'claimed'
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error
      }

      const existing = await prisma.simpleAutomationDispatch.findUnique({
        where: {
          installationId_eventKey: {
            installationId: input.installationId,
            eventKey: input.eventKey,
          },
        },
        select: { id: true, status: true, runId: true },
      })
      if (!existing) throw error
      if (existing.status === 'SUCCEEDED' || existing.status === 'CANCELLED') {
        return 'duplicate'
      }

      // The executor may have committed a successful run before the dispatch
      // ledger's final SUCCEEDED write. Reconcile that durable success before
      // considering a retry so one logical event cannot gain another success.
      if (existing.runId) {
        const priorRun = await prisma.automationRun.findUnique({
          where: { id: existing.runId },
          select: { status: true },
        })
        if (priorRun?.status === 'SUCCESS') {
          await prisma.simpleAutomationDispatch.updateMany({
            where: {
              id: existing.id,
              status: { in: ['PROCESSING', 'FAILED'] },
              runId: existing.runId,
            },
            data: {
              status: 'SUCCEEDED',
              completedAt: new Date(),
              lastError: null,
            },
          })
          return 'duplicate'
        }
        if (priorRun?.status === 'RUNNING') {
          const { reconcileQueuedEstimateFollowUpRun } =
            await import('@/lib/estimates/followUp')
          const reconciled = await reconcileQueuedEstimateFollowUpRun({
            workspaceId: input.workspaceId,
            installationId: input.installationId,
            eventKey: input.eventKey,
            dispatchId: existing.id,
            runId: existing.runId,
          })
          if (reconciled) return 'duplicate'
        }
      }

      const staleBefore = new Date(Date.now() - 5 * 60_000)
      const reclaimed = await prisma.simpleAutomationDispatch.updateMany({
        where: {
          installationId: input.installationId,
          eventKey: input.eventKey,
          OR: [
            { status: 'FAILED' },
            { status: 'PROCESSING', updatedAt: { lte: staleBefore } },
          ],
        },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
          runId: null,
          lastError: null,
          completedAt: null,
        },
      })
      return reclaimed.count === 1 ? 'claimed' : 'duplicate'
    }
  },
  async run(input) {
    const { runAutomation } = await import('@/lib/automations/executor')
    return runAutomation(input.automationId, {
      expectedWorkspaceId: input.workspaceId,
      triggerPayload: input.triggerPayload,
      userProfileId: null,
      onRunCreated: async (runId) => {
        const { prisma } = await import('@/lib/db')
        const bound = await prisma.simpleAutomationDispatch.updateMany({
          where: {
            installationId: input.installationId,
            eventKey: input.eventKey,
            status: 'PROCESSING',
            runId: null,
          },
          data: { runId },
        })
        if (bound.count !== 1) {
          throw new Error('Simple Automation dispatch lease was lost.')
        }
        input.onRunCreated(runId)
      },
    })
  },
  async succeed(input) {
    const { prisma } = await import('@/lib/db')
    const succeeded = await prisma.simpleAutomationDispatch.updateMany({
      where: {
        installationId: input.installationId,
        eventKey: input.eventKey,
        status: 'PROCESSING',
        runId: input.runId,
      },
      data: {
        status: 'SUCCEEDED',
        runId: input.runId,
        completedAt: new Date(),
        lastError: null,
      },
    })
    if (succeeded.count !== 1) {
      const existing = await prisma.simpleAutomationDispatch.findUnique({
        where: {
          installationId_eventKey: {
            installationId: input.installationId,
            eventKey: input.eventKey,
          },
        },
        select: { status: true, runId: true },
      })
      if (existing?.status === 'SUCCEEDED' && existing.runId === input.runId) {
        return
      }
      throw new Error('Simple Automation dispatch lease was lost.')
    }
  },
  async fail(input) {
    const { prisma } = await import('@/lib/db')
    await prisma.simpleAutomationDispatch.updateMany({
      where: {
        installationId: input.installationId,
        eventKey: input.eventKey,
        status: 'PROCESSING',
        ...(input.runId ? { runId: input.runId } : {}),
      },
      data: {
        status: 'FAILED',
        lastError: input.error.slice(0, 500),
        completedAt: new Date(),
      },
    })
  },
  async cancel(input) {
    const { prisma } = await import('@/lib/db')
    await prisma.simpleAutomationDispatch.updateMany({
      where: {
        installationId: input.installationId,
        eventKey: input.eventKey,
        status: 'PROCESSING',
        ...(input.runId ? { runId: input.runId } : {}),
      },
      data: {
        status: 'CANCELLED',
        lastError: input.reason.slice(0, 500),
        completedAt: new Date(),
      },
    })
  },
}

const TERMINAL_LIFECYCLE_ERRORS = new Set([
  'Automation is not active',
  'Automation not found',
  'Managed Simple Automation is no longer active.',
  'Managed Simple Automation is no longer eligible.',
  'Managed Simple Automation dispatch is no longer current.',
  'Managed Lead Follow-Up schedule is no longer current.',
  'Lead Follow-Up is missing its schedule identity.',
  'Managed Job completion is no longer current.',
  'Job Completion Message is missing its occurrence identity.',
  'Job Completion Message workspace does not match.',
  'Appointment Reminder is missing its occurrence identity.',
  'Appointment Reminder workspace does not match.',
  'Managed Appointment Reminder is no longer current.',
  'Schedule Change Notification is missing its change identity.',
  'Schedule Change Notification workspace does not match.',
  'Managed Schedule Change Notification is no longer current.',
  'Managed Estimate Follow-Up is no longer current.',
  'Estimate Follow-Up is missing its schedule identity.',
  'Estimate Follow-Up worker claim was lost.',
  'Automation has no flow',
])

export async function dispatchSimpleAutomationEvent(
  input: {
    installationId: string
    automationId: string
    workspaceId: string
    eventKey: string
    triggerPayload: Record<string, unknown>
  },
  dependencies: SimpleAutomationDispatchDependencies = defaultDependencies,
) {
  const claimed = await dependencies.claim(input)
  if (claimed === 'duplicate') {
    return { dispatched: false as const, duplicate: true as const }
  }

  let runId: string | null = null
  try {
    runId = await dependencies.run({
      ...input,
      onRunCreated(createdRunId) {
        runId = createdRunId
      },
    })
    await dependencies.succeed({
      installationId: input.installationId,
      eventKey: input.eventKey,
      runId,
    })
    return { dispatched: true as const, duplicate: false as const, runId }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Automation run failed.'
    if (TERMINAL_LIFECYCLE_ERRORS.has(message)) {
      await dependencies.cancel({
        installationId: input.installationId,
        eventKey: input.eventKey,
        runId,
        reason: message,
      })
    } else {
      await dependencies.fail({
        installationId: input.installationId,
        eventKey: input.eventKey,
        runId,
        error: message,
      })
    }
    throw error
  }
}
