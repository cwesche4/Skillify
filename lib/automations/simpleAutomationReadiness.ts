import type { Plan } from '@/lib/subscriptions/features'

import { getWorkspaceAutomationCapabilities } from '@/lib/automations/capabilities'
import {
  getSimpleAutomationDefinition,
  type SimpleAutomationKey,
} from '@/lib/automations/simpleAutomationCatalog'
import { parseSimpleAutomationConfig } from '@/lib/automations/simpleAutomationConfig'
import {
  WorkspaceBusinessModel,
  type WorkspaceBusinessModel as WorkspaceBusinessModelValue,
} from '@/lib/prisma/enums'

export type SimpleAutomationRequirement = {
  code: string
  message: string
  action?: string
}

export type SimpleAutomationReadiness = {
  liveSupported: boolean
  ready: boolean
  nativeLeadEvents: boolean
  requirements: SimpleAutomationRequirement[]
  crmProviders: string[]
}

export type SimpleAutomationReadinessInput = {
  definitionKey: string
  definitionVersion: number
  config: unknown
  businessModel: WorkspaceBusinessModelValue
  plan: Plan
  canUseStarterAutomations: boolean
  connectedCrmProviders: string[]
  crmInboundDisabled?: boolean
}

const nonLiveReasonByKey: Partial<
  Record<SimpleAutomationKey, SimpleAutomationRequirement>
> = {
  'estimate-follow-up': {
    code: 'estimate-foundation-unavailable',
    message: 'Estimate automation support is still being prepared.',
  },
}

