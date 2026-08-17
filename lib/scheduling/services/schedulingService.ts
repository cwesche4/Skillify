import { prisma } from '@/lib/db'
import {
  SchedulingEventTimeValidationError,
  validateSchedulingEventTimestampRange,
} from '@/lib/scheduling/eventTimeValidation'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import { validateSchedulingLinkedRecord } from '@/lib/scheduling/linkedRecordRules'
import {
  normalizeSchedulingLocation,
  validateSchedulingLocation,
} from '@/lib/scheduling/locationRules'
import { normalizeWorkingHoursRecord } from '@/lib/scheduling/workingHours'
import { listWorkspaceLocations } from '@/lib/workspaceStructure/locations'
import { listWorkspaceTeams } from '@/lib/workspaceStructure/teams'
import type {
  WorkspaceLocationSummary,
  WorkspaceTeamSummary,
} from '@/lib/workspaceStructure/types'
import {
  schedulingRepository,
  type SchedulingEventWriteInput,
} from '@/lib/scheduling/repository'
import {
  checkExternalAvailabilityConflicts,
  type ExternalAvailabilityConflictResult,
} from '@/lib/scheduling/externalAvailability'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import type {
  SchedulingEvent,
  SchedulingEventStatus,
  SchedulingCapabilities,
  SchedulingReminderInput,
  SchedulingRecurrenceActionScope,
  SchedulingSeries,
  TeamAvailabilityRecord,
  WorkingHoursScope,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'
import { normalizeRecurrenceScope } from '@/lib/scheduling/recurrenceScope'
import {
  markSchedulingEventDeletedForExternalSync,
  markSchedulingEventForExternalSync,
} from '@/lib/scheduling/providers/providerSyncState'
import {
  reconcilePersonalCalendarPolicy,
  writeCalendarGovernanceOutboxEvent,
} from '@/lib/scheduling/providers/calendarGovernance'
import type { WorkspaceBusinessModel } from '@/lib/prisma/enums'

export type SchedulingMutationActor = {
  workspaceId: string
  actorUserId: string
  workspaceMemberId: string
  canManageScheduling: boolean
}

export type SchedulingWorkspaceData = {
  settings: WorkspaceSchedulingSettings
  events: Awaited<ReturnType<typeof schedulingRepository.listEventsByRange>>
  series: SchedulingSeries[]
  availability: TeamAvailabilityRecord[]
}

type WithoutWorkspaceIdentity<T> = T extends unknown
  ? Omit<T, 'id' | 'workspaceId'>
  : never

type SchedulingAvailabilityWriteInput =
  WithoutWorkspaceIdentity<TeamAvailabilityRecord>

export class SchedulingServiceError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'SchedulingServiceError'
  }
}

function assertCanManage(actor: SchedulingMutationActor) {
  if (!actor.canManageScheduling) {
    throw new SchedulingServiceError(
      'You do not have permission to manage workspace scheduling.',
      403,
    )
  }
}

function parseStoredSettings(
  value: unknown,
): Partial<WorkspaceSchedulingSettings> | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as Partial<WorkspaceSchedulingSettings>
}

const schedulingStatuses = new Set<SchedulingEventStatus>([
  'scheduled',
  'confirmed',
  'inProgress',
  'completed',
  'canceled',
  'missed',
])
const workingHoursScopes = new Set<WorkingHoursScope>([
  'workspace',
  'location',
  'team',
  'member',
])

