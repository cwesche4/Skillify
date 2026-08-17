import { describe, expect, it } from 'vitest'

import {
  categoryFromSchedulingOutboxTopic,
  isUserFacingSchedulingOutboxTopic,
} from '@/lib/scheduling/notifications/notificationPolicy'
import {
  resolveQuietHoursDelivery,
  resolveSchedulingNotificationPreference,
} from '@/lib/scheduling/notifications/preferences'
import { resolveSchedulingNotificationRecipients } from '@/lib/scheduling/notifications/recipientResolution'
import { renderSchedulingNotificationTemplate } from '@/lib/scheduling/notifications/templates'
import { classifySchedulingNotificationChanges } from '@/lib/scheduling/notifications/changeClassification'
import {
  clearDevelopmentSchedulingEmailMessages,
  DevelopmentSchedulingEmailProvider,
  getDevelopmentSchedulingEmailMessages,
} from '@/lib/scheduling/notifications/emailProvider'
import type { SchedulingEvent } from '@/lib/scheduling/types'

function event(overrides: Partial<SchedulingEvent> = {}): SchedulingEvent {
  return {
    id: 'event-1',
    workspaceId: 'workspace-1',
    title: 'Discovery Call',
    type: 'discoveryCall',
    status: 'scheduled',
    startsAt: '2026-07-28T14:00:00.000Z',
    endsAt: '2026-07-28T15:00:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
    assignedMemberIds: ['member-1'],
    createdAt: '2026-07-28T12:00:00.000Z',
    updatedAt: '2026-07-28T12:00:00.000Z',
    ...overrides,
  }
}

describe('scheduling notification policy', () => {
  it('maps user-facing outbox topics to notification categories', () => {
    expect(
      categoryFromSchedulingOutboxTopic('scheduling.event.updated', {
        rescheduled: true,
      }),
    ).toBe('rescheduled')
    expect(
      categoryFromSchedulingOutboxTopic('scheduling.event.updated', {
        changedFields: ['assignedMemberIds'],
      }),
    ).toBe('eventUpdated')
    expect(
      categoryFromSchedulingOutboxTopic('scheduling.event.canceled', {}),
    ).toBe('canceled')
    expect(isUserFacingSchedulingOutboxTopic('scheduling.sync.requested')).toBe(
      false,
    )
    expect(
      categoryFromSchedulingOutboxTopic('scheduling.sync.requested', {}),
    ).toBeNull()
  })

  it('classifies only meaningful scheduling changes', () => {
    expect(
      classifySchedulingNotificationChanges({
        before: event(),
        after: event(),
        changedFields: ['generatedThroughUtc'],
        topic: 'scheduling.event.updated',
      }).suppressUserNotification,
    ).toBe(true)

    const rescheduled = classifySchedulingNotificationChanges({
      before: event(),
      after: event({ startsAt: '2026-07-29T14:00:00.000Z' }),
      topic: 'scheduling.event.updated',
    })
    expect(rescheduled.categories).toContain('rescheduled')
    expect(rescheduled.changedFields).toContain('startsAt')
  })
})

describe('scheduling notification recipients', () => {
  it('dedupes assigned members, expands teams, and excludes the actor by default', () => {
    const recipients = resolveSchedulingNotificationRecipients({
      assignedMemberIds: ['member-1'],
      assignedTeamIds: ['team-1'],
      members: [
        {
          workspaceMemberId: 'member-1',
          userId: 'actor-1',
          label: 'Owner',
          email: 'owner@example.com',
        },
        {
          workspaceMemberId: 'member-2',
          userId: 'user-2',
          label: 'Dispatcher',
          email: 'dispatcher@example.com',
        },
      ],
      teams: [
        {
          teamId: 'team-1',
          label: 'Office Team',
          memberIds: ['member-1', 'member-2'],
        },
      ],
      category: 'assignment',
      actorUserId: 'actor-1',
    })

    expect(recipients).toHaveLength(1)
    expect(recipients[0]).toMatchObject({
      type: 'workspaceMember',
      workspaceMemberId: 'member-2',
    })
  })

  it('keeps external attendees opt-in and separate from workspace members', () => {
    expect(
      resolveSchedulingNotificationRecipients({
        assignedMemberIds: [],
        members: [],
        attendees: [
          {
            attendeeId: 'attendee-1',
            email: 'Guest@Example.com',
            displayName: 'Guest',
          },
        ],
        category: 'reminder',
        includeExternalAttendees: false,
      }),
    ).toHaveLength(0)

    expect(
      resolveSchedulingNotificationRecipients({
        assignedMemberIds: [],
        members: [],
        attendees: [
          {
            attendeeId: 'attendee-1',
            email: 'Guest@Example.com',
            displayName: 'Guest',
          },
        ],
        category: 'reminder',
        includeExternalAttendees: true,
        reminderRecipientGroup: 'externalAttendees',
      })[0],
    ).toMatchObject({
      type: 'externalAttendee',
      email: 'guest@example.com',
    })
  })
})

