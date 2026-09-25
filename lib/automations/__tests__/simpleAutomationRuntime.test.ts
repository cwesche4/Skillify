import { describe, expect, it, vi } from 'vitest'

import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import {
  compileSimpleAutomation,
  SimpleAutomationCompileError,
} from '@/lib/automations/simpleAutomationCompiler'
import {
  dispatchSimpleAutomationEvent,
  type SimpleAutomationDispatchDependencies,
} from '@/lib/automations/simpleAutomationDispatch'
import {
  transitionSimpleAutomationLifecycle,
  type SimpleAutomationLifecycleDependencies,
} from '@/lib/automations/simpleAutomationLifecycle'
import {
  evaluateSimpleAutomationReadiness,
  type SimpleAutomationReadiness,
} from '@/lib/automations/simpleAutomationReadiness'

const newLeadConfig = {
  'notification-channel': 'in-app',
  recipient: 'workspace-owner',
}

const leadFollowUpConfig = {
  'notification-channel': 'in-app',
  recipient: 'lead-assignee-or-owner',
}

const jobCompletionConfig = {
  'notification-channel': 'in-app',
  recipient: 'job-assignee-or-owner',
}

const appointmentReminderConfig = {
  'reminder-offset': '1-hour',
  'notification-channel': 'in-app',
  recipient: 'appointment-assignees-or-owner',
}

const ready: SimpleAutomationReadiness = {
  liveSupported: true,
  ready: true,
  nativeLeadEvents: true,
  requirements: [],
  crmProviders: ['hubspot'],
}

function lifecycleDependencies(input?: {
  status?: 'INACTIVE' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  readiness?: SimpleAutomationReadiness
  definitionKey?: string
  updateResult?: boolean
}) {
  const updateAutomation = vi.fn(async () => input?.updateResult ?? true)
  const dependencies: SimpleAutomationLifecycleDependencies = {
    findInstallation: async ({ workspaceId, definitionKey }) =>
      workspaceId === 'workspace-a' &&
      definitionKey === (input?.definitionKey ?? 'new-lead-alert')
        ? {
            id: 'installation-a',
            workspaceId,
            definitionKey,
            definitionVersion: 1,
            config: newLeadConfig,
            removedAt: null,
            automation: {
              id: 'automation-a',
              status: input?.status ?? 'INACTIVE',
            },
          }
        : null,
    getReadiness: async () => input?.readiness ?? ready,
    updateAutomation,
  }

  return { dependencies, updateAutomation }
}

