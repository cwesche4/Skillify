import { Prisma } from '@prisma/client'

import { compileSimpleAutomation } from '@/lib/automations/simpleAutomationCompiler'
import type { SimpleAutomationKey } from '@/lib/automations/simpleAutomationCatalog'
import {
  getSimpleAutomationReadiness,
  type SimpleAutomationReadiness,
  type SimpleAutomationRequirement,
} from '@/lib/automations/simpleAutomationReadiness'

export type SimpleAutomationLifecycleAction = 'activate' | 'pause' | 'resume'

type LifecycleInstallation = {
  id: string
  workspaceId: string
  definitionKey: string
  definitionVersion: number
  config: unknown
  removedAt: Date | null
  automation: {
    id: string
    status: 'INACTIVE' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  }
}

export type SimpleAutomationLifecycleDependencies = {
  findInstallation: (input: {
    workspaceId: string
    definitionKey: string
  }) => Promise<LifecycleInstallation | null>
  getReadiness: (input: {
    workspaceId: string
    definitionKey: string
    definitionVersion: number
    config: unknown
  }) => Promise<SimpleAutomationReadiness>
  updateAutomation: (input: {
    automationId: string
    workspaceId: string
    expectedStatus: LifecycleInstallation['automation']['status']
    status: 'ACTIVE' | 'PAUSED'
    flow?: Prisma.InputJsonValue
  }) => Promise<boolean>
}

const defaultDependencies: SimpleAutomationLifecycleDependencies = {
  async findInstallation(input) {
    const { prisma } = await import('@/lib/db')
    return prisma.simpleAutomationInstallation.findFirst({
      where: {
        workspaceId: input.workspaceId,
        definitionKey: input.definitionKey,
        removedAt: null,
      },
      select: {
        id: true,
        workspaceId: true,
        definitionKey: true,
        definitionVersion: true,
        config: true,
        removedAt: true,
        automation: { select: { id: true, status: true } },
      },
    })
  },
  getReadiness: getSimpleAutomationReadiness,
  async updateAutomation(input) {
    const { prisma } = await import('@/lib/db')
    return prisma.$transaction(async (tx) => {
      const installation = await tx.simpleAutomationInstallation.findFirst({
        where: {
          automationId: input.automationId,
          workspaceId: input.workspaceId,
          removedAt: null,
        },
        select: { id: true, definitionKey: true },
      })
      if (!installation) return false
      const updated = await tx.automation.updateMany({
        where: {
          id: input.automationId,
          workspaceId: input.workspaceId,
          status: input.expectedStatus,
          simpleAutomationInstallation: { isNot: null },
        },
        data: {
          status: input.status,
          flow: input.flow,
        },
      })
      if (
        updated.count === 1 &&
        input.status === 'PAUSED' &&
        installation.definitionKey === 'estimate-follow-up'
      ) {
        const { cancelPendingEstimateFollowUps } =
          await import('@/lib/estimates/followUp')
        await cancelPendingEstimateFollowUps(tx, {
          workspaceId: input.workspaceId,
          installationId: installation.id,
          reason: 'ESTIMATE_FOLLOW_UP_PAUSED',
        })
      }
      return updated.count === 1
    })
  },
}

export type SimpleAutomationLifecycleResult =
  | {
      ok: true
      installationId: string
      automationId: string
      automationStatus: 'ACTIVE' | 'PAUSED'
      readiness: SimpleAutomationReadiness
    }
  | {
      ok: false
      status: 404 | 409
      message: string
      requirements?: SimpleAutomationRequirement[]
    }

export async function transitionSimpleAutomationLifecycle(
  input: {
    workspaceId: string
    definitionKey: string
    action: SimpleAutomationLifecycleAction
  },
  dependencies: SimpleAutomationLifecycleDependencies = defaultDependencies,
): Promise<SimpleAutomationLifecycleResult> {
  const installation = await dependencies.findInstallation(input)
  if (!installation) {
    return {
      ok: false,
      status: 404,
      message: 'Configure this Simple Automation before changing its status.',
    }
  }

  if (input.action === 'pause') {
    if (installation.automation.status !== 'ACTIVE') {
      return {
        ok: false,
        status: 409,
        message: 'Only an active Simple Automation can be paused.',
      }
    }
    const updated = await dependencies.updateAutomation({
      automationId: installation.automation.id,
      workspaceId: input.workspaceId,
      expectedStatus: 'ACTIVE',
      status: 'PAUSED',
    })
    if (!updated) {
      return {
        ok: false,
        status: 409,
        message: 'Automation status changed. Refresh and try again.',
      }
    }
    return {
      ok: true,
      installationId: installation.id,
      automationId: installation.automation.id,
      automationStatus: 'PAUSED',
      readiness: {
        liveSupported: true,
        ready: true,
        nativeLeadEvents: false,
        requirements: [],
        crmProviders: [],
      },
    }
  }

  const expectedStatus = input.action === 'activate' ? 'INACTIVE' : 'PAUSED'
  if (installation.automation.status !== expectedStatus) {
    return {
      ok: false,
      status: 409,
      message:
        input.action === 'activate'
          ? 'Only a configured inactive automation can be activated.'
          : 'Only a paused automation can be resumed.',
    }
  }

  const readiness = await dependencies.getReadiness({
    workspaceId: input.workspaceId,
    definitionKey: installation.definitionKey,
    definitionVersion: installation.definitionVersion,
    config: installation.config,
  })
  if (!readiness.ready) {
    return {
      ok: false,
      status: 409,
      message:
        readiness.requirements[0]?.message ??
        'This Simple Automation is not ready to activate.',
      requirements: readiness.requirements,
    }
  }

  let flow
  try {
    flow = compileSimpleAutomation({
      definitionKey: installation.definitionKey as SimpleAutomationKey,
      definitionVersion: installation.definitionVersion,
      config: installation.config,
      workspaceContext: {
        crmProviders: readiness.crmProviders,
        nativeLeadEvents: readiness.nativeLeadEvents,
      },
    })
  } catch (error) {
    return {
      ok: false,
      status: 409,
      message:
        error instanceof Error
          ? error.message
          : 'The managed workflow could not be compiled.',
    }
  }

  if (!flow.nodes.length) {
    return {
      ok: false,
      status: 409,
      message: 'The managed workflow compiler produced an empty flow.',
    }
  }

  const updated = await dependencies.updateAutomation({
    automationId: installation.automation.id,
    workspaceId: input.workspaceId,
    expectedStatus,
    status: 'ACTIVE',
    flow: flow as unknown as Prisma.InputJsonValue,
  })
  if (!updated) {
    return {
      ok: false,
      status: 409,
      message: 'Automation status changed. Refresh and try again.',
    }
  }

  return {
    ok: true,
    installationId: installation.id,
    automationId: installation.automation.id,
    automationStatus: 'ACTIVE',
    readiness,
  }
}
