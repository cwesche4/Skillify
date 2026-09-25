import { Prisma } from '@prisma/client'

import { getWorkspaceAutomationCapabilities } from '@/lib/automations/capabilities'
import {
  getSimpleAutomationDefinition,
  type SimpleAutomationKey,
} from '@/lib/automations/simpleAutomationCatalog'
import {
  parseSimpleAutomationConfig,
  type SimpleAutomationConfig,
} from '@/lib/automations/simpleAutomationConfig'
import type { WorkspaceBusinessModel } from '@/lib/prisma/enums'

export type SimpleAutomationInstallationView = {
  id: string
  definitionKey: SimpleAutomationKey
  definitionVersion: number
  automationId: string
  config: SimpleAutomationConfig
  createdAt: Date
  updatedAt: Date
  automationStatus: string
}

type PersistInstallationInput = {
  workspaceId: string
  userProfileId: string
  definitionKey: SimpleAutomationKey
  definitionVersion: number
  automationName: string
  automationDescription: string
  automationStatus: 'INACTIVE'
  automationFlow: null
  config: SimpleAutomationConfig
}

type RemoveInstallationInput = {
  workspaceId: string
  definitionKey: SimpleAutomationKey
}

export type SimpleAutomationInstallationDependencies = {
  findWorkspace: (workspaceId: string) => Promise<{
    businessModel: WorkspaceBusinessModel
  } | null>
  getCapabilities: (workspaceId: string) => Promise<{
    canUseStarterAutomations: boolean
  }>
  persistInstallation: (
    input: PersistInstallationInput,
  ) => Promise<SimpleAutomationInstallationView>
  removeInstallation: (input: RemoveInstallationInput) => Promise<boolean>
}

export type SimpleAutomationInstallationError = {
  ok: false
  status: 400 | 403 | 404 | 409
  message: string
  issues?: Array<{ path: PropertyKey[]; message: string }>
}

export type ConfigureSimpleAutomationInstallationResult =
  | { ok: true; installation: SimpleAutomationInstallationView }
  | SimpleAutomationInstallationError

export type RemoveSimpleAutomationInstallationResult =
  | { ok: true; removed: true }
  | SimpleAutomationInstallationError

const installationSelect = {
  id: true,
  definitionKey: true,
  definitionVersion: true,
  automationId: true,
  config: true,
  createdAt: true,
  updatedAt: true,
  automation: { select: { status: true } },
} satisfies Prisma.SimpleAutomationInstallationSelect

export function getSimpleAutomationStatusAfterConfigurationSave(
  status: 'INACTIVE' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
): 'INACTIVE' | 'PAUSED' {
  return status === 'ACTIVE' || status === 'PAUSED' ? 'PAUSED' : 'INACTIVE'
}

function toInstallationView(
  installation: Prisma.SimpleAutomationInstallationGetPayload<{
    select: typeof installationSelect
  }>,
): SimpleAutomationInstallationView {
  return {
    id: installation.id,
    definitionKey: installation.definitionKey as SimpleAutomationKey,
    definitionVersion: installation.definitionVersion,
    automationId: installation.automationId,
    config: installation.config as SimpleAutomationConfig,
    createdAt: installation.createdAt,
    updatedAt: installation.updatedAt,
    automationStatus: installation.automation.status,
  }
}

async function persistInstallation(
  input: PersistInstallationInput,
): Promise<SimpleAutomationInstallationView> {
  const { prisma } = await import('@/lib/db')
  const config = input.config as Prisma.InputJsonValue

  try {
    const installation = await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleAutomationInstallation.findUnique({
        where: {
          workspaceId_definitionKey: {
            workspaceId: input.workspaceId,
            definitionKey: input.definitionKey,
          },
        },
        select: {
          id: true,
          automationId: true,
          automation: { select: { status: true } },
        },
      })

      if (existing) {
        await tx.automation.update({
          where: { id: existing.automationId },
          data: {
            status: getSimpleAutomationStatusAfterConfigurationSave(
              existing.automation.status,
            ),
            flow: Prisma.DbNull,
          },
        })
        return tx.simpleAutomationInstallation.update({
          where: { id: existing.id },
          data: {
            config,
            definitionVersion: input.definitionVersion,
            lastConfiguredByUserId: input.userProfileId,
            removedAt: null,
          },
          select: installationSelect,
        })
      }

      const automation = await tx.automation.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userProfileId,
          name: input.automationName,
          description: input.automationDescription,
          status: input.automationStatus,
          flow: Prisma.DbNull,
        },
        select: { id: true },
      })

      return tx.simpleAutomationInstallation.create({
        data: {
          workspaceId: input.workspaceId,
          definitionKey: input.definitionKey,
          definitionVersion: input.definitionVersion,
          automationId: automation.id,
          config,
          createdByUserId: input.userProfileId,
          lastConfiguredByUserId: input.userProfileId,
        },
        select: installationSelect,
      })
    })

    return toInstallationView(installation)
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error
    }

    // A concurrent first save may win the unique workspace/definition race.
    // Its losing transaction rolls back the extra Automation, then updates the winner.
    const installation = await prisma.$transaction(async (tx) => {
      const winner = await tx.simpleAutomationInstallation.findUniqueOrThrow({
        where: {
          workspaceId_definitionKey: {
            workspaceId: input.workspaceId,
            definitionKey: input.definitionKey,
          },
        },
        select: {
          id: true,
          automationId: true,
          automation: { select: { status: true } },
        },
      })
      await tx.automation.update({
        where: { id: winner.automationId },
        data: {
          status: getSimpleAutomationStatusAfterConfigurationSave(
            winner.automation.status,
          ),
          flow: Prisma.DbNull,
        },
      })
      return tx.simpleAutomationInstallation.update({
        where: { id: winner.id },
        data: {
          config,
          definitionVersion: input.definitionVersion,
          lastConfiguredByUserId: input.userProfileId,
          removedAt: null,
        },
        select: installationSelect,
      })
    })
    return toInstallationView(installation)
  }
}

