import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest'
import { executeNode, runAutomation } from '@/lib/automations/executor'
import { buildScheduleChangeSnapshot } from '@/lib/automations/simpleScheduleChangeNotification'

const prismaMocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  integration: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  integrationCredential: {
    update: vi.fn(),
  },
  workspace: {
    findUnique: vi.fn(),
  },
  schedulingNotification: {
    upsert: vi.fn(),
  },
  automation: {
    findFirst: vi.fn(),
  },
  automationRun: {
    create: vi.fn(),
    update: vi.fn(),
  },
  automationRunEvent: {
    create: vi.fn(),
    update: vi.fn(),
  },
  simpleAutomationDispatch: {
    findUnique: vi.fn(),
  },
  lead: {
    findFirst: vi.fn(),
  },
  job: {
    findFirst: vi.fn(),
  },
  domainOutboxEvent: {
    findFirst: vi.fn(),
  },
  schedulingReminderSchedule: {
    findFirst: vi.fn(),
  },
  schedulingEvent: {
    findFirst: vi.fn(),
  },
  workspaceMember: {
    findMany: vi.fn(),
  },
  workspaceTeam: {
    findMany: vi.fn(),
  },
}))

const getWorkspacePlanMock = vi.hoisted(() => vi.fn(async () => 'Elite'))

vi.mock('@/lib/db', () => ({
  prisma: prismaMocks,
}))
vi.mock('@/lib/subscriptions/getWorkspacePlan', () => ({
  getWorkspacePlan: getWorkspacePlanMock,
  resolveWorkspacePlan: (input: {
    workspaceSubscriptionPlan?: string | null
    ownerSubscriptionPlan?: string | null
  }) =>
    input.workspaceSubscriptionPlan ?? input.ownerSubscriptionPlan ?? 'Free',
}))
vi.mock('@/lib/integrations/register-default', () => ({
  ensureIntegrationAdapters: vi.fn(),
}))
const executeActionMock = vi.fn(async () => ({ ok: true, data: { id: 'hs1' } }))
vi.mock('@/lib/integrations/registry', () => ({
  getIntegrationAdapter: vi.fn(() => ({
    executeAction: executeActionMock,
  })),
}))
vi.mock('@/lib/integrations/circuit', () => ({
  resetBreakerIfNeeded: vi.fn(async () => ({ breakerOpen: false })),
  isBreakerOpen: vi.fn(async () => false),
  recordFailure: vi.fn(),
}))
vi.mock('@/lib/integrations/crypto', () => ({
  decryptToken: (v: string) => v,
}))
vi.mock('@/lib/audit/log', () => ({
  logAudit: vi.fn(async () => ({})),
}))
vi.mock('@/lib/integrations/externalRecords', () => ({
  upsertExternalRecord: vi.fn(),
}))

describe('CRM action node', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.integration.findFirst.mockResolvedValue({
      id: 'int1',
      metadata: {},
      credentials: [
        {
          accessToken: 't',
          refreshToken: null,
        },
      ],
    })
    prismaMocks.integration.update.mockResolvedValue({})
    prismaMocks.workspace.findUnique.mockResolvedValue({
      slug: 'garden-care',
      ownerId: 'owner-1',
      businessName: 'Garden Care',
      name: 'Garden Care',
      businessModel: 'SIMPLE_SERVICE_BUSINESS',
    })
    prismaMocks.schedulingNotification.upsert.mockResolvedValue({
      id: 'notification-1',
    })
    prismaMocks.automationRun.create.mockResolvedValue({ id: 'run-1' })
    prismaMocks.automationRunEvent.create.mockImplementation(
      async ({ data }: any) => ({ id: `event-${data.nodeId}` }),
    )
    prismaMocks.automationRunEvent.update.mockResolvedValue({})
    prismaMocks.automationRun.update.mockResolvedValue({})
    executeActionMock.mockResolvedValue({ ok: true, data: { id: 'hs1' } })
    getWorkspacePlanMock.mockResolvedValue('Elite')
    prismaMocks.$queryRaw.mockResolvedValue([{ id: 'lead-1' }])
    prismaMocks.$transaction.mockImplementation(async (callback) =>
      callback(prismaMocks),
    )
  })

  it('fails closed for an unsupported node type', async () => {
    await expect(
      executeNode('unregistered-node', {}, { depth: 0 }),
    ).rejects.toThrow('Unsupported automation node type: unregistered-node')
  })

  const ctx = {
    workspaceId: 'ws1',
    automationId: 'auto1',
    depth: 0,
  }

  it('logs success', async () => {
    const res = await executeNode(
      'crm-action',
      { provider: 'hubspot', action: 'contact.create', integrationId: 'int1' },
      ctx,
    )
    expect(res.output).toEqual({ id: 'hs1' })
  })

  it('increments failures on error', async () => {
    executeActionMock.mockResolvedValueOnce({ ok: false, error: 'fail' })
    const res = await executeNode(
      'crm-action',
      { provider: 'hubspot', action: 'contact.create', integrationId: 'int1' },
      ctx,
    )
    expect(res.output).toHaveProperty('error')
  })
})

