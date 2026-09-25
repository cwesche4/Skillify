import { describe, expect, it } from 'vitest'

import {
  buildScheduleChangeSnapshot,
  normalizedScheduleAssignmentKeys,
} from '@/lib/automations/simpleScheduleChangeNotification'
import { compileSimpleAutomation } from '@/lib/automations/simpleAutomationCompiler'
import { evaluateSimpleAutomationReadiness } from '@/lib/automations/simpleAutomationReadiness'
import { getSimpleAutomationDefinition } from '@/lib/automations/simpleAutomationCatalog'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'

const base = {
  eventId: 'event-1',
  eventTypeKey: 'serviceAppointment',
  title: 'Spring Cleanup',
  timezone: 'America/New_York',
  recurrenceSeriesId: null,
  occurrenceOriginalAt: null,
  occurrenceState: null,
  scope: 'single' as const,
}

const state = (
  startsAtUtc: string,
  status = 'scheduled',
  assignments: Array<{ workspaceMemberId?: string; teamId?: string }> = [],
) => ({ startsAtUtc: new Date(startsAtUtc), status, assignments })

describe('Schedule Change Notification V2 semantics', () => {
  it('creates a stable occurrence for a time change', () => {
    const input = {
      ...base,
      before: state('2026-11-01T17:00:00.000Z'),
      after: state('2026-11-01T19:00:00.000Z'),
    }
    const first = buildScheduleChangeSnapshot(input)
    const retry = buildScheduleChangeSnapshot(input)

    expect(first?.changeTypes).toEqual(['time'])
    expect(retry?.revision).toBe(first?.revision)
    expect(first?.before.startsAtUtc).toBe('2026-11-01T17:00:00.000Z')
    expect(first?.after.startsAtUtc).toBe('2026-11-01T19:00:00.000Z')
  })

  it('creates distinct identities for rapid successive changes', () => {
    const first = buildScheduleChangeSnapshot({
      ...base,
      before: state('2026-10-01T18:00:00.000Z'),
      after: state('2026-10-01T20:00:00.000Z'),
    })
    const second = buildScheduleChangeSnapshot({
      ...base,
      before: state('2026-10-01T20:00:00.000Z'),
      after: state('2026-10-01T21:00:00.000Z'),
    })

    expect(first?.revision).not.toBe(second?.revision)
  })

  it('distinguishes reversible assignment transitions', () => {
    const aToB = buildScheduleChangeSnapshot({
      ...base,
      before: state('2026-10-01T18:00:00.000Z', 'scheduled', [
        { workspaceMemberId: 'member-a' },
      ]),
      after: state('2026-10-01T18:00:00.000Z', 'scheduled', [
        { workspaceMemberId: 'member-b' },
      ]),
    })
    const bToA = buildScheduleChangeSnapshot({
      ...base,
      before: state('2026-10-01T18:00:00.000Z', 'scheduled', [
        { workspaceMemberId: 'member-b' },
      ]),
      after: state('2026-10-01T18:00:00.000Z', 'scheduled', [
        { workspaceMemberId: 'member-a' },
      ]),
    })

    expect(aToB?.revision).not.toBe(bToA?.revision)
  })

  it('set-compares assignments and ignores ordering', () => {
    expect(
      normalizedScheduleAssignmentKeys([
        { teamId: 'team-2' },
        { workspaceMemberId: 'member-1' },
        { teamId: 'team-1' },
        { workspaceMemberId: 'member-1' },
      ]),
    ).toEqual(['member:member-1', 'team:team-1', 'team:team-2'])

    expect(
      buildScheduleChangeSnapshot({
        ...base,
        before: state('2026-10-01T18:00:00.000Z', 'scheduled', [
          { workspaceMemberId: 'member-1' },
          { teamId: 'team-1' },
        ]),
        after: state('2026-10-01T18:00:00.000Z', 'scheduled', [
          { teamId: 'team-1' },
          { workspaceMemberId: 'member-1' },
        ]),
      }),
    ).toBeNull()
  })

  it('detects assignment replacement and cancellation', () => {
    const assignment = buildScheduleChangeSnapshot({
      ...base,
      before: state('2026-10-01T18:00:00.000Z', 'scheduled', [
        { workspaceMemberId: 'member-1' },
      ]),
      after: state('2026-10-01T18:00:00.000Z', 'scheduled', [
        { workspaceMemberId: 'member-2' },
      ]),
    })
    const cancellation = buildScheduleChangeSnapshot({
      ...base,
      before: state('2026-10-01T18:00:00.000Z'),
      after: state('2026-10-01T18:00:00.000Z', 'canceled'),
    })

    expect(assignment?.changeTypes).toEqual(['assignment'])
    expect(cancellation?.changeTypes).toEqual(['canceled'])
  })

  it('suppresses no-op, unrelated, ineligible, and materialization-only changes', () => {
    const unchanged = state('2026-10-01T18:00:00.000Z')
    expect(
      buildScheduleChangeSnapshot({ ...base, before: unchanged, after: unchanged }),
    ).toBeNull()
    expect(
      buildScheduleChangeSnapshot({
        ...base,
        eventTypeKey: 'internalMeeting',
        before: state('2026-10-01T18:00:00.000Z'),
        after: state('2026-10-01T20:00:00.000Z'),
      }),
    ).toBeNull()
    expect(
      buildScheduleChangeSnapshot({
        ...base,
        occurrenceState: 'MASTER',
        before: state('2026-10-01T18:00:00.000Z'),
        after: state('2026-10-01T20:00:00.000Z'),
      }),
    ).toBeNull()
  })

  it('keeps DST-separated UTC occurrences distinct', () => {
    const first = buildScheduleChangeSnapshot({
      ...base,
      occurrenceOriginalAt: new Date('2026-11-01T05:30:00.000Z'),
      before: state('2026-11-01T05:30:00.000Z'),
      after: state('2026-11-01T06:30:00.000Z'),
    })
    const second = buildScheduleChangeSnapshot({
      ...base,
      occurrenceOriginalAt: new Date('2026-11-01T06:30:00.000Z'),
      before: state('2026-11-01T06:30:00.000Z'),
      after: state('2026-11-01T07:30:00.000Z'),
    })
    expect(first?.revision).not.toBe(second?.revision)
  })

  it('publishes a truthful V2 catalog, compiler, and readiness contract', () => {
    const definition = getSimpleAutomationDefinition(
      'schedule-change-notification',
    )
    expect(definition).toMatchObject({
      definitionVersion: 2,
      availability: { state: 'available' },
    })
    expect(definition?.description).not.toMatch(/customer/i)

    const config = {
      changes: ['time', 'assignment', 'canceled'],
      'notification-channel': 'in-app',
      recipient: 'appointment-assignees-or-owner',
    }
    const first = compileSimpleAutomation({
      definitionKey: 'schedule-change-notification',
      definitionVersion: 2,
      config,
      workspaceContext: { crmProviders: [] },
    })
    const second = compileSimpleAutomation({
      definitionKey: 'schedule-change-notification',
      definitionVersion: 2,
      config,
      workspaceContext: { crmProviders: [] },
    })
    expect(second).toEqual(first)
    expect(first.nodes.map((node) => node.type)).toEqual([
      'simple-schedule-change-trigger',
      'simple-schedule-change-notification',
    ])

    expect(
      evaluateSimpleAutomationReadiness({
        definitionKey: 'schedule-change-notification',
        definitionVersion: 2,
        config,
        businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
        plan: 'Basic',
        canUseStarterAutomations: true,
        connectedCrmProviders: [],
      }),
    ).toMatchObject({ liveSupported: true, ready: true })

    expect(() =>
      compileSimpleAutomation({
        definitionKey: 'schedule-change-notification',
        definitionVersion: 1,
        config: {
          changes: ['time'],
          'notification-channel': 'email',
          recipient: 'customer',
        },
        workspaceContext: { crmProviders: [] },
      }),
    ).toThrow('Definition version 1 is not supported for activation.')
  })
})