describe('Simple Automation compiler and readiness', () => {
  it('compiles New Lead Alert deterministically with stable nodes and edges', () => {
    const input = {
      definitionKey: 'new-lead-alert' as const,
      definitionVersion: 1,
      config: newLeadConfig,
      workspaceContext: {
        crmProviders: ['salesforce', 'hubspot', 'hubspot'],
      },
    }

    const first = compileSimpleAutomation(input)
    const second = compileSimpleAutomation(input)

    expect(first).toEqual(second)
    expect(first.nodes.map((node) => [node.id, node.type])).toEqual([
      ['simple:new-lead-alert:v1:trigger', 'simple-new-lead-trigger'],
      ['simple:new-lead-alert:v1:notify-owner', 'simple-in-app-notification'],
    ])
    expect(first.edges).toHaveLength(1)
    expect(
      first.edges.every(
        (edge) => edge.target === 'simple:new-lead-alert:v1:notify-owner',
      ),
    ).toBe(true)
  })

  it('compiles Lead Follow-Up as a deterministic native internal reminder', () => {
    const input = {
      definitionKey: 'lead-follow-up' as const,
      definitionVersion: 2,
      config: leadFollowUpConfig,
      workspaceContext: { crmProviders: [] },
    }

    const first = compileSimpleAutomation(input)
    expect(compileSimpleAutomation(input)).toEqual(first)
    expect(first.nodes.map((node) => [node.id, node.type])).toEqual([
      ['simple:lead-follow-up:v2:trigger', 'simple-lead-follow-up-trigger'],
      ['simple:lead-follow-up:v2:notify', 'simple-lead-follow-up-notification'],
    ])
    expect(first.nodes[1]?.data).toMatchObject({
      channel: 'in-app',
      recipient: 'lead-assignee-or-owner',
    })
  })

  it('compiles Job Completion Message as a deterministic native internal notification', () => {
    const input = {
      definitionKey: 'job-completion-message' as const,
      definitionVersion: 2,
      config: jobCompletionConfig,
      workspaceContext: { crmProviders: [] },
    }

    const first = compileSimpleAutomation(input)
    expect(compileSimpleAutomation(input)).toEqual(first)
    expect(first.nodes.map((node) => [node.id, node.type])).toEqual([
      [
        'simple:job-completion-message:v2:trigger',
        'simple-job-completed-trigger',
      ],
      [
        'simple:job-completion-message:v2:notify',
        'simple-job-completion-notification',
      ],
    ])
    expect(first.nodes[1]?.data).toMatchObject({
      channel: 'in-app',
      recipient: 'job-assignee-or-owner',
    })
  })

  it('compiles Appointment Reminder as a deterministic native internal reminder', () => {
    const input = {
      definitionKey: 'appointment-reminder' as const,
      definitionVersion: 2,
      config: appointmentReminderConfig,
      workspaceContext: { crmProviders: [] },
    }

    const first = compileSimpleAutomation(input)
    expect(compileSimpleAutomation(input)).toEqual(first)
    expect(first.nodes.map((node) => [node.id, node.type])).toEqual([
      [
        'simple:appointment-reminder:v2:trigger',
        'simple-appointment-reminder-trigger',
      ],
      [
        'simple:appointment-reminder:v2:notify',
        'simple-appointment-reminder-notification',
      ],
    ])
    expect(first.nodes[1]?.data).toMatchObject({
      channel: 'in-app',
      recipient: 'appointment-assignees-or-owner',
      reminderOffset: '1-hour',
    })
  })

  it('fails safely for version mismatch and recipes without a live compiler', () => {
    expect(() =>
      compileSimpleAutomation({
        definitionKey: 'new-lead-alert',
        definitionVersion: 2,
        config: newLeadConfig,
        workspaceContext: { crmProviders: ['hubspot'] },
      }),
    ).toThrow(SimpleAutomationCompileError)

    expect(() =>
      compileSimpleAutomation({
        definitionKey: 'appointment-reminder',
        definitionVersion: 1,
        config: {
          'reminder-time': '24-hours',
          'customer-channel': 'email',
        },
        workspaceContext: { crmProviders: [] },
      }),
    ).toThrow('not supported for activation')
  })

  it('allows native New Lead Alert on Basic without requiring HubSpot', () => {
    const result = evaluateSimpleAutomationReadiness({
      definitionKey: 'new-lead-alert',
      definitionVersion: 1,
      config: newLeadConfig,
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      plan: 'Basic',
      canUseStarterAutomations: true,
      connectedCrmProviders: [],
    })

    expect(result).toEqual({
      ...ready,
      crmProviders: [],
      nativeLeadEvents: true,
    })
  })

  it('returns structured requirements when CRM delivery is not ready', () => {
    const result = evaluateSimpleAutomationReadiness({
      definitionKey: 'new-lead-alert',
      definitionVersion: 1,
      config: {
        'notification-channel': 'email',
        recipient: 'team-member',
      },
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      plan: 'Basic',
      canUseStarterAutomations: true,
      connectedCrmProviders: [],
      crmInboundDisabled: true,
    })

    expect(result.ready).toBe(false)
    expect(result.requirements.map((requirement) => requirement.code)).toEqual(
      expect.arrayContaining([
        'in-app-channel-required',
        'workspace-owner-required',
      ]),
    )
  })

  it('does not treat stub CRM adapters as production webhook sources', () => {
    const result = evaluateSimpleAutomationReadiness({
      definitionKey: 'new-lead-alert',
      definitionVersion: 1,
      config: newLeadConfig,
      businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      plan: 'Elite',
      canUseStarterAutomations: true,
      connectedCrmProviders: ['salesforce', 'pipedrive'],
    })

    expect(result.ready).toBe(false)
    expect(result.crmProviders).toEqual([])
    expect(result.requirements).toContainEqual(
      expect.objectContaining({ code: 'crm-webhook-source-required' }),
    )
  })

  it('allows native Lead Follow-Up on Basic for Simple Service only', () => {
    const result = evaluateSimpleAutomationReadiness({
      definitionKey: 'lead-follow-up',
      definitionVersion: 2,
      config: leadFollowUpConfig,
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      plan: 'Basic',
      canUseStarterAutomations: true,
      connectedCrmProviders: [],
    })

    expect(result).toMatchObject({
      liveSupported: true,
      ready: true,
      nativeLeadEvents: true,
      crmProviders: [],
    })
  })

  it.each([['estimate-follow-up', 'estimate-foundation-unavailable']])(
    'keeps %s non-live with reason %s',
    (definitionKey, reasonCode) => {
    const configs: Record<string, unknown> = {
      'estimate-follow-up': { 'estimate-delay': '3-days' },
    }
    const result = evaluateSimpleAutomationReadiness({
      definitionKey,
      definitionVersion: 1,
      config: configs[definitionKey],
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      plan: 'Elite',
      canUseStarterAutomations: true,
      connectedCrmProviders: ['hubspot'],
    })

    expect(result).toMatchObject({ liveSupported: false, ready: false })
    expect(result.requirements).toContainEqual(
      expect.objectContaining({ code: reasonCode }),
    )
    },
  )

  it('allows native Appointment Reminder on Basic without CRM capability', () => {
    const result = evaluateSimpleAutomationReadiness({
      definitionKey: 'appointment-reminder',
      definitionVersion: 2,
      config: appointmentReminderConfig,
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      plan: 'Basic',
      canUseStarterAutomations: true,
      connectedCrmProviders: [],
    })

    expect(result).toMatchObject({
      liveSupported: true,
      ready: true,
      crmProviders: [],
    })
  })

  it('requires obsolete customer-message Appointment Reminder config to be reviewed', () => {
    const result = evaluateSimpleAutomationReadiness({
      definitionKey: 'appointment-reminder',
      definitionVersion: 1,
      config: {
        'reminder-time': '24-hours',
        'customer-channel': 'email',
      },
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      plan: 'Basic',
      canUseStarterAutomations: true,
      connectedCrmProviders: [],
    })

    expect(result.ready).toBe(false)
    expect(result.requirements.map((requirement) => requirement.code)).toEqual(
      expect.arrayContaining([
        'definition-version-mismatch',
        'configuration-invalid',
        'in-app-channel-required',
        'appointment-reminder-recipient-required',
      ]),
    )
  })

  it('allows native Job Completion Message on Basic for Simple Service only', () => {
    const result = evaluateSimpleAutomationReadiness({
      definitionKey: 'job-completion-message',
      definitionVersion: 2,
      config: jobCompletionConfig,
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      plan: 'Basic',
      canUseStarterAutomations: true,
      connectedCrmProviders: [],
    })

    expect(result).toMatchObject({
      liveSupported: true,
      ready: true,
      crmProviders: [],
    })
  })

  it('requires an old Job Completion Message configuration to be reviewed and resaved as V2', () => {
    const result = evaluateSimpleAutomationReadiness({
      definitionKey: 'job-completion-message',
      definitionVersion: 1,
      config: { 'send-completion-message': true },
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      plan: 'Basic',
      canUseStarterAutomations: true,
      connectedCrmProviders: [],
    })

    expect(result.ready).toBe(false)
    expect(result.requirements.map((requirement) => requirement.code)).toEqual(
      expect.arrayContaining([
        'definition-version-mismatch',
        'configuration-invalid',
      ]),
    )
  })
})