describe('Simple Automation execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.workspace.findUnique.mockResolvedValue({
      slug: 'garden-care',
      ownerId: 'owner-1',
      businessName: 'Garden Care',
      name: 'Garden Care',
      businessModel: 'SIMPLE_SERVICE_BUSINESS',
    })
    prismaMocks.schedulingNotification.upsert.mockResolvedValue({
      id: 'notification-1',
    })
    prismaMocks.automationRun.create.mockResolvedValue({ id: 'run-1' })
    prismaMocks.automationRunEvent.create.mockImplementation(
      async ({ data }: any) => ({ id: `event-${data.nodeId}` }),
    )
    prismaMocks.automationRunEvent.update.mockResolvedValue({})
    prismaMocks.automationRun.update.mockResolvedValue({})
    prismaMocks.simpleAutomationDispatch.findUnique.mockResolvedValue({
      status: 'PROCESSING',
      runId: 'run-1',
    })
    prismaMocks.domainOutboxEvent.findFirst.mockResolvedValue({ id: 'event-1' })
    getWorkspacePlanMock.mockResolvedValue('Elite')
    prismaMocks.$queryRaw.mockResolvedValue([{ id: 'lead-1' }])
    prismaMocks.$transaction.mockImplementation(async (callback) =>
      callback(prismaMocks),
    )
  })

  const flow = {
    nodes: [
      { id: 'trigger', type: 'crm-trigger', data: { provider: 'hubspot' } },
      {
        id: 'notify',
        type: 'simple-in-app-notification',
        data: { definitionKey: 'new-lead-alert' },
      },
    ],
    edges: [{ id: 'trigger-notify', source: 'trigger', target: 'notify' }],
  }

  function activeAutomation(overrides: Record<string, unknown> = {}) {
    return {
      id: 'automation-1',
      workspaceId: 'workspace-1',
      status: 'ACTIVE',
      flow,
      workspace: { id: 'workspace-1' },
      simpleAutomationInstallation: { id: 'installation-1' },
      ...overrides,
    }
  }

  const runOptions = {
    expectedWorkspaceId: 'workspace-1',
    triggerPayload: {
      provider: 'hubspot',
      externalId: 'contact-1',
      simpleEventKey: 'hubspot:contact:contact-1:contact.created',
      raw: { firstname: 'Sam' },
    },
  }

  it('creates the notification and records successful run history', async () => {
    prismaMocks.automation.findFirst.mockResolvedValue(activeAutomation())

    await expect(runAutomation('automation-1', runOptions)).resolves.toBe(
      'run-1',
    )

    expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_deduplicationKey: {
            workspaceId: 'workspace-1',
            deduplicationKey:
              'simple:new-lead-alert:hubspot:contact:contact-1:contact.created',
          },
        },
        create: expect.objectContaining({
          recipientUserId: 'owner-1',
          title: 'New lead received',
          deepLink: '/dashboard/garden-care/settings/integrations',
        }),
      }),
    )
    expect(prismaMocks.automationRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        automationId: 'automation-1',
        workspaceId: 'workspace-1',
        status: 'RUNNING',
      }),
    })
    expect(prismaMocks.automationRunEvent.create).toHaveBeenCalledTimes(2)
    expect(prismaMocks.automationRunEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUCCESS' }),
      }),
    )
    expect(prismaMocks.automationRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUCCESS' }),
      }),
    )
  })

  it('uses the native Lead snapshot without claiming a HubSpot source', async () => {
    prismaMocks.automation.findFirst.mockResolvedValue(activeAutomation())

    await runAutomation('automation-1', {
      expectedWorkspaceId: 'workspace-1',
      triggerPayload: {
        source: 'skillify-native',
        provider: 'Skillify',
        externalId: 'lead-native-1',
        domainEventId: 'event-native-1',
        simpleEventKey: 'native:domain-event:event-native-1',
        raw: { displayName: 'Native Lead' },
      },
    })

    expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          body: 'Native Lead was added to Skillify.',
          entityType: 'Lead',
          entityId: 'lead-native-1',
          metadata: expect.objectContaining({
            source: 'skillify-native',
            domainEventId: 'event-native-1',
          }),
        }),
      }),
    )
  })

  it('fails closed if capability changes before managed delivery', async () => {
    prismaMocks.automation.findFirst.mockResolvedValue(activeAutomation())
    getWorkspacePlanMock.mockResolvedValueOnce('Free')

    await expect(
      runAutomation('automation-1', {
        expectedWorkspaceId: 'workspace-1',
        triggerPayload: {
          source: 'skillify-native',
          provider: 'Skillify',
          externalId: 'lead-native-1',
          simpleEventKey: 'native:domain-event:event-native-1',
          raw: { displayName: 'Native Lead' },
        },
      }),
    ).rejects.toThrow('Managed Simple Automation is no longer eligible.')
    expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
  })

  it('fences a stale run after the dispatch is rebound', async () => {
    prismaMocks.automation.findFirst.mockResolvedValue(activeAutomation())
    prismaMocks.simpleAutomationDispatch.findUnique.mockResolvedValueOnce({
      status: 'PROCESSING',
      runId: 'run-new-owner',
    })

    await expect(runAutomation('automation-1', runOptions)).rejects.toThrow(
      'Managed Simple Automation dispatch is no longer current.',
    )
    expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
  })

  it('records node and run failure when notification delivery fails', async () => {
    prismaMocks.automation.findFirst.mockResolvedValue(activeAutomation())
    prismaMocks.schedulingNotification.upsert.mockRejectedValueOnce(
      new Error('Notification store unavailable'),
    )

    await expect(runAutomation('automation-1', runOptions)).rejects.toThrow(
      'Notification store unavailable',
    )
    expect(prismaMocks.automationRunEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-notify' },
      data: {
        status: 'FAILED',
        message: 'Notification store unavailable',
      },
    })
    expect(prismaMocks.automationRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    )
  })

  it.each(['INACTIVE', 'PAUSED'])(
    '%s Automations do not dispatch',
    async (status) => {
      prismaMocks.automation.findFirst.mockResolvedValue(
        activeAutomation({ status }),
      )

      await expect(runAutomation('automation-1', runOptions)).rejects.toThrow(
        'Automation is not active',
      )
      expect(prismaMocks.automationRun.create).not.toHaveBeenCalled()
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    },
  )

  it('requires the event workspace to match the Automation workspace', async () => {
    prismaMocks.automation.findFirst.mockResolvedValue(null)

    await expect(
      runAutomation('automation-1', {
        ...runOptions,
        expectedWorkspaceId: 'workspace-2',
      }),
    ).rejects.toThrow('Automation not found')
    expect(prismaMocks.automation.findFirst).toHaveBeenCalledWith({
      where: { id: 'automation-1', workspaceId: 'workspace-2' },
      include: { workspace: true },
    })
    expect(prismaMocks.automationRun.create).not.toHaveBeenCalled()
  })

  describe('native Lead Follow-Up delivery', () => {
    const scheduledFor = '2026-09-28T18:00:00.000Z'
    const followUpFlow = {
      nodes: [
        { id: 'trigger', type: 'simple-lead-follow-up-trigger', data: {} },
        {
          id: 'notify',
          type: 'simple-lead-follow-up-notification',
          data: {
            definitionKey: 'lead-follow-up',
            recipient: 'lead-assignee-or-owner',
          },
        },
      ],
      edges: [{ id: 'trigger-notify', source: 'trigger', target: 'notify' }],
    }
    const followUpOptions = {
      expectedWorkspaceId: 'workspace-1',
      triggerPayload: {
        source: 'skillify-native',
        event: 'lead.follow_up_due',
        externalId: 'lead-1',
        scheduledFor,
        scheduleRevision: '11111111-1111-4111-8111-111111111111',
        domainEventId: 'event-follow-up-1',
        simpleEventKey: 'native:domain-event:event-follow-up-1',
      },
    }

    function eligibleLead(overrides: Record<string, unknown> = {}) {
      return {
        displayName: 'Taylor Smith',
        nextStep: 'Call about the estimate',
        stage: 'FOLLOW_UP',
        followUpAt: new Date(scheduledFor),
        convertedCustomerId: null,
        archivedAt: null,
        assignedMemberId: 'member-1',
        assignee: { userId: 'assignee-user-1', workspaceId: 'workspace-1' },
        ...overrides,
      }
    }

    beforeEach(() => {
      getWorkspacePlanMock.mockResolvedValue('Basic')
      prismaMocks.automation.findFirst.mockResolvedValue(
        activeAutomation({ flow: followUpFlow }),
      )
      prismaMocks.lead.findFirst.mockResolvedValue(eligibleLead())
    })

    it('reminds the current workspace assignee in-app', async () => {
      await expect(
        runAutomation('automation-1', followUpOptions),
      ).resolves.toBe('run-1')

      expect(prismaMocks.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-1', workspaceId: 'workspace-1' },
        }),
      )
      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId_deduplicationKey: {
              workspaceId: 'workspace-1',
              deduplicationKey:
                'simple:lead-follow-up:native:domain-event:event-follow-up-1',
            },
          },
          create: expect.objectContaining({
            recipientUserId: 'assignee-user-1',
            recipientWorkspaceMemberId: 'member-1',
            category: 'REMINDER',
            title: 'Lead follow-up due',
            body: 'Taylor Smith: Call about the estimate',
          }),
        }),
      )
    })

    it('falls back to the owner for an unassigned or foreign-workspace assignee', async () => {
      prismaMocks.lead.findFirst.mockResolvedValueOnce(
        eligibleLead({
          assignedMemberId: 'foreign-member',
          assignee: { userId: 'foreign-user', workspaceId: 'workspace-2' },
        }),
      )

      await runAutomation('automation-1', followUpOptions)

      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            recipientType: 'workspaceOwner',
            recipientUserId: 'owner-1',
            recipientWorkspaceMemberId: null,
          }),
        }),
      )
    })

    it.each([
      ['won', { stage: 'WON' }],
      ['lost', { stage: 'LOST' }],
      ['converted', { convertedCustomerId: 'customer-1' }],
      ['archived', { archivedAt: new Date() }],
      ['rescheduled', { followUpAt: new Date('2026-09-29T18:00:00.000Z') }],
    ])(
      'rejects a %s Lead at the final delivery boundary',
      async (_label, state) => {
        prismaMocks.lead.findFirst.mockResolvedValueOnce(eligibleLead(state))

        await expect(
          runAutomation('automation-1', followUpOptions),
        ).rejects.toThrow(
          'Managed Lead Follow-Up schedule is no longer current.',
        )
        expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
      },
    )

    it('revalidates the Basic+ capability before delivery', async () => {
      getWorkspacePlanMock.mockResolvedValueOnce('Free')

      await expect(
        runAutomation('automation-1', followUpOptions),
      ).rejects.toThrow('Managed Simple Automation is no longer eligible.')
      expect(prismaMocks.lead.findFirst).not.toHaveBeenCalled()
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('revalidates lifecycle again while holding the final delivery locks', async () => {
      prismaMocks.automation.findFirst
        .mockResolvedValueOnce(activeAutomation({ flow: followUpFlow }))
        .mockResolvedValueOnce(activeAutomation({ flow: followUpFlow }))
        .mockResolvedValueOnce(null)

      await expect(
        runAutomation('automation-1', followUpOptions),
      ).rejects.toThrow('Managed Simple Automation is no longer active.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })
  })

  describe('native Schedule Change Notification delivery', () => {
    const change = buildScheduleChangeSnapshot({
      eventId: 'appointment-1',
      eventTypeKey: 'serviceAppointment',
      title: 'Spring Cleanup',
      timezone: 'America/New_York',
      recurrenceSeriesId: null,
      occurrenceOriginalAt: null,
      occurrenceState: null,
      scope: 'single',
      before: {
        startsAtUtc: new Date('2026-10-01T18:00:00.000Z'),
        status: 'scheduled',
        assignments: [{ workspaceMemberId: 'member-1' }],
      },
      after: {
        startsAtUtc: new Date('2026-10-01T20:00:00.000Z'),
        status: 'scheduled',
        assignments: [{ workspaceMemberId: 'member-1' }],
      },
    })!
    const workMetadata = {
      installationId: 'schedule-installation-1',
      automationId: 'schedule-automation-1',
      outboxEventId: 'outbox-change-1',
      change,
    }
    const flow = {
      nodes: [
        { id: 'trigger', type: 'simple-schedule-change-trigger', data: {} },
        {
          id: 'notify',
          type: 'simple-schedule-change-notification',
          data: {
            definitionKey: 'schedule-change-notification',
            definitionVersion: 2,
            changes: ['time', 'assignment', 'canceled'],
            channel: 'in-app',
            recipient: 'appointment-assignees-or-owner',
          },
        },
      ],
      edges: [{ id: 'trigger-notify', source: 'trigger', target: 'notify' }],
    }
    const options = {
      expectedWorkspaceId: 'workspace-1',
      triggerPayload: {
        source: 'skillify-native',
        provider: 'Skillify',
        objectType: 'scheduling-event',
        event: 'scheduling.schedule.changed',
        externalId: 'appointment-1',
        occurredAt: '2026-10-01T19:00:00.000Z',
        simpleEventKey: 'native:schedule-change:schedule-work-1',
        reminderScheduleId: 'schedule-work-1',
        reminderClaimedBy: 'schedule-worker-1',
        outboxEventId: 'outbox-change-1',
        changeRevision: change.revision,
        raw: workMetadata,
      },
    }

    function currentOccurrence(overrides: Record<string, unknown> = {}) {
      return {
        id: 'appointment-1',
        workspaceId: 'workspace-1',
        eventTypeKey: 'serviceAppointment',
        title: 'Spring Cleanup',
        status: 'SCHEDULED',
        startsAtUtc: new Date(change.after.startsAtUtc),
        deletedAt: null,
        occurrenceOriginalAt: null,
        occurrenceState: null,
        recurrenceSeriesId: null,
        linkedRecordType: 'customer',
        linkedRecordId: 'customer-1',
        assignments: [{ workspaceMemberId: 'member-1', teamId: null }],
        ...overrides,
      }
    }

    function eligibleWorkspace(overrides: Record<string, unknown> = {}) {
      return {
        slug: 'garden-care',
        ownerId: 'owner-1',
        businessName: 'Garden Care',
        name: 'Garden Care',
        businessModel: 'SIMPLE_SERVICE_BUSINESS',
        subscription: { id: 'subscription-1', plan: 'Basic' },
        owner: { subscription: null },
        ...overrides,
      }
    }

    beforeEach(() => {
      getWorkspacePlanMock.mockResolvedValue('Basic')
      prismaMocks.workspace.findUnique.mockResolvedValue(eligibleWorkspace())
      prismaMocks.automation.findFirst.mockResolvedValue(
        activeAutomation({
          id: 'schedule-automation-1',
          flow,
          simpleAutomationInstallation: {
            id: 'schedule-installation-1',
            config: {
              changes: ['time', 'assignment', 'canceled'],
              'notification-channel': 'in-app',
              recipient: 'appointment-assignees-or-owner',
            },
          },
        }),
      )
      prismaMocks.schedulingReminderSchedule.findFirst.mockResolvedValue({
        metadata: workMetadata,
        claimedBy: 'schedule-worker-1',
      })
      prismaMocks.domainOutboxEvent.findFirst.mockResolvedValue({
        payload: { eventId: 'appointment-1', scheduleChange: change },
      })
      prismaMocks.schedulingEvent.findFirst.mockResolvedValue(
        currentOccurrence(),
      )
      prismaMocks.workspaceMember.findMany.mockResolvedValue([
        { id: 'member-1', userId: 'assignee-user-1' },
      ])
      prismaMocks.workspaceTeam.findMany.mockResolvedValue([])
      prismaMocks.$queryRaw.mockResolvedValue([{ id: 'locked' }])
    })

    it('notifies each current assignee once with truthful timezone copy', async () => {
      await expect(
        runAutomation('schedule-automation-1', options),
      ).resolves.toBe('run-1')

      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledTimes(1)
      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            recipientUserId: 'assignee-user-1',
            title: 'Schedule changed',
            body: expect.stringContaining('moved from'),
            entityId: 'appointment-1',
          }),
        }),
      )
    })

    it('deduplicates direct and team recipients from the current assignment set', async () => {
      const assignmentChange = buildScheduleChangeSnapshot({
        eventId: 'appointment-1',
        eventTypeKey: 'serviceAppointment',
        title: 'Spring Cleanup',
        timezone: 'America/New_York',
        recurrenceSeriesId: null,
        occurrenceOriginalAt: null,
        occurrenceState: null,
        scope: 'single',
        before: {
          startsAtUtc: new Date(change.after.startsAtUtc),
          status: 'scheduled',
          assignments: [{ workspaceMemberId: 'member-2' }],
        },
        after: {
          startsAtUtc: new Date(change.after.startsAtUtc),
          status: 'scheduled',
          assignments: [
            { workspaceMemberId: 'member-1' },
            { teamId: 'team-1' },
          ],
        },
      })!
      const assignmentMetadata = {
        ...workMetadata,
        change: assignmentChange,
      }
      prismaMocks.schedulingReminderSchedule.findFirst.mockResolvedValueOnce({
        metadata: assignmentMetadata,
        claimedBy: 'schedule-worker-1',
      })
      prismaMocks.domainOutboxEvent.findFirst.mockResolvedValueOnce({
        payload: { scheduleChange: assignmentChange },
      })
      prismaMocks.schedulingEvent.findFirst.mockResolvedValueOnce(
        currentOccurrence({
          assignments: [
            { workspaceMemberId: 'member-1', teamId: null },
            { workspaceMemberId: null, teamId: 'team-1' },
          ],
        }),
      )
      prismaMocks.workspaceTeam.findMany.mockResolvedValueOnce([
        {
          id: 'team-1',
          members: [
            {
              workspaceMember: {
                id: 'member-1',
                userId: 'assignee-user-1',
                workspaceId: 'workspace-1',
              },
            },
            {
              workspaceMember: {
                id: 'member-2',
                userId: 'assignee-user-2',
                workspaceId: 'workspace-1',
              },
            },
          ],
        },
      ])

      await runAutomation('schedule-automation-1', {
        ...options,
        triggerPayload: {
          ...options.triggerPayload,
          changeRevision: assignmentChange.revision,
          raw: assignmentMetadata,
        },
      })

      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledTimes(2)
    })

    it('falls back to the workspace owner when the current event is unassigned', async () => {
      const unassignedChange = buildScheduleChangeSnapshot({
        eventId: 'appointment-1',
        eventTypeKey: 'serviceAppointment',
        title: 'Spring Cleanup',
        timezone: 'America/New_York',
        recurrenceSeriesId: null,
        occurrenceOriginalAt: null,
        occurrenceState: null,
        scope: 'single',
        before: {
          startsAtUtc: new Date(change.after.startsAtUtc),
          status: 'scheduled',
          assignments: [{ workspaceMemberId: 'member-1' }],
        },
        after: {
          startsAtUtc: new Date(change.after.startsAtUtc),
          status: 'scheduled',
          assignments: [],
        },
      })!
      const unassignedMetadata = { ...workMetadata, change: unassignedChange }
      prismaMocks.schedulingReminderSchedule.findFirst.mockResolvedValueOnce({
        metadata: unassignedMetadata,
        claimedBy: 'schedule-worker-1',
      })
      prismaMocks.domainOutboxEvent.findFirst.mockResolvedValueOnce({
        payload: { scheduleChange: unassignedChange },
      })
      prismaMocks.schedulingEvent.findFirst.mockResolvedValueOnce(
        currentOccurrence({ assignments: [] }),
      )
      prismaMocks.workspaceMember.findMany.mockResolvedValueOnce([])
      prismaMocks.workspaceTeam.findMany.mockResolvedValueOnce([])

      await runAutomation('schedule-automation-1', {
        ...options,
        triggerPayload: {
          ...options.triggerPayload,
          changeRevision: unassignedChange.revision,
          raw: unassignedMetadata,
        },
      })

      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            recipientType: 'workspaceOwner',
            recipientUserId: 'owner-1',
            recipientWorkspaceMemberId: null,
          }),
        }),
      )
    })

    it('suppresses stale intermediate work after a later change', async () => {
      prismaMocks.schedulingEvent.findFirst.mockResolvedValueOnce(
        currentOccurrence({ startsAtUtc: new Date('2026-10-01T21:00:00.000Z') }),
      )

      await expect(
        runAutomation('schedule-automation-1', options),
      ).rejects.toThrow(
        'Managed Schedule Change Notification is no longer current.',
      )
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('suppresses stale cancellation copy after the event is restored', async () => {
      const cancellation = buildScheduleChangeSnapshot({
        eventId: 'appointment-1',
        eventTypeKey: 'serviceAppointment',
        title: 'Spring Cleanup',
        timezone: 'America/New_York',
        recurrenceSeriesId: null,
        occurrenceOriginalAt: null,
        occurrenceState: null,
        scope: 'single',
        before: {
          startsAtUtc: new Date(change.after.startsAtUtc),
          status: 'scheduled',
          assignments: [{ workspaceMemberId: 'member-1' }],
        },
        after: {
          startsAtUtc: new Date(change.after.startsAtUtc),
          status: 'canceled',
          assignments: [{ workspaceMemberId: 'member-1' }],
        },
      })!
      const cancellationMetadata = { ...workMetadata, change: cancellation }
      prismaMocks.schedulingReminderSchedule.findFirst.mockResolvedValueOnce({
        metadata: cancellationMetadata,
        claimedBy: 'schedule-worker-1',
      })
      prismaMocks.domainOutboxEvent.findFirst.mockResolvedValueOnce({
        payload: { scheduleChange: cancellation },
      })
      prismaMocks.schedulingEvent.findFirst.mockResolvedValueOnce(
        currentOccurrence({ status: 'SCHEDULED' }),
      )

      await expect(
        runAutomation('schedule-automation-1', {
          ...options,
          triggerPayload: {
            ...options.triggerPayload,
            changeRevision: cancellation.revision,
            raw: cancellationMetadata,
          },
        }),
      ).rejects.toThrow(
        'Managed Schedule Change Notification is no longer current.',
      )
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('suppresses stale assignment work before resolving obsolete recipients', async () => {
      const assignment = buildScheduleChangeSnapshot({
        eventId: 'appointment-1',
        eventTypeKey: 'serviceAppointment',
        title: 'Spring Cleanup',
        timezone: 'America/New_York',
        recurrenceSeriesId: null,
        occurrenceOriginalAt: null,
        occurrenceState: null,
        scope: 'single',
        before: {
          startsAtUtc: new Date(change.after.startsAtUtc),
          status: 'scheduled',
          assignments: [{ workspaceMemberId: 'member-a' }],
        },
        after: {
          startsAtUtc: new Date(change.after.startsAtUtc),
          status: 'scheduled',
          assignments: [{ workspaceMemberId: 'member-b' }],
        },
      })!
      const assignmentMetadata = { ...workMetadata, change: assignment }
      prismaMocks.schedulingReminderSchedule.findFirst.mockResolvedValueOnce({
        metadata: assignmentMetadata,
        claimedBy: 'schedule-worker-1',
      })
      prismaMocks.domainOutboxEvent.findFirst.mockResolvedValueOnce({
        payload: { scheduleChange: assignment },
      })
      prismaMocks.schedulingEvent.findFirst.mockResolvedValueOnce(
        currentOccurrence({
          assignments: [{ workspaceMemberId: 'member-c', teamId: null }],
        }),
      )

      await expect(
        runAutomation('schedule-automation-1', {
          ...options,
          triggerPayload: {
            ...options.triggerPayload,
            changeRevision: assignment.revision,
            raw: assignmentMetadata,
          },
        }),
      ).rejects.toThrow(
        'Managed Schedule Change Notification is no longer current.',
      )
      expect(prismaMocks.workspaceMember.findMany).not.toHaveBeenCalled()
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('fences a stale schedule-change worker before insertion', async () => {
      prismaMocks.schedulingReminderSchedule.findFirst.mockResolvedValueOnce({
        metadata: workMetadata,
        claimedBy: 'replacement-worker',
      })

      await expect(
        runAutomation('schedule-automation-1', options),
      ).rejects.toThrow('Schedule Change worker claim was lost.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('fails closed when capability is lost before insertion', async () => {
      getWorkspacePlanMock.mockResolvedValueOnce('Basic')
      prismaMocks.workspace.findUnique
        .mockResolvedValueOnce(eligibleWorkspace())
        .mockResolvedValueOnce(eligibleWorkspace())
        .mockResolvedValueOnce(
          eligibleWorkspace({
            subscription: { id: 'subscription-1', plan: 'Free' },
          }),
        )

      await expect(
        runAutomation('schedule-automation-1', options),
      ).rejects.toThrow('Managed Simple Automation is no longer eligible.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })
  })

  describe('native Appointment Reminder delivery', () => {
    const eventStartsAtUtc = '2026-10-01T14:00:00.000Z'
    const reminderMetadata = {
      installationId: 'installation-1',
      automationId: 'automation-1',
      definitionVersion: 2,
      offsetMinutes: 60,
      eventStartsAtUtc,
      occurrenceOriginalAt: null,
      scheduleRevision: 'appointment-revision-1',
    }
    const appointmentFlow = {
      nodes: [
        {
          id: 'trigger',
          type: 'simple-appointment-reminder-trigger',
          data: {},
        },
        {
          id: 'notify',
          type: 'simple-appointment-reminder-notification',
          data: {
            definitionKey: 'appointment-reminder',
            definitionVersion: 2,
            channel: 'in-app',
            recipient: 'appointment-assignees-or-owner',
          },
        },
      ],
      edges: [{ id: 'trigger-notify', source: 'trigger', target: 'notify' }],
    }
    const appointmentOptions = {
      expectedWorkspaceId: 'workspace-1',
      triggerPayload: {
        source: 'skillify-native',
        provider: 'Skillify',
        objectType: 'scheduling-event',
        event: 'scheduling.reminder.due',
        externalId: 'appointment-1',
        occurredAt: '2026-10-01T13:00:00.000Z',
        simpleEventKey: 'native:scheduling-reminder:reminder-1',
        reminderScheduleId: 'reminder-1',
        reminderClaimedBy: 'reminder-worker-1',
        scheduleRevision: reminderMetadata.scheduleRevision,
        eventStartsAtUtc,
        offsetMinutes: 60,
        raw: reminderMetadata,
      },
    }

    function eligibleOccurrence(overrides: Record<string, unknown> = {}) {
      return {
        id: 'appointment-1',
        workspaceId: 'workspace-1',
        eventTypeKey: 'serviceAppointment',
        title: 'Spring Cleanup',
        status: 'SCHEDULED',
        startsAtUtc: new Date(eventStartsAtUtc),
        deletedAt: null,
        occurrenceOriginalAt: null,
        occurrenceState: null,
        recurrenceSeriesId: null,
        linkedRecordType: 'customer',
        linkedRecordId: 'customer-1',
        linkedRecordLabel: 'Ramirez Landscaping',
        assignments: [
          { workspaceMemberId: 'member-1', teamId: null },
          { workspaceMemberId: null, teamId: 'team-1' },
        ],
        ...overrides,
      }
    }

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-01T13:00:00.000Z'))
      getWorkspacePlanMock.mockResolvedValue('Basic')
      prismaMocks.automation.findFirst.mockResolvedValue(
        activeAutomation({
          flow: appointmentFlow,
          simpleAutomationInstallation: {
            id: 'installation-1',
            config: {
              'reminder-offset': '1-hour',
              'notification-channel': 'in-app',
              recipient: 'appointment-assignees-or-owner',
            },
          },
        }),
      )
      prismaMocks.schedulingReminderSchedule.findFirst.mockResolvedValue({
        metadata: reminderMetadata,
        eventStartsAtUtc: new Date(eventStartsAtUtc),
        offsetMinutes: 60,
        claimedBy: 'reminder-worker-1',
      })
      prismaMocks.schedulingEvent.findFirst.mockResolvedValue(
        eligibleOccurrence(),
      )
      prismaMocks.workspaceMember.findMany.mockResolvedValue([
        { id: 'member-1', userId: 'assignee-user-1' },
      ])
      prismaMocks.workspaceTeam.findMany.mockResolvedValue([
        {
          id: 'team-1',
          members: [
            {
              workspaceMember: {
                id: 'member-1',
                userId: 'assignee-user-1',
                workspaceId: 'workspace-1',
              },
            },
            {
              workspaceMember: {
                id: 'member-2',
                userId: 'assignee-user-2',
                workspaceId: 'workspace-1',
              },
            },
          ],
        },
      ])
      prismaMocks.$queryRaw.mockResolvedValue([{ id: 'appointment-1' }])
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('creates one run with deduplicated notifications for current assignees', async () => {
      await expect(
        runAutomation('automation-1', appointmentOptions),
      ).resolves.toBe('run-1')

      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledTimes(2)
      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            recipientUserId: 'assignee-user-1',
            recipientWorkspaceMemberId: 'member-1',
            title: 'Appointment reminder',
            body: 'Appointment in 1 hour: Spring Cleanup with Ramirez Landscaping.',
            entityType: 'SchedulingEvent',
            entityId: 'appointment-1',
          }),
        }),
      )
      expect(prismaMocks.automationRun.create).toHaveBeenCalledTimes(1)
    })

    it('falls back to the workspace owner when the appointment is unassigned', async () => {
      prismaMocks.schedulingEvent.findFirst.mockResolvedValueOnce(
        eligibleOccurrence({ assignments: [] }),
      )
      prismaMocks.workspaceMember.findMany.mockResolvedValueOnce([])
      prismaMocks.workspaceTeam.findMany.mockResolvedValueOnce([])

      await runAutomation('automation-1', appointmentOptions)

      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            recipientType: 'workspaceOwner',
            recipientUserId: 'owner-1',
            recipientWorkspaceMemberId: null,
          }),
        }),
      )
    })

    it.each([
      ['rescheduled', { startsAtUtc: new Date('2026-10-01T15:00:00.000Z') }],
      ['canceled', { status: 'CANCELED' }],
      ['completed', { status: 'COMPLETED' }],
      ['missed', { status: 'MISSED' }],
      ['deleted', { deletedAt: new Date() }],
      ['wrong type', { eventTypeKey: 'internalMeeting' }],
      ['superseded', { occurrenceState: 'SUPERSEDED' }],
    ])('fails closed when the occurrence is %s', async (_label, state) => {
      prismaMocks.schedulingEvent.findFirst.mockResolvedValueOnce(
        eligibleOccurrence(state),
      )

      await expect(
        runAutomation('automation-1', appointmentOptions),
      ).rejects.toThrow('Managed Appointment Reminder is no longer current.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('fails closed when persisted reminder identity changed', async () => {
      prismaMocks.schedulingReminderSchedule.findFirst.mockResolvedValueOnce({
        metadata: {
          ...reminderMetadata,
          scheduleRevision: 'new-revision',
        },
        eventStartsAtUtc: new Date(eventStartsAtUtc),
        offsetMinutes: 60,
        claimedBy: 'reminder-worker-1',
      })

      await expect(
        runAutomation('automation-1', appointmentOptions),
      ).rejects.toThrow('Managed Appointment Reminder is no longer current.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('fences a stale reminder worker before notification insertion', async () => {
      prismaMocks.schedulingReminderSchedule.findFirst.mockResolvedValueOnce({
        metadata: reminderMetadata,
        eventStartsAtUtc: new Date(eventStartsAtUtc),
        offsetMinutes: 60,
        claimedBy: 'replacement-worker',
      })

      await expect(
        runAutomation('automation-1', appointmentOptions),
      ).rejects.toThrow('Appointment Reminder worker claim was lost.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it.each([
      ['exactly at start', eventStartsAtUtc],
      ['after start', '2026-10-01T14:00:01.000Z'],
    ])('does not insert an upcoming reminder %s', async (_label, currentTime) => {
      vi.setSystemTime(new Date(currentTime))

      await expect(
        runAutomation('automation-1', appointmentOptions),
      ).rejects.toThrow('Managed Appointment Reminder is no longer current.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('revalidates a racing plan downgrade before notification insertion', async () => {
      getWorkspacePlanMock
        .mockResolvedValueOnce('Basic')
        .mockResolvedValueOnce('Free')

      await expect(
        runAutomation('automation-1', appointmentOptions),
      ).rejects.toThrow('Managed Simple Automation is no longer eligible.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })
  })

  describe('native Job Completion Message delivery', () => {
    const completedAt = '2026-09-23T18:00:00.000Z'
    const completionFlow = {
      nodes: [
        { id: 'trigger', type: 'simple-job-completed-trigger', data: {} },
        {
          id: 'notify',
          type: 'simple-job-completion-notification',
          data: {
            definitionKey: 'job-completion-message',
            recipient: 'job-assignee-or-owner',
          },
        },
      ],
      edges: [{ id: 'trigger-notify', source: 'trigger', target: 'notify' }],
    }
    const completionOptions = {
      expectedWorkspaceId: 'workspace-1',
      triggerPayload: {
        source: 'skillify-native',
        event: 'job.completed',
        externalId: 'job-1',
        completedAt,
        completionRevision: '22222222-2222-4222-8222-222222222222',
        domainEventId: 'event-job-1',
        simpleEventKey: 'native:domain-event:event-job-1',
        raw: {
          source: 'skillify-native',
          workspaceId: 'workspace-1',
          jobId: 'job-1',
          title: 'Spring Cleanup',
          customerId: 'customer-1',
          customerDisplayName: 'Ramirez Landscaping',
          assignedMemberId: 'member-1',
          completedAt,
          completionRevision: '22222222-2222-4222-8222-222222222222',
          occurredAt: completedAt,
        },
      },
    }

    function eligibleJob(overrides: Record<string, unknown> = {}) {
      return {
        status: 'COMPLETED',
        completedAt: new Date(completedAt),
        assigneeMemberId: 'member-1',
        assignee: { userId: 'assignee-user-1', workspaceId: 'workspace-1' },
        ...overrides,
      }
    }

    beforeEach(() => {
      getWorkspacePlanMock.mockResolvedValue('Basic')
      prismaMocks.automation.findFirst.mockResolvedValue(
        activeAutomation({ flow: completionFlow }),
      )
      prismaMocks.job.findFirst.mockResolvedValue(eligibleJob())
      prismaMocks.domainOutboxEvent.findFirst.mockResolvedValue({
        id: 'event-job-1',
        payload: completionOptions.triggerPayload.raw,
      })
      prismaMocks.$queryRaw.mockResolvedValue([{ id: 'job-1' }])
    })

    it('notifies the current Job assignee with truthful internal copy', async () => {
      await expect(
        runAutomation('automation-1', completionOptions),
      ).resolves.toBe('run-1')

      expect(prismaMocks.job.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1', workspaceId: 'workspace-1' },
        }),
      )
      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId_deduplicationKey: {
              workspaceId: 'workspace-1',
              deduplicationKey:
                'simple:job-completion:native:domain-event:event-job-1',
            },
          },
          create: expect.objectContaining({
            recipientType: 'workspaceMember',
            recipientUserId: 'assignee-user-1',
            recipientWorkspaceMemberId: 'member-1',
            title: 'Job completed',
            body: 'Job completed: Spring Cleanup for Ramirez Landscaping',
            entityType: 'Job',
            entityId: 'job-1',
          }),
        }),
      )
    })

    it('falls back to the owner instead of using a foreign-workspace assignee', async () => {
      prismaMocks.job.findFirst.mockResolvedValueOnce(
        eligibleJob({
          assigneeMemberId: 'foreign-member',
          assignee: { userId: 'foreign-user', workspaceId: 'workspace-2' },
        }),
      )

      await runAutomation('automation-1', completionOptions)

      expect(prismaMocks.schedulingNotification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            recipientType: 'workspaceOwner',
            recipientUserId: 'owner-1',
            recipientWorkspaceMemberId: null,
          }),
        }),
      )
    })

    it.each([
      ['reopened', { status: 'IN_PROGRESS', completedAt: null }],
      [
        'recompleted',
        {
          status: 'COMPLETED',
          completedAt: new Date('2026-09-23T19:00:00.000Z'),
        },
      ],
    ])('fails closed when the Job was %s before delivery', async (_label, state) => {
      prismaMocks.job.findFirst.mockResolvedValueOnce(eligibleJob(state))

      await expect(
        runAutomation('automation-1', completionOptions),
      ).rejects.toThrow('Managed Job completion is no longer current.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('fences an in-flight occurrence superseded by recompletion', async () => {
      prismaMocks.domainOutboxEvent.findFirst.mockResolvedValueOnce(null)

      await expect(
        runAutomation('automation-1', completionOptions),
      ).rejects.toThrow('Managed Job completion is no longer current.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('rejects a persisted occurrence with a different completion revision', async () => {
      prismaMocks.domainOutboxEvent.findFirst.mockResolvedValueOnce({
        id: 'event-job-1',
        payload: {
          ...completionOptions.triggerPayload.raw,
          completionRevision: '33333333-3333-4333-8333-333333333333',
        },
      })

      await expect(
        runAutomation('automation-1', completionOptions),
      ).rejects.toThrow('Managed Job completion is no longer current.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('fails closed after a plan downgrade', async () => {
      getWorkspacePlanMock.mockResolvedValueOnce('Free')

      await expect(
        runAutomation('automation-1', completionOptions),
      ).rejects.toThrow('Managed Simple Automation is no longer eligible.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })

    it('revalidates a racing plan downgrade at the insertion boundary', async () => {
      getWorkspacePlanMock
        .mockResolvedValueOnce('Basic')
        .mockResolvedValueOnce('Free')

      await expect(
        runAutomation('automation-1', completionOptions),
      ).rejects.toThrow('Managed Simple Automation is no longer eligible.')
      expect(prismaMocks.schedulingNotification.upsert).not.toHaveBeenCalled()
    })
  })
})
