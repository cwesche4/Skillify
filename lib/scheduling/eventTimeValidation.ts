export class SchedulingEventTimeValidationError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'SchedulingEventTimeValidationError'
  }
}

export function validateSchedulingEventTimestampRange({
  startsAt,
  endsAt,
}: {
  startsAt: string
  endsAt: string
}) {
  if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) {
    throw new SchedulingEventTimeValidationError('Enter a valid start time.', {
      startTime: 'Enter a valid start time.',
    })
  }
  if (!endsAt || Number.isNaN(new Date(endsAt).getTime())) {
    throw new SchedulingEventTimeValidationError('Enter a valid end time.', {
      endTime: 'Enter a valid end time.',
    })
  }
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new SchedulingEventTimeValidationError(
      'End time must be later than start time.',
      {
        endTime: 'End time must be later than start time.',
      },
    )
  }
}