export function evaluateSimpleAutomationReadiness(
  input: SimpleAutomationReadinessInput,
): SimpleAutomationReadiness {
  const definition = getSimpleAutomationDefinition(input.definitionKey)
  if (!definition) {
    return {
      liveSupported: false,
      ready: false,
      nativeLeadEvents: false,
      crmProviders: [],
      requirements: [
        {
          code: 'definition-not-found',
          message: 'Simple Automation definition was not found.',
        },
      ],
    }
  }

  const requirements: SimpleAutomationRequirement[] = []
  if (!input.canUseStarterAutomations) {
    requirements.push({
      code: 'starter-automation-capability-required',
      message: 'Simple Automations are unavailable on this workspace plan.',
    })
  }
  if (!definition.supportedWorkspaceModels.includes(input.businessModel)) {
    requirements.push({
      code: 'workspace-model-unsupported',
      message: 'This recipe is not supported for this workspace model.',
    })
  }
  if (definition.availability.state !== 'available') {
    requirements.push(
      nonLiveReasonByKey[definition.key] ?? {
        code: 'recipe-unavailable',
        message: 'This recipe is not available for activation.',
      },
    )
  }
  if (input.definitionVersion !== definition.definitionVersion) {
    requirements.push({
      code: 'definition-version-mismatch',
      message: 'Review and save this configuration before activation.',
    })
  }
  if (!parseSimpleAutomationConfig(definition.key, input.config).success) {
    requirements.push({
      code: 'configuration-invalid',
      message: 'Review and save a valid configuration before activation.',
    })
  }

  if (
    definition.key !== 'new-lead-alert' &&
    definition.key !== 'lead-follow-up' &&
    definition.key !== 'job-completion-message' &&
    definition.key !== 'appointment-reminder' &&
    definition.key !== 'schedule-change-notification'
  ) {
    if (definition.availability.state === 'available') {
      requirements.push(
        nonLiveReasonByKey[definition.key] ?? {
          code: 'production-runtime-unavailable',
          message: 'Production activation is not available for this recipe.',
        },
      )
    }
    return {
      liveSupported: false,
      ready: false,
      nativeLeadEvents: false,
      crmProviders: [],
      requirements,
    }
  }

  if (definition.key === 'lead-follow-up') {
    const config =
      input.config &&
      typeof input.config === 'object' &&
      !Array.isArray(input.config)
        ? (input.config as Record<string, unknown>)
        : {}
    if (config['notification-channel'] !== 'in-app') {
      requirements.push({
        code: 'in-app-channel-required',
        message: 'Choose In-app notification to activate this recipe.',
      })
    }
    if (
      config.recipient !== 'lead-assignee-or-owner' &&
      config.recipient !== 'workspace-owner'
    ) {
      requirements.push({
        code: 'lead-follow-up-recipient-required',
        message: 'Choose who should receive the internal follow-up reminder.',
      })
    }
    return {
      liveSupported: true,
      ready: requirements.length === 0,
      nativeLeadEvents:
        input.businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      requirements,
      crmProviders: [],
    }
  }

  if (definition.key === 'appointment-reminder') {
    const config =
      input.config &&
      typeof input.config === 'object' &&
      !Array.isArray(input.config)
        ? (input.config as Record<string, unknown>)
        : {}
    if (config['notification-channel'] !== 'in-app') {
      requirements.push({
        code: 'in-app-channel-required',
        message: 'Choose In-app notification to activate this recipe.',
      })
    }
    if (config.recipient !== 'appointment-assignees-or-owner') {
      requirements.push({
        code: 'appointment-reminder-recipient-required',
        message: 'Choose assigned team members for appointment reminders.',
      })
    }
    return {
      liveSupported: true,
      ready: requirements.length === 0,
      nativeLeadEvents: false,
      requirements,
      crmProviders: [],
    }
  }

  if (definition.key === 'schedule-change-notification') {
    const config =
      input.config &&
      typeof input.config === 'object' &&
      !Array.isArray(input.config)
        ? (input.config as Record<string, unknown>)
        : {}
    if (config['notification-channel'] !== 'in-app') {
      requirements.push({
        code: 'in-app-channel-required',
        message: 'Choose In-app notification to activate this recipe.',
      })
    }
    if (config.recipient !== 'appointment-assignees-or-owner') {
      requirements.push({
        code: 'schedule-change-recipient-required',
        message: 'Choose current assigned team members for schedule changes.',
      })
    }
    return {
      liveSupported: true,
      ready: requirements.length === 0,
      nativeLeadEvents: false,
      requirements,
      crmProviders: [],
    }
  }

  if (definition.key === 'job-completion-message') {
    const config =
      input.config &&
      typeof input.config === 'object' &&
      !Array.isArray(input.config)
        ? (input.config as Record<string, unknown>)
        : {}
    if (config['notification-channel'] !== 'in-app') {
      requirements.push({
        code: 'in-app-channel-required',
        message: 'Choose In-app notification to activate this recipe.',
      })
    }
    if (
      config.recipient !== 'job-assignee-or-owner' &&
      config.recipient !== 'workspace-owner'
    ) {
      requirements.push({
        code: 'job-completion-recipient-required',
        message: 'Choose who should receive the internal completion notice.',
      })
    }
    return {
      liveSupported: true,
      ready: requirements.length === 0,
      nativeLeadEvents: false,
      requirements,
      crmProviders: [],
    }
  }

  const config =
    input.config &&
    typeof input.config === 'object' &&
    !Array.isArray(input.config)
      ? (input.config as Record<string, unknown>)
      : {}
  if (config['notification-channel'] !== 'in-app') {
    requirements.push({
      code: 'in-app-channel-required',
      message: 'Choose In-app notification to activate this recipe.',
    })
  }
  if (config.recipient !== 'workspace-owner') {
    requirements.push({
      code: 'workspace-owner-required',
      message:
        'Selected team member delivery needs a real member selector. Choose Workspace owner for now.',
    })
  }
  const nativeLeadEvents =
    input.businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
  const connectedCrmProviders = Array.from(
    new Set(
      input.connectedCrmProviders
        .map((provider) => provider.toLowerCase())
        .filter((provider) => provider === 'hubspot'),
    ),
  ).sort()
  const crmInboundReady =
    input.plan === 'Elite' &&
    !input.crmInboundDisabled &&
    connectedCrmProviders.length > 0
  const crmProviders = crmInboundReady ? connectedCrmProviders : []

  // Native durable Leads are a Basic+ Simple Automation source and do not
  // inherit the separate Elite inbound-webhook requirement. Workspaces that
  // do not have durable native Leads retain the existing CRM requirements.
  if (!nativeLeadEvents) {
    if (input.plan !== 'Elite') {
      requirements.push({
        code: 'crm-webhook-plan-required',
        message:
          'A workspace plan with production CRM webhooks is required for activation.',
      })
    }
    if (input.crmInboundDisabled) {
      requirements.push({
        code: 'crm-inbound-disabled',
        message: 'CRM webhook processing is currently disabled.',
      })
    }
    if (!connectedCrmProviders.length) {
      requirements.push({
        code: 'crm-webhook-source-required',
        message: 'Connect HubSpot to provide durable new-contact events.',
        action: 'Open Settings → Integrations',
      })
    }
  }

  return {
    liveSupported: true,
    ready: requirements.length === 0,
    nativeLeadEvents,
    requirements,
    crmProviders,
  }
}

export async function getSimpleAutomationReadiness(input: {
  workspaceId: string
  definitionKey: string
  definitionVersion: number
  config: unknown
}) {
  const { prisma } = await import('@/lib/db')
  const [workspace, capabilities, integrations] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { businessModel: true },
    }),
    getWorkspaceAutomationCapabilities(input.workspaceId),
    prisma.integration.findMany({
      where: { workspaceId: input.workspaceId, status: 'connected' },
      select: { provider: true, metadata: true },
    }),
  ])

  if (!workspace) {
    return {
      liveSupported: false,
      ready: false,
      nativeLeadEvents: false,
      crmProviders: [],
      requirements: [
        { code: 'workspace-not-found', message: 'Workspace was not found.' },
      ],
    } satisfies SimpleAutomationReadiness
  }

  return evaluateSimpleAutomationReadiness({
    ...input,
    businessModel: workspace.businessModel,
    plan: capabilities.plan,
    canUseStarterAutomations: capabilities.canUseStarterAutomations,
    connectedCrmProviders: integrations
      .filter((integration) => {
        const metadata = integration.metadata
        return !(
          metadata &&
          typeof metadata === 'object' &&
          !Array.isArray(metadata) &&
          (metadata as Record<string, unknown>).disabled === true
        )
      })
      .map((integration) => integration.provider),
    crmInboundDisabled:
      process.env.CRM_DISABLE_ALL === 'true' ||
      process.env.CRM_DISABLE_INBOUND === 'true',
  })
}