function isValidTimeInput(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function minutesFromTimeInput(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
}

function normalizeEventReminderPolicy(
  value: unknown,
): SchedulingEventWriteInput['reminderPolicy'] {
  if (!isPlainRecord(value)) return undefined
  const mode = String(value.mode ?? 'workspaceDefault')
  if (mode === 'none') return { mode } as const
  if (mode !== 'custom') return { mode: 'workspaceDefault' } as const
  const reminders: SchedulingReminderInput[] = Array.isArray(value.reminders)
    ? value.reminders.flatMap((item) => {
        if (!isPlainRecord(item)) return []
        const offsetMinutes = Number(item.offsetMinutes)
        const channel = String(item.channel ?? '')
        const recipientGroup = String(item.recipientGroup ?? '')
        if (
          !Number.isFinite(offsetMinutes) ||
          offsetMinutes < 0 ||
          offsetMinutes > 10_080
        ) {
          return []
        }
        if (channel !== 'inApp' && channel !== 'email') return []
        if (
          recipientGroup !== 'assignedMembers' &&
          recipientGroup !== 'organizer' &&
          recipientGroup !== 'externalAttendees' &&
          recipientGroup !== 'linkedContact'
        ) {
          return []
        }
        return [
          {
            offsetMinutes: Math.round(offsetMinutes),
            channel,
            recipientGroup,
          },
        ]
      })
    : []
  return {
    mode: 'custom',
    reminders,
  } as const
}

function normalizeSchedulingEventInput(
  value: unknown,
): SchedulingEventWriteInput {
  if (!isPlainRecord(value)) {
    throw new SchedulingServiceError(
      'The event payload is missing or invalid.',
      400,
    )
  }

  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const type = typeof value.type === 'string' ? value.type.trim() : ''
  const startsAt = typeof value.startsAt === 'string' ? value.startsAt : ''
  const endsAt = typeof value.endsAt === 'string' ? value.endsAt : ''
  const timezone =
    typeof value.timezone === 'string' ? value.timezone.trim() : ''
  const status =
    typeof value.status === 'string' &&
    schedulingStatuses.has(value.status as SchedulingEventStatus)
      ? (value.status as SchedulingEventStatus)
      : 'scheduled'

  if (!title) {
    throw new SchedulingServiceError('Title is required.', 400, {
      title: 'Title is required.',
    })
  }
  if (!type) {
    throw new SchedulingServiceError('Choose an event type.', 400, {
      type: 'Choose an event type.',
    })
  }
  if (!timezone) {
    throw new SchedulingServiceError('Timezone is required.', 400, {
      timezone: 'Timezone is required.',
    })
  }
  try {
    validateSchedulingEventTimestampRange({ startsAt, endsAt })
  } catch (error) {
    if (error instanceof SchedulingEventTimeValidationError) {
      throw new SchedulingServiceError(error.message, 400, error.fieldErrors)
    }
    throw error
  }

  const linkedRecord = isPlainRecord(value.linkedRecord)
    ? {
        recordType: String(value.linkedRecord.recordType ?? '') as NonNullable<
          SchedulingEventWriteInput['linkedRecord']
        >['recordType'],
        recordId: String(value.linkedRecord.recordId ?? ''),
        label: String(value.linkedRecord.label ?? ''),
      }
    : undefined

  return {
    title,
    description:
      typeof value.description === 'string' && value.description.trim()
        ? value.description.trim()
        : undefined,
    type: type as SchedulingEventWriteInput['type'],
    status,
    startsAt,
    endsAt,
    allDay: value.allDay === true,
    timezone,
    locationType:
      typeof value.locationType === 'string'
        ? (value.locationType as SchedulingEventWriteInput['locationType'])
        : 'none',
    location:
      typeof value.location === 'string' && value.location.trim()
        ? value.location.trim()
        : undefined,
    locationLabel:
      typeof value.locationLabel === 'string' && value.locationLabel.trim()
        ? value.locationLabel.trim()
        : undefined,
    locationAddress:
      typeof value.locationAddress === 'string' && value.locationAddress.trim()
        ? value.locationAddress.trim()
        : undefined,
    meetingUrl:
      typeof value.meetingUrl === 'string' && value.meetingUrl.trim()
        ? value.meetingUrl.trim()
        : undefined,
    phoneNumber:
      typeof value.phoneNumber === 'string' && value.phoneNumber.trim()
        ? value.phoneNumber.trim()
        : undefined,
    assignedMemberIds: normalizeStringArray(value.assignedMemberIds),
    linkedRecord:
      linkedRecord?.recordType && linkedRecord.recordId && linkedRecord.label
        ? linkedRecord
        : null,
    recurrenceRule: isPlainRecord(value.recurrenceRule)
      ? (value.recurrenceRule as SchedulingEventWriteInput['recurrenceRule'])
      : undefined,
    reminderPolicy: normalizeEventReminderPolicy(value.reminderPolicy),
    externalCalendarState: 'notConnected',
  }
}

function getExternalAvailabilityOverrideReason(value: unknown) {
  if (!isPlainRecord(value)) return ''
  const reason = value.externalAvailabilityOverrideReason
  return typeof reason === 'string' ? reason.trim() : ''
}

function getAcknowledgedExternalAvailabilitySignalIds(value: unknown) {
  if (!isPlainRecord(value)) return []
  return normalizeStringArray(value.acknowledgedExternalAvailabilitySignalIds)
}

async function writeExternalAvailabilityConflictOutbox({
  workspaceId,
  eventId,
  topic,
  payload,
}: {
  workspaceId: string
  eventId: string
  topic:
    | 'scheduling.external_availability.conflict_detected'
    | 'scheduling.external_availability.conflict_acknowledged'
    | 'scheduling.external_availability.conflict_overridden'
  payload: Record<string, unknown>
}) {
  await prisma.domainOutboxEvent.create({
    data: {
      workspaceId,
      topic,
      aggregateType: 'SchedulingEvent',
      aggregateId: eventId,
      payload: payload as any,
    },
  })
}

function externalConflictSignalIds(
  conflicts: ExternalAvailabilityConflictResult[],
) {
  return [
    ...new Set(
      conflicts.flatMap((result) =>
        result.conflicts.map((conflict) => conflict.id),
      ),
    ),
  ]
}

async function checkSchedulingEventExternalAvailability({
  actor,
  input,
  existingEvent,
  overrideReason,
}: {
  actor: SchedulingMutationActor
  input:
    | Pick<
        SchedulingEventWriteInput,
        'startsAt' | 'endsAt' | 'assignedMemberIds'
      >
    | Partial<
        Pick<
          SchedulingEventWriteInput,
          'startsAt' | 'endsAt' | 'assignedMemberIds'
        >
      >
  existingEvent?: SchedulingEvent | null
  overrideReason?: string
}) {
  const startsAt = input.startsAt ?? existingEvent?.startsAt
  const endsAt = input.endsAt ?? existingEvent?.endsAt
  const assignedMemberIds =
    input.assignedMemberIds ?? existingEvent?.assignedMemberIds ?? []
  if (!startsAt || !endsAt || !assignedMemberIds.length) {
    return { conflicts: [], blocking: false }
  }
  const conflicts = await checkExternalAvailabilityConflicts({
    workspaceId: actor.workspaceId,
    workspaceMemberIds: assignedMemberIds,
    startsAtUtc: startsAt,
    endsAtUtc: endsAt,
    schedulingEventId: existingEvent?.id,
  })
  const blocking = conflicts.some(
    (result) => result.highestSeverity === 'blocking',
  )
  if (blocking && !overrideReason?.trim()) {
    throw new SchedulingServiceError(
      'Personal calendar availability blocks this assignment. Add an override reason or choose another time/member.',
      409,
      {
        assignedMemberIds:
          'Personal calendar availability blocks this assignment. Add an override reason or choose another time/member.',
      },
    )
  }
  return { conflicts, blocking }
}

function normalizeSchedulingAvailabilityInput(
  value: SchedulingAvailabilityWriteInput,
): SchedulingAvailabilityWriteInput {
  if (value.kind !== 'workingHours') return value
  const rawWorkingHours = value as Omit<
    Extract<TeamAvailabilityRecord, { kind: 'workingHours' }>,
    'id' | 'workspaceId'
  >
  const workingHours = normalizeWorkingHoursRecord({
    ...rawWorkingHours,
    id: 'pending',
    workspaceId: 'pending',
  })
  if (!workingHoursScopes.has(workingHours.scope)) {
    throw new SchedulingServiceError(
      'Choose where these Working Hours apply.',
      400,
      { scope: 'Choose where these Working Hours apply.' },
    )
  }
  if (workingHours.scope === 'workspace') {
    workingHours.locationId = null
    workingHours.teamId = null
    workingHours.workspaceMemberId = null
    workingHours.scheduleMode = 'custom'
  }
  if (workingHours.scope === 'location' && !workingHours.locationId) {
    throw new SchedulingServiceError('Choose a workspace location.', 400, {
      locationId: 'Choose a workspace location.',
    })
  }
  if (workingHours.scope === 'team' && !workingHours.teamId) {
    throw new SchedulingServiceError('Choose a workspace team.', 400, {
      teamId: 'Choose a workspace team.',
    })
  }
  if (workingHours.scope === 'member' && !workingHours.workspaceMemberId) {
    throw new SchedulingServiceError('Choose a team member.', 400, {
      workspaceMemberId: 'Choose a team member.',
    })
  }
  if (workingHours.scheduleMode !== 'inherit') {
    if (!workingHours.daysOfWeek?.length) {
      throw new SchedulingServiceError('Choose at least one weekday.', 400)
    }
    if (
      !workingHours.startsAt ||
      !workingHours.endsAt ||
      !isValidTimeInput(workingHours.startsAt) ||
      !isValidTimeInput(workingHours.endsAt)
    ) {
      throw new SchedulingServiceError('Enter valid start and end times.', 400)
    }
    if (
      minutesFromTimeInput(workingHours.endsAt) <=
      minutesFromTimeInput(workingHours.startsAt)
    ) {
      throw new SchedulingServiceError(
        'End time must be later than start time.',
        400,
      )
    }
  }
  if (
    workingHours.effectiveFrom &&
    workingHours.effectiveUntil &&
    workingHours.effectiveUntil < workingHours.effectiveFrom
  ) {
    throw new SchedulingServiceError(
      'Effective until cannot be before effective from.',
      400,
    )
  }
  return workingHours
}

async function normalizeAndValidateSchedulingAvailabilityInput({
  workspaceId,
  value,
}: {
  workspaceId: string
  value: SchedulingAvailabilityWriteInput
}): Promise<SchedulingAvailabilityWriteInput> {
  const normalized = normalizeSchedulingAvailabilityInput(value)
  if (normalized.kind !== 'workingHours') return normalized
  const workingHours = normalized as WithoutWorkspaceIdentity<
    Extract<TeamAvailabilityRecord, { kind: 'workingHours' }>
  >

  if (workingHours.scope === 'location') {
    const locations = await listWorkspaceLocations({ workspaceId })
    const location = locations.find(
      (item: WorkspaceLocationSummary) =>
        item.id === workingHours.locationId && item.isActive,
    )
    if (!location) {
      throw new SchedulingServiceError(
        'Choose an active workspace location.',
        400,
        { locationId: 'Choose an active workspace location.' },
      )
    }
    workingHours.locationName = location.name
    workingHours.memberName = location.name
  }

  if (workingHours.scope === 'team') {
    const teams = await listWorkspaceTeams({ workspaceId })
    const team = teams.find(
      (item: WorkspaceTeamSummary) =>
        item.id === workingHours.teamId && item.isActive,
    )
    if (!team) {
      throw new SchedulingServiceError(
        'Choose an active workspace team.',
        400,
        { teamId: 'Choose an active workspace team.' },
      )
    }
    workingHours.teamName = team.name
    workingHours.memberName = team.name
  }

  if (workingHours.scope === 'member' && workingHours.workspaceMemberId) {
    const member = await prisma.workspaceMember.findFirst({
      where: {
        id: workingHours.workspaceMemberId,
        workspaceId,
      },
      select: { id: true },
    })
    if (!member) {
      throw new SchedulingServiceError('Choose an active team member.', 400, {
        workspaceMemberId: 'Choose an active team member.',
      })
    }
  }

  return workingHours
}

async function getSchedulingValidationContext({
  workspaceId,
}: {
  workspaceId: string
}) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  })
  if (!workspace) {
    throw new SchedulingServiceError('Workspace not found.', 404)
  }
  const capabilities = getWorkspaceCapabilities(workspace as any).scheduling
  const settings = await getPersistedSchedulingSettings({
    workspaceId,
    businessModel: (workspace as any).businessModel,
    workspaceTimezone: (workspace as any).timezone,
    capabilities,
  })
  return { settings, capabilities }
}

