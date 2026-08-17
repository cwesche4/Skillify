import type { CalendarConflictPolicy } from '@prisma/client'

import type { ProviderEventPayload } from '@/lib/scheduling/providers/types'

export type CalendarSyncConflictDecision = {
  type:
    | 'changedBothPlaces'
    | 'providerDeleted'
    | 'skillifyDeleted'
    | 'recurrenceChanged'
    | 'timezoneChanged'
  safeMessage: string
  metadata: Record<string, unknown>
}

function asTime(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

export function detectCalendarSyncConflict({
  providerEvent,
  skillifyEventUpdatedAt,
  mappingProviderUpdatedAt,
  conflictPolicy,
}: {
  providerEvent: ProviderEventPayload
  skillifyEventUpdatedAt: string
  mappingProviderUpdatedAt?: string | null
  conflictPolicy: CalendarConflictPolicy
}): CalendarSyncConflictDecision | null {
  if (providerEvent.status === 'cancelled') {
    return {
      type: 'providerDeleted',
      safeMessage: 'The Google Calendar event was deleted.',
      metadata: { conflictPolicy },
    }
  }

  const providerUpdatedAt = asTime(providerEvent.providerUpdatedAt)
  const mappingUpdatedAt = asTime(mappingProviderUpdatedAt)
  const skillifyUpdatedAt = asTime(skillifyEventUpdatedAt)
  if (
    providerUpdatedAt !== null &&
    mappingUpdatedAt !== null &&
    skillifyUpdatedAt !== null &&
    providerUpdatedAt > mappingUpdatedAt &&
    skillifyUpdatedAt > mappingUpdatedAt
  ) {
    return {
      type: 'changedBothPlaces',
      safeMessage:
        'This event changed in Skillify and Google Calendar since the last sync.',
      metadata: {
        providerUpdatedAt: providerEvent.providerUpdatedAt,
        skillifyEventUpdatedAt,
        mappingProviderUpdatedAt,
        conflictPolicy,
      },
    }
  }

  if (providerEvent.recurrence?.length && providerEvent.recurringEventId) {
    return {
      type: 'recurrenceChanged',
      safeMessage:
        'Google Calendar reported a recurrence change that needs review in Skillify.',
      metadata: {
        recurringEventId: providerEvent.recurringEventId,
        recurrence: providerEvent.recurrence,
        conflictPolicy,
      },
    }
  }

  return null
}

export function resolveCalendarConflictByPolicy({
  conflictType,
  policy,
}: {
  conflictType: CalendarSyncConflictDecision['type']
  policy: CalendarConflictPolicy
}) {
  if (policy === 'ASK_USER') {
    return {
      resolution: 'askUser',
      shouldApplyProvider: false,
      shouldApplySkillify: false,
    }
  }
  if (policy === 'PROVIDER_WINS') {
    return {
      resolution:
        conflictType === 'providerDeleted'
          ? 'acceptProviderDelete'
          : 'providerWins',
      shouldApplyProvider: true,
      shouldApplySkillify: false,
    }
  }
  return {
    resolution: 'skillifyWins',
    shouldApplyProvider: false,
    shouldApplySkillify: true,
  }
}
