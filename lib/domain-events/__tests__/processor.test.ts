import { describe, expect, it, vi } from 'vitest'

import {
  processDomainEvent,
  processPendingDomainEvents,
  type DomainEventProcessorDependencies,
} from '@/lib/domain-events/processor'

const NOW = new Date('2026-09-23T15:00:00.000Z')

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-a',
    workspaceId: 'workspace-a',
    topic: 'lead.created',
    aggregateType: 'Lead',
    aggregateId: 'lead-a',
    attempts: 1,
    claimedBy: 'worker-a',
    payload: {
      source: 'skillify-native',
      workspaceId: 'workspace-a',
      leadId: 'lead-a',
      displayName: 'Taylor Smith',
      companyName: 'Smith Landscaping',
      email: 'taylor@example.com',
      phone: null,
      leadSource: 'Referral',
      assignedMemberId: 'member-a',
      occurredAt: NOW.toISOString(),
    },
    ...overrides,
  }
}

function followUpEvent(overrides: Record<string, unknown> = {}) {
  return event({
    topic: 'lead.follow_up_due',
    payload: {
      source: 'skillify-native',
      workspaceId: 'workspace-a',
      leadId: 'lead-a',
      scheduledFor: NOW.toISOString(),
      scheduleRevision: '11111111-1111-4111-8111-111111111111',
      occurredAt: new Date(NOW.getTime() - 60_000).toISOString(),
    },
    ...overrides,
  })
}

function jobCompletedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-job-a',
    workspaceId: 'workspace-a',
    topic: 'job.completed',
    aggregateType: 'Job',
    aggregateId: 'job-a',
    attempts: 1,
    claimedBy: 'worker-a',
    payload: {
      source: 'skillify-native',
      workspaceId: 'workspace-a',
      jobId: 'job-a',
      title: 'Spring Cleanup',
      customerId: 'customer-a',
      customerDisplayName: 'Ramirez Landscaping',
      assignedMemberId: 'member-a',
      completedAt: NOW.toISOString(),
      completionRevision: '22222222-2222-4222-8222-222222222222',
      occurredAt: NOW.toISOString(),
    },
    ...overrides,
  }
}

function hubSpotEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-hubspot-a',
    workspaceId: 'workspace-a',
    topic: 'integration.hubspot.webhook',
    aggregateType: 'HubSpotIntegration',
    aggregateId: 'integration-a',
    attempts: 1,
    claimedBy: 'worker-a',
    payload: {
      workspaceId: 'workspace-a',
      integrationId: 'integration-a',
      webhook: {
        provider: 'hubspot',
        objectType: 'contact',
        externalId: 'contact-a',
        event: 'contact.created',
        eventId: 'provider-event-a',
        occurredAt: NOW.getTime(),
        portalId: 'portal-a',
        payload: { objectId: 'contact-a' },
      },
    },
    ...overrides,
  }
}

function dependencies(
  overrides: Partial<DomainEventProcessorDependencies> = {},
) {
  const base: DomainEventProcessorDependencies = {
    claim: vi.fn(async () => event()),
    findInstallation: vi.fn(async ({ definitionKey }) => ({
      id: 'installation-a',
      workspaceId: 'workspace-a',
      definitionKey,
      definitionVersion:
        definitionKey === 'new-lead-alert' ? 1 : 2,
      config: {
        'notification-channel': 'in-app',
        recipient:
          definitionKey === 'lead-follow-up'
            ? 'lead-assignee-or-owner'
            : definitionKey === 'job-completion-message'
              ? 'job-assignee-or-owner'
              : 'workspace-owner',
      },
      automation: {
        id: 'automation-a',
        flow: { nodes: [{ id: 'trigger' }] },
      },
    })),
    findLeadFollowUpState: vi.fn(async () => ({
      stage: 'FOLLOW_UP',
      followUpAt: NOW,
      convertedCustomerId: null,
      archivedAt: null,
    })),
    findJobCompletionState: vi.fn(async () => ({
      status: 'COMPLETED',
      completedAt: NOW,
      archivedAt: null,
    })),
    getReadiness: vi.fn(async () => ({
      liveSupported: true,
      ready: true,
      nativeLeadEvents: true,
      requirements: [],
      crmProviders: [],
    })),
    dispatch: vi.fn(async () => ({
      dispatched: true as const,
      duplicate: false as const,
      runId: 'run-a',
    })) as DomainEventProcessorDependencies['dispatch'],
    processWebhook: vi.fn(async () => ({
      ok: true as const,
      triggered: 1,
    })),
    findDispatch: vi.fn(async () => ({
      id: 'dispatch-a',
      status: 'SUCCEEDED',
      runId: 'run-a',
    })),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    listPendingIds: vi.fn(async () => ['event-a']),
  }
  return { ...base, ...overrides }
}