async function validateSchedulingEventLinkedRecordInput({
  workspaceId,
  input,
  existingEvent,
}: {
  workspaceId: string
  input: Partial<SchedulingEventWriteInput>
  existingEvent?: SchedulingEvent | null
}) {
  const eventType = input.type ?? existingEvent?.type
  if (!eventType) return
  const hasLinkedRecordInput = Object.prototype.hasOwnProperty.call(
    input,
    'linkedRecord',
  )
  const linkedRecord = hasLinkedRecordInput
    ? input.linkedRecord
    : (existingEvent?.linkedRecord ?? null)
  const { settings, capabilities } = await getSchedulingValidationContext({
    workspaceId,
  })
  const result = validateSchedulingLinkedRecord({
    eventType,
    settings,
    capabilities,
    linkedRecord,
  })
  if (!result.valid) {
    throw new SchedulingServiceError('Review the highlighted fields.', 400, {
      linkedRecord: result.message,
    })
  }
}

async function validateSchedulingEventLocationInput({
  workspaceId,
  input,
  existingEvent,
}: {
  workspaceId: string
  input: Partial<SchedulingEventWriteInput>
  existingEvent?: SchedulingEvent | null
}): Promise<
  Pick<
    SchedulingEventWriteInput,
    | 'location'
    | 'locationType'
    | 'locationLabel'
    | 'locationAddress'
    | 'meetingUrl'
    | 'phoneNumber'
  >
