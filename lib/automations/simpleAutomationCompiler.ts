import type { FlowGraph } from '@/lib/automations/executor'
import type { SimpleAutomationKey } from '@/lib/automations/simpleAutomationCatalog'
import {
  parseSimpleAutomationConfig,
  type SimpleAutomationConfig,
} from '@/lib/automations/simpleAutomationConfig'

const LIVE_DEFINITION_VERSIONS: Partial<Record<SimpleAutomationKey, number>> = {
  'new-lead-alert': 1,
  'lead-follow-up': 2,
  'job-completion-message': 2,
  'appointment-reminder': 2,
  'schedule-change-notification': 2,
  'estimate-follow-up': 1,
}

export class SimpleAutomationCompileError extends Error {}

export type SimpleAutomationCompilerInput = {
  definitionKey: SimpleAutomationKey
  definitionVersion: number
  config: unknown
  workspaceContext: {
    crmProviders: string[]
    nativeLeadEvents?: boolean
  }
}

function stableProviderList(providers: string[]) {
  return Array.from(
    new Set(
      providers
        .map((provider) => provider.trim().toLowerCase())
        // HubSpot is currently the only adapter with a production webhook
        // verifier. The Salesforce and Pipedrive adapters are explicit stubs
        // and must not make a managed recipe appear activatable.
        .filter((provider) => provider === 'hubspot'),
    ),
  ).sort()
}