describe('native domain event processor', () => {
  it('processes durable HubSpot ingress and preserves retryable failures', async () => {
    const processWebhook = vi
      .fn()
      .mockRejectedValueOnce(new Error('worker crashed'))
      .mockResolvedValueOnce({ ok: true as const, triggered: 1 })
    const deps = dependencies({
      claim: vi.fn(async () => hubSpotEvent()),
      processWebhook,
    })

    await expect(processDomainEvent('event-hubspot-a', deps, { now: NOW }))
      .resolves.toEqual({ status: 'failed', error: 'worker crashed' })
    await expect(processDomainEvent('event-hubspot-a', deps, { now: NOW }))
      .resolves.toEqual({ status: 'processed', triggered: 1 })

    expect(processWebhook).toHaveBeenLastCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-a',
        integrationId: 'integration-a',
      }),
    )
    expect(deps.complete).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'HUBSPOT_WEBHOOK_PROCESSED' }),
    )
  })

  it('fails closed for a forged durable HubSpot workspace identity', async () => {
    const forged = hubSpotEvent()
    const deps = dependencies({
      claim: vi.fn(async () => ({
        ...forged,
        payload: { ...forged.payload, workspaceId: 'workspace-b' },
      })),
    })

    const result = await processDomainEvent('event-hubspot-a', deps, {
      now: NOW,
    })

    expect(result.status).toBe('failed')
    expect(deps.processWebhook).not.toHaveBeenCalled()
  })
  it('routes an eligible native Lead snapshot through the durable dispatch', async () => {
    const deps = dependencies()
    const result = await processDomainEvent('event-a', deps, {
      now: NOW,
      workerId: 'worker-a',
    })

    expect(result).toEqual({ status: 'dispatched', runId: 'run-a' })
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: 'installation-a',
        automationId: 'automation-a',
        workspaceId: 'workspace-a',
        eventKey: 'native:domain-event:event-a',
        triggerPayload: expect.objectContaining({
          source: 'skillify-native',
          externalId: 'lead-a',
          raw: expect.objectContaining({ displayName: 'Taylor Smith' }),
        }),
      }),
    )
    expect(deps.complete).toHaveBeenCalledWith({
      eventId: 'event-a',
      workerId: 'worker-a',
      now: NOW,
      outcome: 'DISPATCHED',
      dispatchId: 'dispatch-a',
      runId: 'run-a',
    })
  })

  it('routes an eligible due follow-up through the Lead Follow-Up installation', async () => {
    const deps = dependencies({
      claim: vi.fn(async () => followUpEvent()),
    })

    const result = await processDomainEvent('event-a', deps, { now: NOW })

    expect(result).toEqual({ status: 'dispatched', runId: 'run-a' })
    expect(deps.findInstallation).toHaveBeenCalledWith({
      workspaceId: 'workspace-a',
      definitionKey: 'lead-follow-up',
    })
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'native:domain-event:event-a',
        triggerPayload: expect.objectContaining({
          event: 'lead.follow_up_due',
          scheduledFor: NOW.toISOString(),
          scheduleRevision: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    )
  })

  it('routes a current Job completion through Job Completion Message', async () => {
    const deps = dependencies({
      claim: vi.fn(async () => jobCompletedEvent()),
    })

    const result = await processDomainEvent('event-job-a', deps, { now: NOW })

    expect(result).toEqual({ status: 'dispatched', runId: 'run-a' })
    expect(deps.findInstallation).toHaveBeenCalledWith({
      workspaceId: 'workspace-a',
      definitionKey: 'job-completion-message',
    })
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'native:domain-event:event-job-a',
        triggerPayload: expect.objectContaining({
          event: 'job.completed',
          externalId: 'job-a',
          completionRevision: '22222222-2222-4222-8222-222222222222',
        }),
      }),
    )
  })

  it.each([
    ['reopened', { status: 'IN_PROGRESS', completedAt: null }],
    [
      'recompleted with a different occurrence',
      { status: 'COMPLETED', completedAt: new Date(NOW.getTime() + 60_000) },
    ],
  ])('terminally no-ops when a Job completion is %s', async (_label, state) => {
    const deps = dependencies({
      claim: vi.fn(async () => jobCompletedEvent()),
      findJobCompletionState: vi.fn(async () => ({
        archivedAt: null,
        ...state,
      })),
    })

    const result = await processDomainEvent('event-job-a', deps, { now: NOW })

    expect(result).toEqual({
      status: 'no-op',
      reason: 'job-completion-stale',
    })
    expect(deps.dispatch).not.toHaveBeenCalled()
  })

  it('allows an archived Job completion because the V1 action is historical and internal', async () => {
    const deps = dependencies({
      claim: vi.fn(async () => jobCompletedEvent()),
      findJobCompletionState: vi.fn(async () => ({
        status: 'COMPLETED',
        completedAt: NOW,
        archivedAt: NOW,
      })),
    })

    await expect(
      processDomainEvent('event-job-a', deps, { now: NOW }),
    ).resolves.toEqual({ status: 'dispatched', runId: 'run-a' })
  })

  it('fails closed for a cross-workspace Job completion payload', async () => {
    const forged = jobCompletedEvent()
    const deps = dependencies({
      claim: vi.fn(async () => ({
        ...forged,
        payload: { ...forged.payload, workspaceId: 'workspace-b' },
      })),
    })

    const result = await processDomainEvent('event-job-a', deps, { now: NOW })

    expect(result.status).toBe('failed')
    expect(deps.findJobCompletionState).not.toHaveBeenCalled()
    expect(deps.dispatch).not.toHaveBeenCalled()
  })

  it.each([
    ['won', { stage: 'WON' }],
    ['lost', { stage: 'LOST' }],
    ['converted', { convertedCustomerId: 'customer-a' }],
    ['archived', { archivedAt: NOW }],
    ['cleared', { followUpAt: null }],
    ['rescheduled', { followUpAt: new Date(NOW.getTime() + 60_000) }],
  ])('terminally no-ops when a due follow-up is %s', async (_label, state) => {
    const deps = dependencies({
      claim: vi.fn(async () => followUpEvent()),
      findLeadFollowUpState: vi.fn(async () => ({
        stage: 'FOLLOW_UP',
        followUpAt: NOW,
        convertedCustomerId: null,
        archivedAt: null,
        ...state,
      })),
    })

    const result = await processDomainEvent('event-a', deps, { now: NOW })

    expect(result).toEqual({
      status: 'no-op',
      reason: 'follow-up-stale-or-ineligible',
    })
    expect(deps.dispatch).not.toHaveBeenCalled()
    expect(deps.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'NO_OP_FOLLOW_UP_STALE_OR_INELIGIBLE',
      }),
    )
  })

  it('cannot process a future follow-up that was not claimed as due', async () => {
    const deps = dependencies({ claim: vi.fn(async () => null) })

    await expect(
      processDomainEvent('future-event', deps, { now: NOW }),
    ).resolves.toEqual({ status: 'not-claimed' })
    expect(deps.findInstallation).not.toHaveBeenCalled()
    expect(deps.dispatch).not.toHaveBeenCalled()
  })

  it('fails closed for a cross-workspace follow-up payload', async () => {
    const forged = followUpEvent()
    const deps = dependencies({
      claim: vi.fn(async () => ({
        ...forged,
        payload: { ...forged.payload, workspaceId: 'workspace-b' },
      })),
    })

    const result = await processDomainEvent('event-a', deps, { now: NOW })

    expect(result.status).toBe('failed')
    expect(deps.findLeadFollowUpState).not.toHaveBeenCalled()
    expect(deps.findInstallation).not.toHaveBeenCalled()
    expect(deps.dispatch).not.toHaveBeenCalled()
  })

  it('reconciles a repeated event to its existing successful run', async () => {
    const deps = dependencies({
      dispatch: vi.fn(async () => ({
        dispatched: false as const,
        duplicate: true as const,
      })) as DomainEventProcessorDependencies['dispatch'],
    })

    const result = await processDomainEvent('event-a', deps, { now: NOW })

    expect(result).toEqual({ status: 'dispatched', runId: 'run-a' })
    expect(deps.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 'dispatch-a',
        runId: 'run-a',
      }),
    )
  })

  it.each([
    ['no active installation', null, 'NO_OP_NO_ACTIVE_INSTALLATION'],
    [
      'an installation without a compiled flow',
      {
        id: 'installation-a',
        workspaceId: 'workspace-a',
        definitionKey: 'new-lead-alert',
        definitionVersion: 1,
        config: {},
        automation: { id: 'automation-a', flow: null },
      },
      'NO_OP_INSTALLATION_NOT_EXECUTABLE',
    ],
  ])('terminally no-ops for %s', async (_label, installation, outcome) => {
    const deps = dependencies({
      findInstallation: vi.fn(async () => installation),
    })

    const result = await processDomainEvent('event-a', deps, { now: NOW })

    expect(result.status).toBe('no-op')
    expect(deps.dispatch).not.toHaveBeenCalled()
    expect(deps.complete).toHaveBeenCalledWith(
      expect.objectContaining({ outcome }),
    )
  })

  it('terminally no-ops when native plan/workspace readiness is absent', async () => {
    const deps = dependencies({
      getReadiness: vi.fn(async () => ({
        liveSupported: true,
        ready: true,
        nativeLeadEvents: false,
        requirements: [],
        crmProviders: ['hubspot'],
      })),
    })

    const result = await processDomainEvent('event-a', deps, { now: NOW })

    expect(result).toEqual({ status: 'no-op', reason: 'not-eligible' })
    expect(deps.dispatch).not.toHaveBeenCalled()
  })

  it.each([
    ['workspace', { workspaceId: 'workspace-b' }],
    ['aggregate', { leadId: 'lead-b' }],
  ])(
    'fails closed when payload %s identity is forged',
    async (_label, forged) => {
      const deps = dependencies({
        claim: vi.fn(async () =>
          event({ payload: { ...event().payload, ...forged } }),
        ),
      })

      const result = await processDomainEvent('event-a', deps, { now: NOW })

      expect(result.status).toBe('failed')
      expect(deps.findInstallation).not.toHaveBeenCalled()
      expect(deps.dispatch).not.toHaveBeenCalled()
      expect(deps.fail).toHaveBeenCalledOnce()
    },
  )

  it('keeps a failed execution recoverable instead of marking it processed', async () => {
    const deps = dependencies({
      dispatch: vi.fn(async () => {
        throw new Error('Delivery failed')
      }) as DomainEventProcessorDependencies['dispatch'],
    })

    const result = await processDomainEvent('event-a', deps, { now: NOW })

    expect(result).toEqual({ status: 'failed', error: 'Delivery failed' })
    expect(deps.fail).toHaveBeenCalledOnce()
    expect(deps.complete).not.toHaveBeenCalled()
  })

  it('terminally no-ops when lifecycle changes during dispatch', async () => {
    const deps = dependencies({
      dispatch: vi.fn(async () => {
        throw new Error('Automation is not active')
      }) as DomainEventProcessorDependencies['dispatch'],
      findDispatch: vi.fn(async () => ({
        id: 'dispatch-a',
        status: 'CANCELLED',
        runId: 'run-a',
      })),
    })

    const result = await processDomainEvent('event-a', deps, { now: NOW })

    expect(result).toEqual({ status: 'no-op', reason: 'lifecycle-changed' })
    expect(deps.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'NO_OP_LIFECYCLE_CHANGED',
        dispatchId: 'dispatch-a',
      }),
    )
    expect(deps.fail).not.toHaveBeenCalled()
  })

  it('reconciles an existing successful dispatch after event finalization fails', async () => {
    const complete = vi
      .fn()
      .mockRejectedValueOnce(new Error('outbox finalization unavailable'))
      .mockResolvedValueOnce(undefined)
    const dispatch = vi
      .fn()
      .mockResolvedValueOnce({
        dispatched: true,
        duplicate: false,
        runId: 'run-a',
      })
      .mockResolvedValueOnce({
        dispatched: false,
        duplicate: true,
      }) as DomainEventProcessorDependencies['dispatch']
    const deps = dependencies({ complete, dispatch })

    await expect(
      processDomainEvent('event-a', deps, { now: NOW }),
    ).resolves.toMatchObject({ status: 'failed' })
    await expect(
      processDomainEvent('event-a', deps, { now: NOW }),
    ).resolves.toEqual({ status: 'dispatched', runId: 'run-a' })

    expect(deps.findDispatch).toHaveBeenCalledTimes(2)
    expect(complete).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outcome: 'DISPATCHED',
        dispatchId: 'dispatch-a',
        runId: 'run-a',
      }),
    )
  })

  it('provides a bounded pending-event recovery drain', async () => {
    const deps = dependencies()
    const result = await processPendingDomainEvents(
      { limit: 500, now: NOW, workerId: 'recovery-worker' },
      deps,
    )

    expect(deps.listPendingIds).toHaveBeenCalledWith({ now: NOW, limit: 100 })
    expect(result).toEqual({
      considered: 1,
      dispatched: 1,
      noOp: 0,
      failed: 0,
    })
  })
})