> {
  const eventType = input.type ?? existingEvent?.type
  if (!eventType) return {}
  const { settings } = await getSchedulingValidationContext({ workspaceId })
  const location = {
    locationType: input.locationType ?? existingEvent?.locationType ?? 'none',
    location: input.location ?? existingEvent?.location,
    locationLabel: input.locationLabel ?? existingEvent?.locationLabel,
    locationAddress: input.locationAddress ?? existingEvent?.locationAddress,
    meetingUrl: input.meetingUrl ?? existingEvent?.meetingUrl,
    phoneNumber: input.phoneNumber ?? existingEvent?.phoneNumber,
  }
  const result = validateSchedulingLocation({
    eventType,
    settings,
    location,
  })
  if (!result.valid) {
    throw new SchedulingServiceError('Review the highlighted fields.', 400, {
      location: result.message,
    })
  }
  return normalizeSchedulingLocation({ eventType, settings, location })
}

export async function getPersistedSchedulingSettings({
  workspaceId,
  businessModel,
  workspaceTimezone,
  capabilities,
}: {
  workspaceId: string
  businessModel: WorkspaceBusinessModel | string
  workspaceTimezone?: string | null
  capabilities?: SchedulingCapabilities
}) {
  const settingsRecord = await prisma.workspaceSettings.findUnique({
    where: { workspaceId },
    select: { scheduling: true },
  })
  return normalizeSchedulingSettings({
    businessModel,
    workspaceTimezone,
    settings: {
      enabled: capabilities?.enabled,
      preset: capabilities?.preset,
      visibleSections: capabilities?.visibleSections,
      ...parseStoredSettings(settingsRecord?.scheduling),
    },
  })
}