describe('Simple Automation lifecycle', () => {
  it('activates by compiling a valid flow onto the stable Automation', async () => {
    const { dependencies, updateAutomation } = lifecycleDependencies()

    const result = await transitionSimpleAutomationLifecycle(
      {
        workspaceId: 'workspace-a',
        definitionKey: 'new-lead-alert',
        action: 'activate',
      },
      dependencies,
    )

    expect(result).toMatchObject({ ok: true, automationStatus: 'ACTIVE' })
    expect(updateAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        automationId: 'automation-a',
        workspaceId: 'workspace-a',
        expectedStatus: 'INACTIVE',
        status: 'ACTIVE',
        flow: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ type: 'simple-in-app-notification' }),
          ]),
        }),
      }),
    )
  })

  it('activates Lead Follow-Up with its production reminder flow', async () => {
    const updateAutomation = vi.fn(async () => true)
    const dependencies: SimpleAutomationLifecycleDependencies = {
      findInstallation: vi.fn(async () => ({
        id: 'installation-follow-up',
        workspaceId: 'workspace-a',
        definitionKey: 'lead-follow-up',
        definitionVersion: 2,
        config: leadFollowUpConfig,
        removedAt: null,
        automation: {
          id: 'automation-follow-up',
          status: 'INACTIVE' as const,
        },
      })),
      getReadiness: vi.fn(async () => ({
        ...ready,
        crmProviders: [],
      })),
      updateAutomation,
    }

    const result = await transitionSimpleAutomationLifecycle(
      {
        workspaceId: 'workspace-a',
        definitionKey: 'lead-follow-up',
        action: 'activate',
      },
      dependencies,
    )

    expect(result).toMatchObject({ ok: true, automationStatus: 'ACTIVE' })
    expect(updateAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              type: 'simple-lead-follow-up-notification',
            }),
          ]),
        }),
      }),
    )
  })

  it('activates Job Completion Message with its production internal-notification flow', async () => {
    const updateAutomation = vi.fn(async () => true)
    const dependencies: SimpleAutomationLifecycleDependencies = {
      findInstallation: vi.fn(async () => ({
        id: 'installation-job-completion',
        workspaceId: 'workspace-a',
        definitionKey: 'job-completion-message',
        definitionVersion: 2,
        config: jobCompletionConfig,
        removedAt: null,
        automation: {
          id: 'automation-job-completion',
          status: 'INACTIVE' as const,
        },
      })),
      getReadiness: vi.fn(async () => ({
        ...ready,
        nativeLeadEvents: false,
        crmProviders: [],
      })),
      updateAutomation,
    }

    const result = await transitionSimpleAutomationLifecycle(
      {
        workspaceId: 'workspace-a',
        definitionKey: 'job-completion-message',
        action: 'activate',
      },
      dependencies,
    )

    expect(result).toMatchObject({ ok: true, automationStatus: 'ACTIVE' })
    expect(updateAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              type: 'simple-job-completion-notification',
            }),
          ]),
        }),
      }),
    )
  })

  it('pauses an active managed Automation', async () => {
    const { dependencies, updateAutomation } = lifecycleDependencies({
      status: 'ACTIVE',
    })

    const result = await transitionSimpleAutomationLifecycle(
      {
        workspaceId: 'workspace-a',
        definitionKey: 'new-lead-alert',
        action: 'pause',
      },
      dependencies,
    )

    expect(result).toMatchObject({ ok: true, automationStatus: 'PAUSED' })
    expect(updateAutomation).toHaveBeenCalledWith({
      automationId: 'automation-a',
      workspaceId: 'workspace-a',
      expectedStatus: 'ACTIVE',
      status: 'PAUSED',
    })
  })

  it('recompiles and resumes a paused managed Automation', async () => {
    const { dependencies, updateAutomation } = lifecycleDependencies({
      status: 'PAUSED',
    })

    const result = await transitionSimpleAutomationLifecycle(
      {
        workspaceId: 'workspace-a',
        definitionKey: 'new-lead-alert',
        action: 'resume',
      },
      dependencies,
    )

    expect(result).toMatchObject({ ok: true, automationStatus: 'ACTIVE' })
    expect(updateAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ expectedStatus: 'PAUSED', status: 'ACTIVE' }),
    )
  })

  it('blocks activation when a required integration is missing', async () => {
    const readiness = {
      ...ready,
      ready: false,
      crmProviders: [],
      requirements: [
        {
          code: 'crm-webhook-source-required',
          message: 'Connect a supported CRM.',
        },
      ],
    }
    const { dependencies, updateAutomation } = lifecycleDependencies({
      readiness,
    })

    const result = await transitionSimpleAutomationLifecycle(
      {
        workspaceId: 'workspace-a',
        definitionKey: 'new-lead-alert',
        action: 'activate',
      },
      dependencies,
    )

    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(updateAutomation).not.toHaveBeenCalled()
  })

  it('does not find an installation through another workspace', async () => {
    const { dependencies, updateAutomation } = lifecycleDependencies()

    const result = await transitionSimpleAutomationLifecycle(
      {
        workspaceId: 'workspace-b',
        definitionKey: 'new-lead-alert',
        action: 'activate',
      },
      dependencies,
    )

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(updateAutomation).not.toHaveBeenCalled()
  })

  it('cannot activate a configured recipe without runtime support', async () => {
    const unsupportedReadiness: SimpleAutomationReadiness = {
      liveSupported: false,
      ready: false,
      nativeLeadEvents: false,
      requirements: [
        {
          code: 'automation-reminder-dispatch-unavailable',
          message: 'Reminder dispatch is unavailable.',
        },
      ],
      crmProviders: [],
    }
    const { dependencies, updateAutomation } = lifecycleDependencies({
      definitionKey: 'appointment-reminder',
      readiness: unsupportedReadiness,
    })

    const result = await transitionSimpleAutomationLifecycle(
      {
        workspaceId: 'workspace-a',
        definitionKey: 'appointment-reminder',
        action: 'activate',
      },
      dependencies,
    )

    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(updateAutomation).not.toHaveBeenCalled()
  })
})