async function removeInstallation(input: RemoveInstallationInput) {
  const { prisma } = await import('@/lib/db')

  return prisma.$transaction(async (tx) => {
    const installation = await tx.simpleAutomationInstallation.findUnique({
      where: {
        workspaceId_definitionKey: {
          workspaceId: input.workspaceId,
          definitionKey: input.definitionKey,
        },
      },
      select: {
        id: true,
        automationId: true,
        automation: { select: { status: true } },
      },
    })
    if (!installation) return false

    // Stop future matching before deciding whether history requires archival.
    await tx.automation.update({
      where: { id: installation.automationId },
      data: { status: 'ARCHIVED', flow: Prisma.DbNull },
    })
    const runCount = await tx.automationRun.count({
      where: {
        automationId: installation.automationId,
        workspaceId: input.workspaceId,
      },
    })

    if (runCount > 0) {
      await tx.simpleAutomationInstallation.update({
        where: { id: installation.id },
        data: { removedAt: new Date() },
      })
      return true
    }

    await tx.simpleAutomationInstallation.delete({
      where: { id: installation.id },
    })
    const deletedAutomation = await tx.automation.deleteMany({
      where: {
        id: installation.automationId,
        workspaceId: input.workspaceId,
        status: 'ARCHIVED',
      },
    })
    if (deletedAutomation.count !== 1) {
      throw new Error('Managed Automation could not be removed safely.')
    }
    return true
  })
}

const defaultDependencies: SimpleAutomationInstallationDependencies = {
  async findWorkspace(workspaceId) {
    const { prisma } = await import('@/lib/db')
    return prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { businessModel: true },
    })
  },
  getCapabilities: getWorkspaceAutomationCapabilities,
  persistInstallation,
  removeInstallation,
}

async function validateRecipeEligibility(
  input: { workspaceId: string; definitionKey: string },
  dependencies: SimpleAutomationInstallationDependencies,
): Promise<
  | {
      ok: true
      definition: NonNullable<ReturnType<typeof getSimpleAutomationDefinition>>
    }
  | SimpleAutomationInstallationError
> {
  const definition = getSimpleAutomationDefinition(input.definitionKey)
  if (!definition) {
    return { ok: false, status: 404, message: 'Simple Automation not found.' }
  }

  const [workspace, capabilities] = await Promise.all([
    dependencies.findWorkspace(input.workspaceId),
    dependencies.getCapabilities(input.workspaceId),
  ])
  if (!workspace) {
    return { ok: false, status: 404, message: 'Workspace not found.' }
  }
  if (!capabilities.canUseStarterAutomations) {
    return {
      ok: false,
      status: 403,
      message: 'Simple Automations are not available on this workspace plan.',
    }
  }
  if (!definition.supportedWorkspaceModels.includes(workspace.businessModel)) {
    return {
      ok: false,
      status: 409,
      message: 'This automation is not supported for this workspace model.',
    }
  }
  if (definition.availability.state !== 'available') {
    return {
      ok: false,
      status: 409,
      message: `${definition.title} is coming soon and cannot be configured yet.`,
    }
  }

  return { ok: true, definition }
}

export async function configureSimpleAutomationInstallation(
  input: {
    workspaceId: string
    userProfileId: string
    definitionKey: string
    config: unknown
  },
  dependencies: SimpleAutomationInstallationDependencies = defaultDependencies,
): Promise<ConfigureSimpleAutomationInstallationResult> {
  const eligibility = await validateRecipeEligibility(input, dependencies)
  if (!eligibility.ok) return eligibility

  const parsed = parseSimpleAutomationConfig(
    eligibility.definition.key,
    input.config,
  )
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: 'Configuration is invalid.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    }
  }

  const installation = await dependencies.persistInstallation({
    workspaceId: input.workspaceId,
    userProfileId: input.userProfileId,
    definitionKey: eligibility.definition.key,
    definitionVersion: eligibility.definition.definitionVersion,
    automationName: eligibility.definition.title,
    automationDescription: `Managed by Simple Automations: ${eligibility.definition.description}`,
    automationStatus: 'INACTIVE',
    automationFlow: null,
    config: parsed.data as SimpleAutomationConfig,
  })

  return { ok: true, installation }
}

export async function removeSimpleAutomationInstallation(
  input: { workspaceId: string; definitionKey: string },
  dependencies: SimpleAutomationInstallationDependencies = defaultDependencies,
): Promise<RemoveSimpleAutomationInstallationResult> {
  const definition = getSimpleAutomationDefinition(input.definitionKey)
  if (!definition) {
    return { ok: false, status: 404, message: 'Simple Automation not found.' }
  }

  const removed = await dependencies.removeInstallation({
    workspaceId: input.workspaceId,
    definitionKey: definition.key,
  })
  if (!removed) {
    return {
      ok: false,
      status: 404,
      message: 'Simple Automation setup was not found.',
    }
  }
  return { ok: true, removed: true }
}