export async function saveSchedulingSettings({
  actor,
  businessModel,
  settings,
  workspaceTimezone,
}: {
  actor: SchedulingMutationActor
  businessModel: WorkspaceBusinessModel | string
  settings: WorkspaceSchedulingSettings
  workspaceTimezone?: string | null
}) {
  assertCanManage(actor)
  const normalized = normalizeSchedulingSettings({
    businessModel,
    settings,
    workspaceTimezone,
  })
  const existingRecord = await prisma.workspaceSettings.findUnique({
    where: { workspaceId: actor.workspaceId },
    select: { scheduling: true },
  })
  await prisma.workspaceSettings.upsert({
    where: { workspaceId: actor.workspaceId },
    create: {
      workspaceId: actor.workspaceId,
      scheduling: normalized,
    },
    update: {
      scheduling: normalized,
    },
  })
  const previousPolicy = normalizeSchedulingSettings({
    businessModel,
    workspaceTimezone,
    settings:
      existingRecord?.scheduling &&
      typeof existingRecord.scheduling === 'object'
        ? (existingRecord.scheduling as Partial<WorkspaceSchedulingSettings>)
        : undefined,
  }).calendarConnectionPolicy
  if (
    JSON.stringify(previousPolicy) !==
    JSON.stringify(normalized.calendarConnectionPolicy)
  ) {
    await writeCalendarGovernanceOutboxEvent({
      workspaceId: actor.workspaceId,
      topic: 'scheduling.calendar_policy.updated',
      aggregateId: actor.workspaceId,
      payload: {
        actorWorkspaceMemberId: actor.workspaceMemberId,
        previousPolicy,
        policy: normalized.calendarConnectionPolicy,
      },
    })
    await reconcilePersonalCalendarPolicy({
      workspaceId: actor.workspaceId,
      policy: normalized.calendarConnectionPolicy,
      actorMemberId: actor.workspaceMemberId,
    })
  }
  return normalized
}

export async function listSchedulingWorkspaceData({
  workspaceId,
  businessModel,
  workspaceTimezone,
  capabilities,
  startsBefore,
  endsAfter,
}: {
  workspaceId: string
  businessModel: WorkspaceBusinessModel | string
  workspaceTimezone?: string | null
  capabilities?: SchedulingCapabilities
  startsBefore?: Date
  endsAfter?: Date
}): Promise<SchedulingWorkspaceData> {
  const settings = await getPersistedSchedulingSettings({
    workspaceId,
    businessModel,
    workspaceTimezone,
    capabilities,
  })
  const [events, series, availability] = await Promise.all([
    schedulingRepository.listEventsByRange({
      workspaceId,
      startsBefore,
      endsAfter,
    }),
    schedulingRepository.listRecurrenceSeries({ workspaceId }),
    schedulingRepository.listAvailabilityRecords({
      workspaceId,
      startsBefore,
      endsAfter,
    }),
  ])
  return { settings, events, series, availability }
}