describe('Simple Automation event dispatch', () => {
  function dispatchDependencies() {
    const claim = vi.fn<SimpleAutomationDispatchDependencies['claim']>()
    const run = vi.fn<SimpleAutomationDispatchDependencies['run']>()
    const succeed = vi.fn<SimpleAutomationDispatchDependencies['succeed']>()
    const fail = vi.fn<SimpleAutomationDispatchDependencies['fail']>()
    const cancel = vi.fn<SimpleAutomationDispatchDependencies['cancel']>()
    return { claim, run, succeed, fail, cancel }
  }

  const dispatchInput = {
    installationId: 'installation-a',
    automationId: 'automation-a',
    workspaceId: 'workspace-a',
    eventKey: 'hubspot:contact:lead-1:contact.created',
    triggerPayload: {
      provider: 'hubspot',
      externalId: 'lead-1',
      simpleEventKey: 'hubspot:contact:lead-1:contact.created',
    },
  }

  it('keeps native event identity separate from external webhook identity', () => {
    expect('native:domain-event:event-a').not.toBe(dispatchInput.eventKey)
  })

  it('records the existing Automation run on a claimed event', async () => {
    const dependencies = dispatchDependencies()
    dependencies.claim.mockResolvedValue('claimed')
    dependencies.run.mockResolvedValue('run-a')

    const result = await dispatchSimpleAutomationEvent(
      dispatchInput,
      dependencies,
    )

    expect(result).toEqual({
      dispatched: true,
      duplicate: false,
      runId: 'run-a',
    })
    expect(dependencies.run).toHaveBeenCalledWith(
      expect.objectContaining({
        automationId: 'automation-a',
        workspaceId: 'workspace-a',
      }),
    )
    expect(dependencies.succeed).toHaveBeenCalledWith({
      installationId: 'installation-a',
      eventKey: dispatchInput.eventKey,
      runId: 'run-a',
    })
  })

  it('does not execute or deliver a duplicate event', async () => {
    const dependencies = dispatchDependencies()
    dependencies.claim.mockResolvedValue('duplicate')

    const result = await dispatchSimpleAutomationEvent(
      dispatchInput,
      dependencies,
    )

    expect(result).toEqual({ dispatched: false, duplicate: true })
    expect(dependencies.run).not.toHaveBeenCalled()
    expect(dependencies.succeed).not.toHaveBeenCalled()
  })

  it('records failure before rethrowing a failed execution', async () => {
    const dependencies = dispatchDependencies()
    dependencies.claim.mockResolvedValue('claimed')
    dependencies.run.mockRejectedValue(new Error('Delivery failed'))

    await expect(
      dispatchSimpleAutomationEvent(dispatchInput, dependencies),
    ).rejects.toThrow('Delivery failed')
    expect(dependencies.fail).toHaveBeenCalledWith({
      installationId: 'installation-a',
      eventKey: dispatchInput.eventKey,
      runId: null,
      error: 'Delivery failed',
    })
    expect(dependencies.succeed).not.toHaveBeenCalled()
  })

  it('fences failure writes to the run bound to the dispatch', async () => {
    const dependencies = dispatchDependencies()
    dependencies.claim.mockResolvedValue('claimed')
    dependencies.run.mockImplementation(async (input) => {
      input.onRunCreated('run-bound')
      throw new Error('Delivery failed')
    })

    await expect(
      dispatchSimpleAutomationEvent(dispatchInput, dependencies),
    ).rejects.toThrow('Delivery failed')
    expect(dependencies.fail).toHaveBeenCalledWith({
      installationId: 'installation-a',
      eventKey: dispatchInput.eventKey,
      runId: 'run-bound',
      error: 'Delivery failed',
    })
  })

  it('makes a lifecycle-race claim terminal instead of retrying it later', async () => {
    const dependencies = dispatchDependencies()
    dependencies.claim.mockResolvedValue('claimed')
    dependencies.run.mockRejectedValue(new Error('Automation is not active'))

    await expect(
      dispatchSimpleAutomationEvent(dispatchInput, dependencies),
    ).rejects.toThrow('Automation is not active')
    expect(dependencies.cancel).toHaveBeenCalledWith({
      installationId: 'installation-a',
      eventKey: dispatchInput.eventKey,
      runId: null,
      reason: 'Automation is not active',
    })
    expect(dependencies.fail).not.toHaveBeenCalled()
  })
})
