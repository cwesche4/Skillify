import type {
  SchedulingEvent,
  SchedulingRecurrenceActionScope,
  SchedulingRecurringAction,
} from '@/lib/scheduling/types'

const occurrenceOnlyActions = new Set<SchedulingRecurringAction>([
  'complete',
  'statusChange',
])

const splitCapableActions = new Set<SchedulingRecurringAction>([
  'edit',
  'reschedule',
  'cancel',
  'delete',
  'assignmentChange',
  'linkedRecordChange',
  'recurrenceRuleChange',
])

export function isRecurringOccurrence(event: SchedulingEvent) {
  return Boolean(event.recurrenceSeriesId && event.occurrenceOriginalAt)
}

export function getAllowedRecurrenceScopes({
  action,
  occurrence,
}: {
  action: SchedulingRecurringAction
  occurrence: SchedulingEvent
}): SchedulingRecurrenceActionScope[] {
  if (!isRecurringOccurrence(occurrence)) return []
  if (action === 'complete') return ['thisOccurrence']
  if (occurrenceOnlyActions.has(action)) return ['thisOccurrence']
  if (splitCapableActions.has(action)) {
    return ['thisOccurrence', 'thisAndFollowing', 'entireSeries']
  }
  return ['thisOccurrence', 'entireSeries']
}

export function shouldPromptForRecurrenceScope({
  action,
  occurrence,
}: {
  action: SchedulingRecurringAction
  occurrence: SchedulingEvent
}) {
  return getAllowedRecurrenceScopes({ action, occurrence }).length > 1
}

export function normalizeRecurrenceScope(
  value: unknown,
): SchedulingRecurrenceActionScope {
  if (
    value === 'thisOccurrence' ||
    value === 'thisAndFollowing' ||
    value === 'entireSeries'
  ) {
    return value
  }
  return 'thisOccurrence'
}

export function recurrenceScopeLabel(scope: SchedulingRecurrenceActionScope) {
  if (scope === 'thisOccurrence') return 'This occurrence'
  if (scope === 'thisAndFollowing') return 'This and following'
  return 'Entire series'
}