export async function createSchedulingEvent({
  actor,
  input,
}: {
  actor: SchedulingMutationActor
  input: unknown
}) {
  assertCanManage(actor)
  const overrideReason = getExternalAvailabilityOverrideReason(input)
  const acknowledgedSignalIds =
    getAcknowledgedExternalAvailabilitySignalIds(input)
  const normalizedInput = normalizeSchedulingEventInput(input)
  await validateSchedulingEventLinkedRecordInput({
    workspaceId: actor.workspaceId,
    input: normalizedInput,
  })
  const normalizedLocation = await validateSchedulingEventLocationInput({
    workspaceId: actor.workspaceId,
    input: normalizedInput,
  })
  const externalConflicts = await checkSchedulingEventExternalAvailability({
    actor,
    input: normalizedInput,
    overrideReason,
  })
  const event = await schedulingRepository.createEvent({
    workspaceId: actor.workspaceId,
    actorUserId: actor.actorUserId,
    input: { ...normalizedInput, ...normalizedLocation },
  })
  const signalIds = externalConflictSignalIds(externalConflicts.conflicts)
  if (signalIds.length) {
    await writeExternalAvailabilityConflictOutbox({
      workspaceId: actor.workspaceId,
      eventId: event.id,
      topic: externalConflicts.blocking
        ? 'scheduling.external_availability.conflict_overridden'
        : 'scheduling.external_availability.conflict_acknowledged',
      payload: {
        eventId: event.id,
        actorWorkspaceMemberId: actor.workspaceMemberId,
        signalIds,
        acknowledgedSignalIds,
        overrideReason: overrideReason || undefined,
        blocking: externalConflicts.blocking,
      },
    })
  }
  await markSchedulingEventForExternalSync({
    workspaceId: actor.workspaceId,
    eventId: event.id,
    recurrenceSeriesId: event.recurrenceSeriesId,
    originOperation: event.recurrenceSeriesId
      ? 'skillify.recurrence_series.created'
      : 'skillify.event.created',
  })
  const persistedEvent = await schedulingRepository.getEventById({
    workspaceId: actor.workspaceId,
    eventId: event.id,
  })
  if (!persistedEvent) {
    throw new SchedulingServiceError(
      'The event was not found after scheduling. No success confirmation was sent.',
      500,
    )
  }
  return persistedEvent
}

export async function updateSchedulingEvent({
  actor,
  eventId,
  input,
  scope,
  expectedVersion,
  idempotencyKey,
}: {
  actor: SchedulingMutationActor
  eventId: string
  input: Partial<SchedulingEventWriteInput>
  scope?: SchedulingRecurrenceActionScope
  expectedVersion?: number
  idempotencyKey?: string
}) {
  assertCanManage(actor)
  const overrideReason = getExternalAvailabilityOverrideReason(input)
  const acknowledgedSignalIds =
    getAcknowledgedExternalAvailabilitySignalIds(input)
  const existingEvent = await schedulingRepository.getEventById({
    workspaceId: actor.workspaceId,
    eventId,
  })
  if (!existingEvent) {
    throw new SchedulingServiceError(
      'This event could not be found in the active workspace.',
      404,
    )
  }
  await validateSchedulingEventLinkedRecordInput({
    workspaceId: actor.workspaceId,
    input,
    existingEvent,
  })
  const normalizedLocation = await validateSchedulingEventLocationInput({
    workspaceId: actor.workspaceId,
    input,
    existingEvent,
  })
  const externalConflicts = await checkSchedulingEventExternalAvailability({
    actor,
    input,
    existingEvent,
    overrideReason,
  })
  const normalizedScope = scope ? normalizeRecurrenceScope(scope) : null
  let event: SchedulingEvent | null
  if (normalizedScope && existingEvent.recurrenceSeriesId) {
    event = await schedulingRepository.updateRecurringEvent({
      workspaceId: actor.workspaceId,
      occurrenceId: eventId,
      actorUserId: actor.actorUserId,
      scope: normalizedScope,
      input: { ...input, ...normalizedLocation },
      expectedVersion,
      idempotencyKey,
    })
    await markSchedulingEventForExternalSync({
      workspaceId: actor.workspaceId,
      eventId: event?.id ?? eventId,
      recurrenceSeriesId:
        event?.recurrenceSeriesId ?? existingEvent.recurrenceSeriesId,
      originOperation: `skillify.recurrence.${normalizedScope}.updated`,
    })
    if (event) {
      const signalIds = externalConflictSignalIds(externalConflicts.conflicts)
      if (signalIds.length) {
        await writeExternalAvailabilityConflictOutbox({
          workspaceId: actor.workspaceId,
          eventId: event.id,
          topic: externalConflicts.blocking
            ? 'scheduling.external_availability.conflict_overridden'
            : 'scheduling.external_availability.conflict_acknowledged',
          payload: {
            eventId: event.id,
            actorWorkspaceMemberId: actor.workspaceMemberId,
            signalIds,
            acknowledgedSignalIds,
            overrideReason: overrideReason || undefined,
            blocking: externalConflicts.blocking,
            scope: normalizedScope,
          },
        })
      }
    }
    return event
  }
  event = await schedulingRepository.updateEvent({
    workspaceId: actor.workspaceId,
    eventId,
    actorUserId: actor.actorUserId,
    input: { ...input, ...normalizedLocation },
  })
  await markSchedulingEventForExternalSync({
    workspaceId: actor.workspaceId,
    eventId: event.id,
    recurrenceSeriesId: event.recurrenceSeriesId,
    originOperation: 'skillify.event.updated',
  })
  const signalIds = externalConflictSignalIds(externalConflicts.conflicts)
  if (signalIds.length) {
    await writeExternalAvailabilityConflictOutbox({
      workspaceId: actor.workspaceId,
      eventId: event.id,
      topic: externalConflicts.blocking
        ? 'scheduling.external_availability.conflict_overridden'
        : 'scheduling.external_availability.conflict_acknowledged',
      payload: {
        eventId: event.id,
        actorWorkspaceMemberId: actor.workspaceMemberId,
        signalIds,
        acknowledgedSignalIds,
        overrideReason: overrideReason || undefined,
        blocking: externalConflicts.blocking,
      },
    })
  }
  return event
}

