import type { SchedulingEventStatus } from '@/lib/scheduling/types'

export type SchedulingEventStatusTransition = {
  from: SchedulingEventStatus
  to: SchedulingEventStatus
}

export type SchedulingEventStatusEffect = {
  consumesAvailability: boolean
  shouldCancelProviderEvent: boolean
  shouldNotifyAssignees: boolean
  shouldNotifyAttendees: boolean
  completedAt?: true
  canceledAt?: true
}

const allowedTransitions: Record<
  SchedulingEventStatus,
  SchedulingEventStatus[]
> = {
  scheduled: ['confirmed', 'inProgress', 'completed', 'canceled', 'missed'],
  confirmed: ['scheduled', 'inProgress', 'completed', 'canceled', 'missed'],
  inProgress: ['completed', 'canceled', 'missed'],
  completed: ['scheduled', 'confirmed'],
  canceled: ['scheduled', 'confirmed'],
  missed: ['scheduled', 'confirmed'],
}

const availabilityConsumingStatuses = new Set<SchedulingEventStatus>([
  'scheduled',
  'confirmed',
  'inProgress',
])

export function doesSchedulingStatusConsumeAvailability(
  status: SchedulingEventStatus,
): boolean {
  return availabilityConsumingStatuses.has(status)
}

export function canTransitionSchedulingEventStatus({
  from,
  to,
}: SchedulingEventStatusTransition): boolean {
  return from === to || allowedTransitions[from]?.includes(to) === true
}

export function assertSchedulingEventStatusTransition(
  transition: SchedulingEventStatusTransition,
): void {
  if (!canTransitionSchedulingEventStatus(transition)) {
    throw new Error(
      `Cannot change scheduling event status from ${transition.from} to ${transition.to}.`,
    )
  }
}

export function getSchedulingStatusTransitionEffect({
  from,
  to,
}: SchedulingEventStatusTransition): SchedulingEventStatusEffect {
  assertSchedulingEventStatusTransition({ from, to })

  return {
    consumesAvailability: doesSchedulingStatusConsumeAvailability(to),
    shouldCancelProviderEvent: to === 'canceled',
    shouldNotifyAssignees: from !== to,
    shouldNotifyAttendees:
      from !== to && ['confirmed', 'canceled'].includes(to),
    completedAt: to === 'completed' ? true : undefined,
    canceledAt: to === 'canceled' ? true : undefined,
  }
}