describe('scheduling notification preferences', () => {
  it('keeps email off unless workspace or member preferences enable it', () => {
    expect(
      resolveSchedulingNotificationPreference({
        category: 'assignment',
        channel: 'email',
        recipientType: 'workspaceMember',
        workspaceTimezone: 'America/New_York',
      }).emailEnabled,
    ).toBe(false)

    expect(
      resolveSchedulingNotificationPreference({
        workspacePreferences: {
          schedulingEnabled: true,
          inAppEnabled: true,
          emailEnabled: true,
          externalAttendeesEnabled: false,
          linkedClientsEnabled: false,
          organizerCopiesEnabled: true,
          deliveryFailureAlertsEnabled: true,
        },
        category: 'assignment',
        channel: 'email',
        recipientType: 'workspaceMember',
        workspaceTimezone: 'America/New_York',
      }).emailEnabled,
    ).toBe(true)
  })

  it('blocks external recipients unless explicitly enabled', () => {
    const preference = resolveSchedulingNotificationPreference({
      category: 'reminder',
      recipientType: 'externalAttendee',
      workspaceTimezone: 'America/New_York',
    })

    expect(preference.categoryEnabled).toBe(false)
    expect(preference.reason).toBe('externalAttendeesDisabled')
  })

  it('defers quiet-hours email unless deferral would miss the event', () => {
    expect(
      resolveQuietHoursDelivery({
        intendedDeliveryUtc: new Date('2026-07-28T23:30:00.000Z'),
        eventStartUtc: new Date('2026-07-29T08:00:00.000Z'),
        recipientTimezone: 'UTC',
        priority: 'normal',
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '07:00',
          timezone: 'UTC',
        },
      }),
    ).toMatchObject({
      action: 'defer',
      deferUntilUtc: new Date('2026-07-29T07:00:00.000Z'),
    })

    expect(
      resolveQuietHoursDelivery({
        intendedDeliveryUtc: new Date('2026-07-28T23:30:00.000Z'),
        eventStartUtc: new Date('2026-07-29T06:00:00.000Z'),
        recipientTimezone: 'UTC',
        priority: 'normal',
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '07:00',
          timezone: 'UTC',
        },
      }),
    ).toEqual({ action: 'skip', reason: 'quietHoursWouldMissEvent' })
  })
})

describe('scheduling notification templates and email provider', () => {
  it('escapes content and hides workspace action links from external recipients', () => {
    const rendered = renderSchedulingNotificationTemplate({
      category: 'reminder',
      recipientType: 'externalAttendee',
      workspaceName: 'Skillify <HQ>',
      eventTitle: 'Visit <script>',
      startsAt: '2026-07-28T14:00:00.000Z',
      endsAt: '2026-07-28T15:00:00.000Z',
      timezone: 'America/New_York',
      recurrenceSummary: 'Weekly',
      actionUrl: '/dashboard/acme/scheduling',
    })

    expect(rendered.html).toContain('Skillify &lt;HQ&gt;')
    expect(rendered.html).toContain('Visit &lt;script&gt;')
    expect(rendered.html).not.toContain('Open in Skillify')
    expect(rendered.text).not.toContain('/dashboard/acme/scheduling')
    expect(rendered.body).not.toContain('Recurrence:')
  })

  it('records deterministic delivery results in the development email adapter', async () => {
    clearDevelopmentSchedulingEmailMessages()
    const provider = new DevelopmentSchedulingEmailProvider()
    const result = await provider.send({
      to: 'member@example.com',
      subject: 'Scheduling reminder',
      html: '<p>Reminder</p>',
      text: 'Reminder',
      idempotencyKey: 'workspace-1:delivery-1',
    })

    expect(result).toMatchObject({
      status: 'sent',
      provider: 'development',
      providerMessageId: 'dev-workspace-1:delivery-1',
    })
    expect(getDevelopmentSchedulingEmailMessages()).toHaveLength(1)
  })
})