export async function changeSchedulingEventStatus({
  actor,
  eventId,
  status,
  scope,
  expectedVersion,
  idempotencyKey,
}: {
  actor: SchedulingMutationActor
  eventId: string
  status: SchedulingEventStatus
  scope?: SchedulingRecurrenceActionScope
  expectedVersion?: number
  idempotencyKey?: string
}) {
  assertCanManage(actor)
  const existingEvent = await schedulingRepository.getEventById({
    workspaceId: actor.workspaceId,
    eventId,
  })
  if (!existingEvent) {
    throw new SchedulingServiceError(
      'This event could not be found in the active workspace.',
      404,
    )
  }
  const normalizedScope = scope ? normalizeRecurrenceScope(scope) : null
  if (
    normalizedScope &&
    existingEvent.recurrenceSeriesId &&
    status === 'canceled'
  ) {
    await schedulingRepository.cancelRecurringEvent({
      workspaceId: actor.workspaceId,
      occurrenceId: eventId,
      actorUserId: actor.actorUserId,
      scope: normalizedScope,
      expectedVersion,
      idempotencyKey,
    })
    const event = await schedulingRepository.getEventById({
      workspaceId: actor.workspaceId,
      eventId,
    })
    await markSchedulingEventForExternalSync({
      workspaceId: actor.workspaceId,
      eventId,
      recurrenceSeriesId: existingEvent.recurrenceSeriesId,
      originOperation: `skillify.recurrence.${normalizedScope}.canceled`,
    })
    return event
  }
  if (existingEvent.recurrenceSeriesId && status !== 'canceled') {
    const event =
      await schedulingRepository.transitionRecurringOccurrenceStatus({
        workspaceId: actor.workspaceId,
        occurrenceId: eventId,
        actorUserId: actor.actorUserId,
        status,
        expectedVersion,
        idempotencyKey,
      })
    await markSchedulingEventForExternalSync({
      workspaceId: actor.workspaceId,
      eventId: event.id,
      recurrenceSeriesId: event.recurrenceSeriesId,
      originOperation: `skillify.recurrence.occurrence.${status}`,
    })
    return event
  }
  const event = await schedulingRepository.transitionEventStatus({
    workspaceId: actor.workspaceId,
    eventId,
    actorUserId: actor.actorUserId,
    status,
  })
  await markSchedulingEventForExternalSync({
    workspaceId: actor.workspaceId,
    eventId: event.id,
    recurrenceSeriesId: event.recurrenceSeriesId,
    originOperation: `skillify.event.${status}`,
  })
  return event
}