export function compileSimpleAutomation(
  input: SimpleAutomationCompilerInput,
): FlowGraph {
  const supportedVersion = LIVE_DEFINITION_VERSIONS[input.definitionKey]
  if (!supportedVersion) {
    throw new SimpleAutomationCompileError(
      'This Simple Automation does not have a production compiler yet.',
    )
  }
  if (input.definitionVersion !== supportedVersion) {
    throw new SimpleAutomationCompileError(
      `Definition version ${input.definitionVersion} is not supported for activation.`,
    )
  }

  const parsed = parseSimpleAutomationConfig(input.definitionKey, input.config)
  if (!parsed.success) {
    throw new SimpleAutomationCompileError(
      'The saved configuration is invalid and must be reviewed.',
    )
  }

  if (
    input.definitionKey !== 'new-lead-alert' &&
    input.definitionKey !== 'lead-follow-up' &&
    input.definitionKey !== 'job-completion-message' &&
    input.definitionKey !== 'appointment-reminder' &&
    input.definitionKey !== 'schedule-change-notification' &&
    input.definitionKey !== 'estimate-follow-up'
  ) {
    throw new SimpleAutomationCompileError(
      'This Simple Automation does not have a production compiler yet.',
    )
  }

  const config = parsed.data as SimpleAutomationConfig
  if (input.definitionKey === 'estimate-follow-up') {
    const delay = config['estimate-delay']
    if (delay !== '1-day' && delay !== '3-days' && delay !== '7-days') {
      throw new SimpleAutomationCompileError(
        'Choose a supported Estimate follow-up delay.',
      )
    }
    const triggerId = 'simple:estimate-follow-up:v1:trigger'
    const actionId = 'simple:estimate-follow-up:v1:queue-email'
    return {
      nodes: [
        {
          id: triggerId,
          type: 'simple-estimate-follow-up-trigger',
          position: { x: 0, y: 0 },
          data: {
            label: 'Estimate follow-up due',
            source: { kind: 'native', event: 'estimate.follow_up_due' },
            __simpleManaged: true,
          },
        },
        {
          id: actionId,
          type: 'simple-estimate-follow-up-email',
          position: { x: 320, y: 0 },
          data: {
            label: 'Queue one Estimate reminder email',
            definitionKey: input.definitionKey,
            definitionVersion: input.definitionVersion,
            delay,
            channel: 'email',
            __simpleManaged: true,
          },
        },
      ],
      edges: [
        {
          id: `${triggerId}->${actionId}`,
          source: triggerId,
          target: actionId,
        },
      ],
    }
  }
  if (input.definitionKey === 'schedule-change-notification') {
    if (
      config['notification-channel'] !== 'in-app' ||
      config.recipient !== 'appointment-assignees-or-owner'
    ) {
      throw new SimpleAutomationCompileError(
        'Schedule Change Notification currently supports assigned-team in-app delivery only.',
      )
    }
    const triggerId = 'simple:schedule-change-notification:v2:trigger'
    const actionId = 'simple:schedule-change-notification:v2:notify'
    return {
      nodes: [
        {
          id: triggerId,
          type: 'simple-schedule-change-trigger',
          position: { x: 0, y: 0 },
          data: {
            label: 'Schedule changed',
            source: { kind: 'native', event: 'scheduling.schedule.changed' },
            __simpleManaged: true,
          },
        },
        {
          id: actionId,
          type: 'simple-schedule-change-notification',
          position: { x: 320, y: 0 },
          data: {
            label: 'Notify current assigned team members',
            definitionKey: input.definitionKey,
            definitionVersion: input.definitionVersion,
            changes: config.changes,
            recipient: config.recipient,
            channel: 'in-app',
            __simpleManaged: true,
          },
        },
      ],
      edges: [
        {
          id: `${triggerId}->${actionId}`,
          source: triggerId,
          target: actionId,
        },
      ],
    }
  }
  if (input.definitionKey === 'appointment-reminder') {
    if (
      config['notification-channel'] !== 'in-app' ||
      config.recipient !== 'appointment-assignees-or-owner'
    ) {
      throw new SimpleAutomationCompileError(
        'Appointment Reminder currently supports assigned-team in-app delivery only.',
      )
    }
    const triggerId = 'simple:appointment-reminder:v2:trigger'
    const actionId = 'simple:appointment-reminder:v2:notify'
    return {
      nodes: [
        {
          id: triggerId,
          type: 'simple-appointment-reminder-trigger',
          position: { x: 0, y: 0 },
          data: {
            label: 'Appointment reminder due',
            source: { kind: 'native', event: 'scheduling.reminder.due' },
            __simpleManaged: true,
          },
        },
        {
          id: actionId,
          type: 'simple-appointment-reminder-notification',
          position: { x: 320, y: 0 },
          data: {
            label: 'Remind assigned team members',
            definitionKey: input.definitionKey,
            definitionVersion: input.definitionVersion,
            recipient: config.recipient,
            channel: 'in-app',
            reminderOffset: config['reminder-offset'],
            __simpleManaged: true,
          },
        },
      ],
      edges: [
        {
          id: `${triggerId}->${actionId}`,
          source: triggerId,
          target: actionId,
        },
      ],
    }
  }
  if (input.definitionKey === 'job-completion-message') {
    if (config['notification-channel'] !== 'in-app') {
      throw new SimpleAutomationCompileError(
        'Job Completion Message currently supports in-app delivery only.',
      )
    }
    const recipient = config.recipient
    if (
      recipient !== 'job-assignee-or-owner' &&
      recipient !== 'workspace-owner'
    ) {
      throw new SimpleAutomationCompileError(
        'Choose a supported internal completion recipient.',
      )
    }

    const triggerId = 'simple:job-completion-message:v2:trigger'
    const actionId = 'simple:job-completion-message:v2:notify'
    return {
      nodes: [
        {
          id: triggerId,
          type: 'simple-job-completed-trigger',
          position: { x: 0, y: 0 },
          data: {
            label: 'Job completed',
            source: { kind: 'native', event: 'job.completed' },
            __simpleManaged: true,
          },
        },
        {
          id: actionId,
          type: 'simple-job-completion-notification',
          position: { x: 320, y: 0 },
          data: {
            label: 'Notify the responsible team member',
            definitionKey: input.definitionKey,
            definitionVersion: input.definitionVersion,
            recipient,
            channel: 'in-app',
            __simpleManaged: true,
          },
        },
      ],
      edges: [
        {
          id: `${triggerId}->${actionId}`,
          source: triggerId,
          target: actionId,
        },
      ],
    }
  }

  if (input.definitionKey === 'lead-follow-up') {
    if (config['notification-channel'] !== 'in-app') {
      throw new SimpleAutomationCompileError(
        'Lead Follow-Up currently supports in-app reminders only.',
      )
    }
    const recipient = config.recipient
    if (
      recipient !== 'lead-assignee-or-owner' &&
      recipient !== 'workspace-owner'
    ) {
      throw new SimpleAutomationCompileError(
        'Choose a supported internal reminder recipient.',
      )
    }

    const triggerId = 'simple:lead-follow-up:v2:trigger'
    const actionId = 'simple:lead-follow-up:v2:notify'
    return {
      nodes: [
        {
          id: triggerId,
          type: 'simple-lead-follow-up-trigger',
          position: { x: 0, y: 0 },
          data: {
            label: 'Lead follow-up due',
            source: { kind: 'native', event: 'lead.follow_up_due' },
            __simpleManaged: true,
          },
        },
        {
          id: actionId,
          type: 'simple-lead-follow-up-notification',
          position: { x: 320, y: 0 },
          data: {
            label: 'Remind the responsible team member',
            definitionKey: input.definitionKey,
            definitionVersion: input.definitionVersion,
            recipient,
            channel: 'in-app',
            __simpleManaged: true,
          },
        },
      ],
      edges: [
        {
          id: `${triggerId}->${actionId}`,
          source: triggerId,
          target: actionId,
        },
      ],
    }
  }

  if (config['notification-channel'] !== 'in-app') {
    throw new SimpleAutomationCompileError(
      'New Lead Alert currently supports in-app delivery only.',
    )
  }
  if (config.recipient !== 'workspace-owner') {
    throw new SimpleAutomationCompileError(
      'Select Workspace owner before activating New Lead Alert.',
    )
  }

  const providers = stableProviderList(input.workspaceContext.crmProviders)
  const sources = [
    ...(input.workspaceContext.nativeLeadEvents
      ? [{ kind: 'native', event: 'lead.created' }]
      : []),
    ...providers.map((provider) => ({
      kind: 'crm',
      provider,
      objectType: 'contact',
      event: 'contact.created',
    })),
  ]
  if (!sources.length) {
    throw new SimpleAutomationCompileError(
      'Connect HubSpot or use durable Skillify Leads before activation.',
    )
  }

  const actionId = 'simple:new-lead-alert:v1:notify-owner'
  const triggerNode = {
    id: 'simple:new-lead-alert:v1:trigger',
    type: 'simple-new-lead-trigger',
    position: { x: 0, y: 0 },
    data: {
      label: 'New lead created',
      sources,
      __simpleManaged: true,
    },
  }

  return {
    nodes: [
      triggerNode,
      {
        id: actionId,
        type: 'simple-in-app-notification',
        position: { x: 320, y: 0 },
        data: {
          label: 'Notify workspace owner',
          definitionKey: input.definitionKey,
          definitionVersion: input.definitionVersion,
          recipient: 'workspace-owner',
          channel: 'in-app',
          __simpleManaged: true,
        },
      },
    ],
    edges: [
      {
        id: `${triggerNode.id}->${actionId}`,
        source: triggerNode.id,
        target: actionId,
      },
    ],
  }
}