export async function deleteSchedulingEvent({
  actor,
  eventId,
  scope,
  expectedVersion,
  idempotencyKey,
}: {
  actor: SchedulingMutationActor
  eventId: string
  scope?: SchedulingRecurrenceActionScope
  expectedVersion?: number
  idempotencyKey?: string
}) {
  assertCanManage(actor)
  const existingEvent = await schedulingRepository.getEventById({
    workspaceId: actor.workspaceId,
    eventId,
  })
  if (!existingEvent) {
    throw new SchedulingServiceError(
      'This event could not be found in the active workspace.',
      404,
    )
  }
  const normalizedScope = scope ? normalizeRecurrenceScope(scope) : null
  if (normalizedScope && existingEvent.recurrenceSeriesId) {
    await schedulingRepository.deleteRecurringEvent({
      workspaceId: actor.workspaceId,
      occurrenceId: eventId,
      actorUserId: actor.actorUserId,
      scope: normalizedScope,
      expectedVersion,
      idempotencyKey,
    })
    await markSchedulingEventDeletedForExternalSync({
      workspaceId: actor.workspaceId,
      eventId,
      recurrenceSeriesId: existingEvent.recurrenceSeriesId,
      originOperation: `skillify.recurrence.${normalizedScope}.deleted`,
    })
    return
  }
  await schedulingRepository.softDeleteEvent({
    workspaceId: actor.workspaceId,
    eventId,
    actorUserId: actor.actorUserId,
  })
  await markSchedulingEventDeletedForExternalSync({
    workspaceId: actor.workspaceId,
    eventId,
    recurrenceSeriesId: existingEvent.recurrenceSeriesId,
    originOperation: 'skillify.event.deleted',
  })
}

export async function duplicateSchedulingEvent({
  actor,
  eventId,
  scope,
}: {
  actor: SchedulingMutationActor
  eventId: string
  scope?: SchedulingRecurrenceActionScope
}) {
  assertCanManage(actor)
  return schedulingRepository.duplicateEvent({
    workspaceId: actor.workspaceId,
    eventId,
    actorUserId: actor.actorUserId,
    scope,
  })
}

export async function changeSchedulingRecurrenceSeriesStatus({
  actor,
  seriesId,
  action,
  expectedVersion,
  idempotencyKey,
}: {
  actor: SchedulingMutationActor
  seriesId: string
  action: 'pause' | 'resume' | 'cancel'
  expectedVersion?: number
  idempotencyKey?: string
}) {
  assertCanManage(actor)
  if (action === 'pause') {
    await schedulingRepository.pauseRecurrenceSeries({
      workspaceId: actor.workspaceId,
      seriesId,
      actorUserId: actor.actorUserId,
      expectedVersion,
      idempotencyKey,
    })
    return
  }
  if (action === 'resume') {
    await schedulingRepository.resumeRecurrenceSeries({
      workspaceId: actor.workspaceId,
      seriesId,
      actorUserId: actor.actorUserId,
      expectedVersion,
      idempotencyKey,
    })
    return
  }
  if (action === 'cancel') {
    await schedulingRepository.cancelRecurrenceSeries({
      workspaceId: actor.workspaceId,
      seriesId,
      actorUserId: actor.actorUserId,
      expectedVersion,
      idempotencyKey,
    })
    return
  }
  throw new SchedulingServiceError('Unsupported recurrence action.', 400)
}

export async function createSchedulingAvailabilityRecord({
  actor,
  record,
}: {
  actor: SchedulingMutationActor
  record: SchedulingAvailabilityWriteInput
}) {
  assertCanManage(actor)
  const normalizedRecord =
    await normalizeAndValidateSchedulingAvailabilityInput({
      workspaceId: actor.workspaceId,
      value: record,
    })
  return schedulingRepository.createAvailabilityRecord({
    workspaceId: actor.workspaceId,
    actorUserId: actor.actorUserId,
    record: normalizedRecord,
  })
}

export async function updateSchedulingAvailabilityRecord({
  actor,
  recordId,
  record,
}: {
  actor: SchedulingMutationActor
  recordId: string
  record: SchedulingAvailabilityWriteInput
}) {
  assertCanManage(actor)
  const normalizedRecord =
    await normalizeAndValidateSchedulingAvailabilityInput({
      workspaceId: actor.workspaceId,
      value: record,
    })
  return schedulingRepository.updateAvailabilityRecord({
    workspaceId: actor.workspaceId,
    actorUserId: actor.actorUserId,
    recordId,
    record: normalizedRecord,
  })
}

export async function deleteSchedulingAvailabilityRecord({
  actor,
  recordId,
}: {
  actor: SchedulingMutationActor
  recordId: string
}) {
  assertCanManage(actor)
  await schedulingRepository.deleteAvailabilityRecord({
    workspaceId: actor.workspaceId,
    recordId,
  })
}
