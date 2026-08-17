import {
  CalendarSyncDirectionLog,
  CalendarSyncLogStatus,
  SchedulingAssignmentType,
  SchedulingAttendeeResponseStatus,
  SchedulingAttendeeType,
  SchedulingAvailabilityRecordKind,
  SchedulingEventStatus as PrismaSchedulingEventStatus,
  SchedulingOccurrenceState as PrismaSchedulingOccurrenceState,
  SchedulingRecurrenceSeriesStatus as PrismaSchedulingRecurrenceSeriesStatus,
  SchedulingLocationType as PrismaSchedulingLocationType,
  SchedulingExceptionType,
  SchedulingTimeOffCategory,
  type Prisma,
} from '@prisma/client'

import { prisma, type DB } from '@/lib/db'
import {
  assertSchedulingEventStatusTransition,
  getSchedulingStatusTransitionEffect,
} from '@/lib/scheduling/events/statusTransitions'
import { getListEventsByRangeWhere } from '@/lib/scheduling/occurrenceStateFilters'
import {
  addDateKeys,
  combineDateAndTimeInTimezone,
  getWorkspaceDateKey,
  getWorkspaceTimeInputValue,
} from '@/lib/scheduling/schedulingDateTime'
import {
  RECURRENCE_MATERIALIZATION_DAYS_AHEAD,
  RECURRENCE_MATERIALIZATION_DAYS_BEHIND,
  generateRecurrenceOccurrences,
  normalizeSchedulingRecurrenceRule,
  type NormalizedSchedulingRecurrence,
} from '@/lib/scheduling/recurrence'
import {
  decideRecurrenceOverrideRemap,
  createRecurrenceAdvisoryLockSql,
  deriveRecurrenceSeriesLockKey,
  hashRecurrenceMutationRequest,
  isRetryableRecurrenceMutationError,
  validateRecurrenceIdempotencyKey,
  type RecurrenceOverrideRemapDecision,
} from '@/lib/scheduling/recurrenceHardening'
import { undeterminedLocationLabel } from '@/lib/scheduling/locationRules'
import {
  getLocationStorageId,
  normalizeWorkingHoursRecord,
} from '@/lib/scheduling/workingHours'
import type {
  AvailabilityExceptionRecord,
  SchedulingEvent,
  SchedulingEventStatus,
  SchedulingLocationType,
  SchedulingRecurrenceActionScope,
  SchedulingRecurrenceMutationKind,
  SchedulingOccurrenceState,
  SchedulingSeries,
  TeamAvailabilityRecord,
} from '@/lib/scheduling/types'

type Tx = Prisma.TransactionClient
type DbOrTx = DB | Tx

const eventInclude = {
  assignments: true,
  attendees: true,
  providerMappings: {
    select: {
      syncState: true,
      deletedAtProvider: true,
      deletedAtSkillify: true,
    },
  },
  recurrenceSeries: {
    select: { id: true, masterEventId: true, status: true },
  },
  masterSeries: {
    select: { id: true, masterEventId: true, status: true },
  },
} satisfies Prisma.SchedulingEventInclude

export class SchedulingRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'not_found'
      | 'forbidden'
      | 'invalid_input'
      | 'conflict'
      | 'version_conflict'
      | 'idempotency_conflict'
      | 'mutation_busy'
      | 'retry_exhausted' = 'invalid_input',
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'SchedulingRepositoryError'
  }
}

async function acquireRecurrenceSeriesLocks({
  tx,
  workspaceId,
  seriesIds,
  mutationKind,
}: {
  tx: Tx
  workspaceId: string
  seriesIds: string[]
  mutationKind: SchedulingRecurrenceMutationKind
}) {
  const uniqueSeriesIds = [...new Set(seriesIds)].filter(Boolean)
  const keys = uniqueSeriesIds
    .map((seriesId) => deriveRecurrenceSeriesLockKey({ workspaceId, seriesId }))
    .sort((first, second) => first.sortKey.localeCompare(second.sortKey))
  const startedAt = Date.now()
  for (const key of keys) {
    await tx.$queryRaw(createRecurrenceAdvisoryLockSql(key))
  }
  return {
    lockWaitMs: Date.now() - startedAt,
    lockedSeriesIds: keys.map((key) => key.seriesId),
    mutationKind,
  }
}

async function assertRecurrenceSeriesVersion({
  tx,
  workspaceId,
  seriesId,
  expectedVersion,
}: {
  tx: Tx
  workspaceId: string
  seriesId: string
  expectedVersion?: number
}) {
  if (expectedVersion === undefined) return
  const series = await tx.schedulingRecurrenceSeries.findFirst({
    where: { id: seriesId, workspaceId },
    select: { id: true, version: true },
  })
  if (!series) {
    throw new SchedulingRepositoryError(
      'This recurring schedule could not be found.',
      'not_found',
    )
  }
  if (series.version !== expectedVersion) {
    throw new SchedulingRepositoryError(
      'This recurring schedule changed since you opened it.',
      'version_conflict',
      { currentVersion: series.version, expectedVersion },
    )
  }
}

function recurrenceMutationResponse<Result>(result: Result) {
  if (result === undefined) return { ok: true }
  return result as Prisma.InputJsonValue
}

async function runRecurrenceTransaction<Result>({
  workspaceId,
  seriesIds,
  occurrenceId,
  mutationKind,
  actorUserId,
  scope,
  idempotencyKey,
  expectedVersion,
  request = {},
  callback,
}: RecurrenceTransactionArgs<Result>): Promise<Result> {
  const key = validateRecurrenceIdempotencyKey(idempotencyKey)
  const requestHash = key
    ? hashRecurrenceMutationRequest({
        mutationKind,
        seriesIds,
        occurrenceId,
        scope,
        request,
      })
    : undefined
  const maxAttempts = 3
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now()
    try {
      return await prisma.$transaction(async (tx) => {
        const lockInfo = await acquireRecurrenceSeriesLocks({
          tx,
          workspaceId,
          seriesIds,
          mutationKind,
        })
        if (seriesIds[0]) {
          await assertRecurrenceSeriesVersion({
            tx,
            workspaceId,
            seriesId: seriesIds[0],
            expectedVersion,
          })
        }

        let mutationRecordId: string | undefined
        if (key && requestHash) {
          const existing = await tx.schedulingRecurrenceMutation.findUnique({
            where: {
              workspaceId_idempotencyKey: {
                workspaceId,
                idempotencyKey: key,
              },
            },
          })
          if (existing && existing.requestHash !== requestHash) {
            throw new SchedulingRepositoryError(
              'This idempotency key was already used for a different recurrence request.',
              'idempotency_conflict',
            )
          }
          if (existing?.status === 'completed') {
            return existing.result as Result
          }
          if (existing) {
            mutationRecordId = existing.id
          } else {
            const created = await tx.schedulingRecurrenceMutation.create({
              data: {
                workspaceId,
                seriesId: seriesIds[0],
                idempotencyKey: key,
                mutationKind,
                requestHash,
                status: 'processing',
              },
              select: { id: true },
            })
            mutationRecordId = created.id
          }
        }

        const result = await callback(tx)
        if (mutationRecordId) {
          await tx.schedulingRecurrenceMutation.update({
            where: { id: mutationRecordId },
            data: {
              status: 'completed',
              result: recurrenceMutationResponse(result),
              completedAt: new Date(),
            },
          })
        }
        console.info('[scheduling recurrence mutation]', {
          workspaceId,
          seriesIds,
          operation: mutationKind,
          scope,
          actorUserId,
          lockWaitMs: lockInfo.lockWaitMs,
          transactionAttempt: attempt,
          retryCount: attempt - 1,
          durationMs: Date.now() - startedAt,
          idempotencyHit: false,
        })
        return result
      })
    } catch (error) {
      lastError = error
      if (
        error instanceof SchedulingRepositoryError ||
        !isRetryableRecurrenceMutationError(error) ||
        attempt === maxAttempts
      ) {
        break
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 15 + Math.floor(Math.random() * 30)),
      )
    }
  }

  if (isRetryableRecurrenceMutationError(lastError)) {
    throw new SchedulingRepositoryError(
      'Another recurrence change is still being processed. Try again in a moment.',
      'retry_exhausted',
    )
  }
  throw lastError
}

export type SchedulingAttendeeInput = {
  attendeeType?: 'workspaceMember' | 'contact' | 'customer' | 'externalGuest'
  name?: string
  email: string
  responseStatus?: 'needsAction' | 'accepted' | 'tentative' | 'declined'
  isOrganizer?: boolean
  isOptional?: boolean
}

export type SchedulingEventWriteInput = Omit<
  SchedulingEvent,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'linkedRecord'
> & {
  id?: string
  linkedRecord?: SchedulingEvent['linkedRecord'] | null
  attendees?: SchedulingAttendeeInput[]
}

export type SchedulingRangeQuery = {
  workspaceId: string
  startsBefore?: Date
  endsAfter?: Date
  includeDeleted?: boolean
  limit?: number
}

function duplicateEventInput({
  event,
  duplicateSeries,
}: {
  event: SchedulingEvent
  duplicateSeries: boolean
}): SchedulingEventWriteInput {
  return {
    title: `${event.title} Copy`,
    description: event.description,
    type: event.type,
    status: 'scheduled',
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    timezone: event.timezone,
    location: event.location,
    locationType: event.locationType,
    locationLabel: event.locationLabel,
    locationAddress: event.locationAddress,
    meetingUrl: event.meetingUrl,
    phoneNumber: event.phoneNumber,
    assignedMemberIds: [...event.assignedMemberIds],
    linkedRecord: event.linkedRecord ?? null,
    recurrenceRule: duplicateSeries ? event.recurrenceRule : undefined,
    reminderPolicy: event.reminderPolicy,
  }
}

export type RecurrenceIntegrityFinding = {
  severity: 'info' | 'warning' | 'error'
  code: string
  seriesId?: string
  occurrenceId?: string
  message: string
  repairable: boolean
  metadata?: Record<string, unknown>
}

export type RecurrenceRepairResult = {
  dryRun: boolean
  findings: RecurrenceIntegrityFinding[]
  repairedCount: number
  supersededCount: number
  rematerializedCount: number
  updatedSeriesCount: number
}

export type RecurrenceMutationOptions = {
  expectedVersion?: number
  idempotencyKey?: string
}

type RecurrenceTransactionArgs<Result> = RecurrenceMutationOptions & {
  workspaceId: string
  seriesIds: string[]
  occurrenceId?: string
  mutationKind: SchedulingRecurrenceMutationKind
  actorUserId?: string
  scope?: SchedulingRecurrenceActionScope
  request?: Record<string, unknown>
  callback: (tx: Tx) => Promise<Result>
}

function statusToPrisma(
  status: SchedulingEventStatus,
): PrismaSchedulingEventStatus {
  const map: Record<SchedulingEventStatus, PrismaSchedulingEventStatus> = {
    scheduled: PrismaSchedulingEventStatus.SCHEDULED,
    confirmed: PrismaSchedulingEventStatus.CONFIRMED,
    inProgress: PrismaSchedulingEventStatus.IN_PROGRESS,
    completed: PrismaSchedulingEventStatus.COMPLETED,
    canceled: PrismaSchedulingEventStatus.CANCELED,
    missed: PrismaSchedulingEventStatus.MISSED,
  }
  const prismaStatus = map[status]
  if (!prismaStatus) {
    throw new SchedulingRepositoryError(
      'Choose a supported event status.',
      'invalid_input',
    )
  }
  return prismaStatus
}

function statusFromPrisma(
  status: PrismaSchedulingEventStatus,
): SchedulingEventStatus {
  const map: Record<PrismaSchedulingEventStatus, SchedulingEventStatus> = {
    SCHEDULED: 'scheduled',
    CONFIRMED: 'confirmed',
    IN_PROGRESS: 'inProgress',
    COMPLETED: 'completed',
    CANCELED: 'canceled',
    MISSED: 'missed',
  }
  return map[status]
}

function occurrenceStateToPrisma(
  state: SchedulingOccurrenceState,
): PrismaSchedulingOccurrenceState {
  const map: Record<
    SchedulingOccurrenceState,
    PrismaSchedulingOccurrenceState
  > = {
    master: PrismaSchedulingOccurrenceState.MASTER,
    generated: PrismaSchedulingOccurrenceState.GENERATED,
    overridden: PrismaSchedulingOccurrenceState.OVERRIDDEN,
    canceled: PrismaSchedulingOccurrenceState.CANCELED,
    completed: PrismaSchedulingOccurrenceState.COMPLETED,
    detached: PrismaSchedulingOccurrenceState.DETACHED,
    superseded: PrismaSchedulingOccurrenceState.SUPERSEDED,
    deleted: PrismaSchedulingOccurrenceState.DELETED,
  }
  return map[state]
}

function occurrenceStateFromPrisma(
  state?: PrismaSchedulingOccurrenceState | null,
): SchedulingOccurrenceState | undefined {
  if (!state) return undefined
  const map: Record<
    PrismaSchedulingOccurrenceState,
    SchedulingOccurrenceState
  > = {
    MASTER: 'master',
    GENERATED: 'generated',
    OVERRIDDEN: 'overridden',
    CANCELED: 'canceled',
    COMPLETED: 'completed',
    DETACHED: 'detached',
    SUPERSEDED: 'superseded',
    DELETED: 'deleted',
  }
  return map[state]
}

function attendeeTypeToPrisma(
  value: SchedulingAttendeeInput['attendeeType'] = 'externalGuest',
) {
  const map = {
    workspaceMember: SchedulingAttendeeType.WORKSPACE_MEMBER,
    contact: SchedulingAttendeeType.CONTACT,
    customer: SchedulingAttendeeType.CUSTOMER,
    externalGuest: SchedulingAttendeeType.EXTERNAL_GUEST,
  }
  return map[value]
}

function responseStatusToPrisma(
  value: SchedulingAttendeeInput['responseStatus'] = 'needsAction',
) {
  const map = {
    needsAction: SchedulingAttendeeResponseStatus.NEEDS_ACTION,
    accepted: SchedulingAttendeeResponseStatus.ACCEPTED,
    tentative: SchedulingAttendeeResponseStatus.TENTATIVE,
    declined: SchedulingAttendeeResponseStatus.DECLINED,
  }
  return map[value]
}

function timeOffCategoryToPrisma(category?: string) {
  if (!category) return null
  const map: Record<string, SchedulingTimeOffCategory> = {
    vacation: SchedulingTimeOffCategory.VACATION,
    sick: SchedulingTimeOffCategory.SICK,
    personal: SchedulingTimeOffCategory.PERSONAL,
    appointment: SchedulingTimeOffCategory.APPOINTMENT,
    unavailable: SchedulingTimeOffCategory.UNAVAILABLE,
    other: SchedulingTimeOffCategory.OTHER,
  }
  return map[category] ?? SchedulingTimeOffCategory.OTHER
}

function timeOffCategoryFromPrisma(
  category?: SchedulingTimeOffCategory | null,
) {
  if (!category) return undefined
  const map: Record<SchedulingTimeOffCategory, string> = {
    VACATION: 'vacation',
    SICK: 'sick',
    PERSONAL: 'personal',
    APPOINTMENT: 'appointment',
    UNAVAILABLE: 'unavailable',
    OTHER: 'other',
  }
  return map[category] as Extract<
    TeamAvailabilityRecord,
    { kind: 'timeOff' }
  >['category']
}

function locationTypeFromPrisma(
  value?: PrismaSchedulingLocationType | null,
  label?: string | null,
): SchedulingLocationType {
  if (
    value === PrismaSchedulingLocationType.CUSTOM &&
    label === undeterminedLocationLabel
  ) {
    return 'toBeDetermined'
  }
  if (!value) return 'none'
  const map: Record<PrismaSchedulingLocationType, SchedulingLocationType> = {
    NONE: 'none',
    ADDRESS: 'physicalAddress',
    VIDEO: 'videoMeeting',
    PHONE: 'phoneCall',
    CUSTOM: 'other',
  }
  return map[value] ?? 'none'
}

function locationTypeToPrisma(
  value?: SchedulingLocationType | null,
): PrismaSchedulingLocationType | null {
  if (!value || value === 'none') return PrismaSchedulingLocationType.NONE
  if (value === 'videoMeeting') return PrismaSchedulingLocationType.VIDEO
  if (value === 'phoneCall') return PrismaSchedulingLocationType.PHONE
  if (
    value === 'toBeDetermined' ||
    value === 'other' ||
    value === 'workspaceLocation'
  )
    return PrismaSchedulingLocationType.CUSTOM
  return PrismaSchedulingLocationType.ADDRESS
}

function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new SchedulingRepositoryError('Invalid time value.', 'invalid_input')
  }
  return hours * 60 + minutes
}

function timeFromMinutes(minutes: number | null | undefined) {
  if (typeof minutes !== 'number') return ''
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function validateEventTiming(
  input: Pick<SchedulingEventWriteInput, 'startsAt' | 'endsAt'>,
) {
  const startsAt = new Date(input.startsAt)
  const endsAt = new Date(input.endsAt)
  if (Number.isNaN(startsAt.getTime())) {
    throw new SchedulingRepositoryError(
      'Enter a valid start time.',
      'invalid_input',
    )
  }
  if (Number.isNaN(endsAt.getTime())) {
    throw new SchedulingRepositoryError(
      'Enter a valid end time.',
      'invalid_input',
    )
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new SchedulingRepositoryError(
      'The end time must be after the start time.',
      'invalid_input',
    )
  }
}

async function validateAssignments({
  db,
  workspaceId,
  assignedMemberIds,
}: {
  db: DbOrTx
  workspaceId: string
  assignedMemberIds: string[]
}) {
  const uniqueIds = [...new Set(assignedMemberIds.filter(Boolean))]
  if (uniqueIds.length === 0) return uniqueIds

  const members = await db.workspaceMember.findMany({
    where: {
      workspaceId,
      OR: [{ id: { in: uniqueIds } }, { userId: { in: uniqueIds } }],
    },
    select: { id: true, userId: true },
  })
  const idByInput = new Map<string, string>()
  members.forEach((member) => {
    idByInput.set(member.id, member.id)
    idByInput.set(member.userId, member.id)
  })
  const invalid = uniqueIds.find((id) => !idByInput.has(id))
  if (invalid) {
    throw new SchedulingRepositoryError(
      'The selected team member no longer belongs to this workspace.',
      'forbidden',
    )
  }
  return uniqueIds.map((id) => idByInput.get(id) as string)
}

function normalizeRecurrenceOrThrow(
  args: Parameters<typeof normalizeSchedulingRecurrenceRule>[0],
) {
  try {
    return normalizeSchedulingRecurrenceRule(args)
  } catch (error) {
    throw new SchedulingRepositoryError(
      error instanceof Error
        ? error.message
        : 'Choose a valid recurrence schedule.',
      'invalid_input',
    )
  }
}

function eventToDomain(
  event: Prisma.SchedulingEventGetPayload<{ include: typeof eventInclude }>,
): SchedulingEvent {
  const linkedRecord =
    event.linkedRecordType && event.linkedRecordId
      ? {
          recordType: event.linkedRecordType as NonNullable<
            SchedulingEvent['linkedRecord']
          >['recordType'],
          recordId: event.linkedRecordId,
          label: event.linkedRecordLabel ?? event.linkedRecordId,
        }
      : undefined

  const externalCalendarState = event.providerMappings.some(
    (mapping) => mapping.syncState === 'CONFLICT',
  )
    ? 'conflict'
    : event.providerMappings.some((mapping) => mapping.syncState === 'FAILED')
      ? 'error'
      : event.providerMappings.some(
            (mapping) =>
              mapping.syncState === 'PENDING_PULL' ||
              mapping.syncState === 'PENDING_PUSH',
          )
        ? 'pending'
        : event.providerMappings.some(
              (mapping) =>
                mapping.syncState === 'SYNCED' && !mapping.deletedAtProvider,
            )
          ? 'synced'
          : 'notConnected'

  return {
    id: event.id,
    workspaceId: event.workspaceId,
    title: event.title,
    description: event.description ?? undefined,
    type: event.eventTypeKey as SchedulingEvent['type'],
    status: statusFromPrisma(event.status),
    startsAt: event.startsAtUtc.toISOString(),
    endsAt: event.endsAtUtc.toISOString(),
    allDay: event.allDay,
    timezone: event.timezone,
    locationType: locationTypeFromPrisma(
      event.locationType,
      event.locationLabel,
    ),
    locationLabel: event.locationLabel ?? undefined,
    locationAddress: event.locationAddress ?? undefined,
    meetingUrl: event.meetingUrl ?? undefined,
    location:
      event.locationLabel ??
      event.locationAddress ??
      event.meetingUrl ??
      undefined,
    assignedMemberIds: event.assignments
      .filter((assignment) => assignment.workspaceMemberId)
      .map((assignment) => assignment.workspaceMemberId as string),
    linkedRecord,
    recurrenceSeriesId:
      event.recurrenceSeriesId ?? event.masterSeries?.id ?? undefined,
    recurrenceRule: event.recurrenceRule as SchedulingEvent['recurrenceRule'],
    occurrenceOriginalAt: event.occurrenceOriginalAt?.toISOString(),
    occurrenceState: occurrenceStateFromPrisma(event.occurrenceState),
    reminderPolicy:
      event.reminderPolicy &&
      typeof event.reminderPolicy === 'object' &&
      !Array.isArray(event.reminderPolicy)
        ? (event.reminderPolicy as SchedulingEvent['reminderPolicy'])
        : undefined,
    sourceEventId: event.recurrenceSeries?.masterEventId ?? undefined,
    externalCalendarState,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  }
}

function buildEventData({
  workspaceId,
  actorUserId,
  input,
  isCreate,
}: {
  workspaceId: string
  actorUserId: string
  input: Partial<SchedulingEventWriteInput>
  isCreate: boolean
}):
  | Prisma.SchedulingEventUncheckedCreateInput
  | Prisma.SchedulingEventUncheckedUpdateInput {
  const data: Record<string, unknown> = {}

  if (isCreate) {
    data.workspaceId = workspaceId
    data.createdByUserId = actorUserId
  } else {
    data.updatedByUserId = actorUserId
  }

  if (input.id && isCreate) data.id = input.id
  if (input.type) data.eventTypeKey = input.type
  if (input.title !== undefined) data.title = input.title
  if (input.description !== undefined)
    data.description = input.description ?? null
  if (input.status) data.status = statusToPrisma(input.status)
  if (input.startsAt) data.startsAtUtc = new Date(input.startsAt)
  if (input.endsAt) data.endsAtUtc = new Date(input.endsAt)
  if (input.timezone) data.timezone = input.timezone
  if (input.allDay !== undefined) data.allDay = input.allDay
  if (input.locationType !== undefined)
    data.locationType = locationTypeToPrisma(input.locationType)
  if (input.location !== undefined) data.locationLabel = input.location ?? null
  if (input.locationLabel !== undefined)
    data.locationLabel = input.locationLabel ?? input.location ?? null
  if (input.locationAddress !== undefined)
    data.locationAddress = input.locationAddress ?? null
  if (input.meetingUrl !== undefined) data.meetingUrl = input.meetingUrl ?? null
  if (input.phoneNumber !== undefined) {
    data.locationLabel =
      input.locationType === 'phoneCall'
        ? (input.phoneNumber ?? null)
        : (input.locationLabel ?? input.location ?? null)
  }
  if (input.recurrenceRule !== undefined) {
    data.recurrenceRule = (input.recurrenceRule ??
      null) as Prisma.InputJsonValue
  }
  if (input.reminderPolicy !== undefined) {
    data.reminderPolicy = (input.reminderPolicy ??
      null) as Prisma.InputJsonValue
  }
  if (input.linkedRecord !== undefined) {
    data.linkedRecordType = input.linkedRecord?.recordType ?? null
    data.linkedRecordId = input.linkedRecord?.recordId ?? null
    data.linkedRecordLabel = input.linkedRecord?.label ?? null
  }

  return data as
    | Prisma.SchedulingEventUncheckedCreateInput
    | Prisma.SchedulingEventUncheckedUpdateInput
}

async function appendActivity(
  db: DbOrTx,
  {
    workspaceId,
    eventId,
    actorId,
    action,
    summary,
    metadata,
  }: {
    workspaceId: string
    eventId: string
    actorId?: string
    action: string
    summary: string
    metadata?: Record<string, unknown>
  },
) {
  await db.schedulingEventActivity.create({
    data: {
      workspaceId,
      eventId,
      actorId,
      action,
      source: 'Skillify',
      summary,
      metadata: metadata as Prisma.InputJsonObject,
    },
  })
}

async function appendOutbox(
  db: DbOrTx,
  {
    workspaceId,
    topic,
    aggregateId,
    payload,
  }: {
    workspaceId: string
    topic: string
    aggregateId: string
    payload: Record<string, unknown>
  },
) {
  await db.domainOutboxEvent.create({
    data: {
      workspaceId,
      topic,
      aggregateType: 'SchedulingEvent',
      aggregateId,
      payload: payload as Prisma.InputJsonObject,
    },
  })
}

async function updateEventInTransaction({
  tx,
  workspaceId,
  eventId,
  actorUserId,
  input,
}: {
  tx: Tx
  workspaceId: string
  eventId: string
  actorUserId: string
  input: Partial<SchedulingEventWriteInput>
}) {
  const existing = await getScopedEvent(tx, workspaceId, eventId)
  await tx.schedulingEvent.update({
    where: { id: existing.id },
    data: buildEventData({
      workspaceId,
      actorUserId,
      input,
      isCreate: false,
    }) as Prisma.SchedulingEventUncheckedUpdateInput,
  })
  if (
    existing.recurrenceSeriesId &&
    existing.occurrenceOriginalAt &&
    existing.occurrenceState === PrismaSchedulingOccurrenceState.GENERATED
  ) {
    await tx.schedulingEvent.update({
      where: { id: existing.id },
      data: {
        occurrenceState: PrismaSchedulingOccurrenceState.OVERRIDDEN,
        overrideFields: Object.keys(input).sort() as Prisma.InputJsonValue,
      },
    })
  }
  if (input.assignedMemberIds) {
    await replaceEventAssignments(tx, {
      workspaceId,
      eventId,
      assignedMemberIds: input.assignedMemberIds,
    })
  }
  if (input.attendees) {
    await replaceEventAttendees(tx, {
      workspaceId,
      eventId,
      attendees: input.attendees,
    })
  }
  if (existing.occurrenceState === PrismaSchedulingOccurrenceState.MASTER) {
    const master = await tx.schedulingEvent.findUnique({
      where: { id: existing.id },
      include: eventInclude,
    })
    const series = await tx.schedulingRecurrenceSeries.findUnique({
      where: { masterEventId: existing.id },
      include: { masterEvent: { include: eventInclude } },
    })
    const rule =
      input.recurrenceRule ??
      (master?.recurrenceRule as SchedulingEvent['recurrenceRule'])
    if (master && series && rule) {
      const recurrence = normalizeRecurrenceOrThrow({
        rule,
        startsAt: master.startsAtUtc,
        endsAt: master.endsAtUtc,
        timezone: master.timezone,
      })
      const updatedSeries = await tx.schedulingRecurrenceSeries.update({
        where: { id: series.id },
        data: {
          timezone: recurrence.timezone,
          rrule: recurrence.rrule,
          startsAtLocal: `${recurrence.localStartDate}T${recurrence.localStartTime}`,
          localStartDate: recurrence.localStartDate,
          localStartTime: recurrence.localStartTime,
          durationMinutes: recurrence.durationMinutes,
          normalizedRule: recurrence.rule as Prisma.InputJsonValue,
          untilUtc: recurrence.untilUtc,
          occurrenceCount: recurrence.occurrenceCount,
          metadata: { summary: recurrence.summary },
          version: { increment: 1 },
        },
        include: { masterEvent: { include: eventInclude } },
      })
      const defaultRange = getDefaultMaterializationRange()
      await materializeRecurrenceSeries({
        db: tx,
        workspaceId,
        series: updatedSeries,
        rangeStart: defaultRange.rangeStart,
        rangeEnd: defaultRange.rangeEnd,
      })
    }
  }
  await appendActivity(tx, {
    workspaceId,
    eventId,
    actorId: actorUserId,
    action: 'updated',
    summary: 'Event updated.',
    metadata: { beforeStatus: statusFromPrisma(existing.status) },
  })
  await appendOutbox(tx, {
    workspaceId,
    topic: 'scheduling.event.updated',
    aggregateId: eventId,
    payload: { eventId },
  })
  return eventToDomain(await getScopedEvent(tx, workspaceId, eventId))
}

type MaterializationSeries = Prisma.SchedulingRecurrenceSeriesGetPayload<{
  include: {
    masterEvent: { include: typeof eventInclude }
  }
}>

function getDefaultMaterializationRange() {
  const now = new Date()
  return {
    rangeStart: new Date(
      now.getTime() - RECURRENCE_MATERIALIZATION_DAYS_BEHIND * 86_400_000,
    ),
    rangeEnd: new Date(
      now.getTime() + RECURRENCE_MATERIALIZATION_DAYS_AHEAD * 86_400_000,
    ),
  }
}

function recurrenceFromSeries(
  series: MaterializationSeries,
): NormalizedSchedulingRecurrence | null {
  const rule =
    (series.normalizedRule as SchedulingEvent['recurrenceRule']) ??
    (series.masterEvent.recurrenceRule as SchedulingEvent['recurrenceRule'])
  if (!rule) return null
  const localStartDate =
    series.localStartDate ??
    (series.startsAtLocal?.slice(0, 10) as string | undefined) ??
    getWorkspaceDateKey(series.masterEvent.startsAtUtc, series.timezone)
  const localStartTime =
    series.localStartTime ??
    series.startsAtLocal?.slice(11, 16) ??
    getWorkspaceTimeInputValue(series.masterEvent.startsAtUtc, series.timezone)
  if (!localStartDate || !localStartTime) return null
  const metadata =
    series.metadata &&
    typeof series.metadata === 'object' &&
    !Array.isArray(series.metadata)
      ? (series.metadata as Record<string, unknown>)
      : {}
  return {
    rule,
    rrule: series.rrule,
    summary: metadata.summary ? String(metadata.summary) : series.rrule,
    localStartDate,
    localStartTime,
    timezone: series.timezone,
    durationMinutes: series.durationMinutes,
    untilUtc: series.untilUtc ?? undefined,
    occurrenceCount: series.occurrenceCount ?? undefined,
  }
}

function occurrenceCreateData({
  workspaceId,
  master,
  series,
  occurrence,
}: {
  workspaceId: string
  master: MaterializationSeries['masterEvent']
  series: MaterializationSeries
  occurrence: ReturnType<typeof generateRecurrenceOccurrences>[number]
}): Prisma.SchedulingEventUncheckedCreateInput {
  return {
    workspaceId,
    eventTypeKey: master.eventTypeKey,
    title: master.title,
    description: master.description,
    status: master.status,
    startsAtUtc: occurrence.startsAtUtc,
    endsAtUtc: occurrence.endsAtUtc,
    timezone: series.timezone,
    allDay: master.allDay,
    locationType: master.locationType,
    locationLabel: master.locationLabel,
    locationAddress: master.locationAddress,
    meetingUrl: master.meetingUrl,
    recurrenceSeriesId: series.id,
    recurrenceRule: undefined,
    recurrenceTimezone: series.timezone,
    occurrenceOriginalAt: occurrence.originalStartsAtUtc,
    occurrenceState: PrismaSchedulingOccurrenceState.GENERATED,
    linkedRecordType: master.linkedRecordType,
    linkedRecordId: master.linkedRecordId,
    linkedRecordLabel: master.linkedRecordLabel,
    blocksAvailability: master.blocksAvailability,
    externalVisibility: master.externalVisibility,
    syncPolicy: master.syncPolicy,
    createdByUserId: master.createdByUserId,
    updatedByUserId: master.updatedByUserId,
  }
}

function recurrenceSeriesStatusFromPrisma(
  status: PrismaSchedulingRecurrenceSeriesStatus,
): SchedulingSeries['status'] {
  if (status === PrismaSchedulingRecurrenceSeriesStatus.ACTIVE) return 'active'
  if (status === PrismaSchedulingRecurrenceSeriesStatus.PAUSED) return 'paused'
  if (status === PrismaSchedulingRecurrenceSeriesStatus.CANCELED)
    return 'canceled'
  return 'completed'
}

async function copyOccurrenceAssignmentsAndAttendees(
  db: DbOrTx,
  {
    workspaceId,
    master,
    eventId,
  }: {
    workspaceId: string
    master: MaterializationSeries['masterEvent']
    eventId: string
  },
) {
  await db.schedulingAssignment.deleteMany({ where: { workspaceId, eventId } })
  if (master.assignments.length) {
    await db.schedulingAssignment.createMany({
      data: master.assignments.map((assignment) => ({
        workspaceId,
        eventId,
        assignmentType: assignment.assignmentType,
        workspaceMemberId: assignment.workspaceMemberId,
        teamId: assignment.teamId,
        roleLabel: assignment.roleLabel,
        displaySnapshot: assignment.displaySnapshot,
        notificationState:
          assignment.notificationState as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    })
  }

  await db.schedulingAttendee.deleteMany({ where: { workspaceId, eventId } })
  if (master.attendees.length) {
    await db.schedulingAttendee.createMany({
      data: master.attendees.map((attendee) => ({
        workspaceId,
        eventId,
        attendeeType: attendee.attendeeType,
        name: attendee.name,
        email: attendee.email,
        responseStatus: attendee.responseStatus,
        isOrganizer: attendee.isOrganizer,
        isOptional: attendee.isOptional,
      })),
      skipDuplicates: true,
    })
  }
}

async function copyEventAssignmentsAndAttendees(
  db: DbOrTx,
  {
    workspaceId,
    source,
    eventId,
  }: {
    workspaceId: string
    source: MaterializationSeries['masterEvent']
    eventId: string
  },
) {
  await db.schedulingAssignment.deleteMany({ where: { workspaceId, eventId } })
  if (source.assignments.length) {
    await db.schedulingAssignment.createMany({
      data: source.assignments.map((assignment) => ({
        workspaceId,
        eventId,
        assignmentType: assignment.assignmentType,
        workspaceMemberId: assignment.workspaceMemberId,
        teamId: assignment.teamId,
        roleLabel: assignment.roleLabel,
        displaySnapshot: assignment.displaySnapshot,
        notificationState:
          assignment.notificationState as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    })
  }

  await db.schedulingAttendee.deleteMany({ where: { workspaceId, eventId } })
  if (source.attendees.length) {
    await db.schedulingAttendee.createMany({
      data: source.attendees.map((attendee) => ({
        workspaceId,
        eventId,
        attendeeType: attendee.attendeeType,
        name: attendee.name,
        email: attendee.email,
        responseStatus: attendee.responseStatus,
        isOrganizer: attendee.isOrganizer,
        isOptional: attendee.isOptional,
      })),
      skipDuplicates: true,
    })
  }
}

function deriveOverrideFields({
  occurrence,
  master,
}: {
  occurrence: MaterializationSeries['masterEvent']
  master: MaterializationSeries['masterEvent']
}) {
  const fields = new Set<string>()
  if (occurrence.title !== master.title) fields.add('title')
  if ((occurrence.description ?? null) !== (master.description ?? null)) {
    fields.add('description')
  }
  if (
    occurrence.startsAtUtc.getTime() !==
    occurrence.occurrenceOriginalAt?.getTime()
  ) {
    fields.add('time')
  }
  if (
    occurrence.endsAtUtc.getTime() - occurrence.startsAtUtc.getTime() !==
    master.endsAtUtc.getTime() - master.startsAtUtc.getTime()
  ) {
    fields.add('duration')
  }
  if ((occurrence.locationType ?? null) !== (master.locationType ?? null)) {
    fields.add('location')
  }
  if ((occurrence.locationLabel ?? null) !== (master.locationLabel ?? null)) {
    fields.add('location')
  }
  if (
    (occurrence.locationAddress ?? null) !== (master.locationAddress ?? null)
  ) {
    fields.add('location')
  }
  if ((occurrence.meetingUrl ?? null) !== (master.meetingUrl ?? null)) {
    fields.add('location')
  }
  if (occurrence.status !== master.status) fields.add('status')
  if (occurrence.eventTypeKey !== master.eventTypeKey) fields.add('eventType')
  if (
    (occurrence.linkedRecordType ?? null) !==
      (master.linkedRecordType ?? null) ||
    (occurrence.linkedRecordId ?? null) !== (master.linkedRecordId ?? null)
  ) {
    fields.add('linkedRecord')
  }
  if (
    occurrence.assignments
      .map(
        (assignment) => assignment.workspaceMemberId ?? assignment.teamId ?? '',
      )
      .join('|') !==
    master.assignments
      .map(
        (assignment) => assignment.workspaceMemberId ?? assignment.teamId ?? '',
      )
      .join('|')
  ) {
    fields.add('assignments')
  }
  return [...fields].sort()
}

async function materializeRecurrenceSeries({
  db,
  workspaceId,
  series,
  rangeStart,
  rangeEnd,
}: {
  db: DbOrTx
  workspaceId: string
  series: MaterializationSeries
  rangeStart: Date
  rangeEnd: Date
}) {
  if (series.status !== PrismaSchedulingRecurrenceSeriesStatus.ACTIVE) {
    return []
  }
  const recurrence = recurrenceFromSeries(series)
  if (!recurrence) return []
  const generated = generateRecurrenceOccurrences({
    recurrence,
    rangeStart,
    rangeEnd,
  })
  const materializedIds: string[] = []
  for (const occurrence of generated) {
    const existing = await db.schedulingEvent.findFirst({
      where: {
        workspaceId,
        recurrenceSeriesId: series.id,
        occurrenceOriginalAt: occurrence.originalStartsAtUtc,
        deletedAt: null,
      },
      include: eventInclude,
    })
    if (
      existing?.occurrenceState &&
      existing.occurrenceState !== PrismaSchedulingOccurrenceState.GENERATED
    ) {
      materializedIds.push(existing.id)
      continue
    }
    if (existing) {
      await db.schedulingEvent.update({
        where: { id: existing.id },
        data: {
          ...occurrenceCreateData({
            workspaceId,
            master: series.masterEvent,
            series,
            occurrence,
          }),
          id: undefined,
          workspaceId: undefined,
          recurrenceSeriesId: undefined,
          occurrenceOriginalAt: undefined,
          createdByUserId: undefined,
        },
      })
      await copyOccurrenceAssignmentsAndAttendees(db, {
        workspaceId,
        master: series.masterEvent,
        eventId: existing.id,
      })
      materializedIds.push(existing.id)
      continue
    }
    const created = await db.schedulingEvent.create({
      data: occurrenceCreateData({
        workspaceId,
        master: series.masterEvent,
        series,
        occurrence,
      }),
      select: { id: true },
    })
    await copyOccurrenceAssignmentsAndAttendees(db, {
      workspaceId,
      master: series.masterEvent,
      eventId: created.id,
    })
    materializedIds.push(created.id)
  }

  const generatedThroughUtc =
    generated.length > 0
      ? generated.reduce(
          (latest, occurrence) =>
            occurrence.startsAtUtc > latest ? occurrence.startsAtUtc : latest,
          generated[0].startsAtUtc,
        )
      : undefined
  if (
    generatedThroughUtc &&
    (!series.generatedThroughUtc ||
      generatedThroughUtc.getTime() > series.generatedThroughUtc.getTime())
  ) {
    await db.schedulingRecurrenceSeries.update({
      where: { id: series.id },
      data: { generatedThroughUtc, version: { increment: 1 } },
    })
  }
  return materializedIds
}

async function materializeActiveRecurrenceSeriesForRange({
  db,
  workspaceId,
  rangeStart,
  rangeEnd,
}: {
  db: DbOrTx
  workspaceId: string
  rangeStart: Date
  rangeEnd: Date
}) {
  const series = await db.schedulingRecurrenceSeries.findMany({
    where: {
      workspaceId,
      status: PrismaSchedulingRecurrenceSeriesStatus.ACTIVE,
      OR: [{ untilUtc: null }, { untilUtc: { gte: rangeStart } }],
    },
    include: { masterEvent: { include: eventInclude } },
  })
  for (const item of series) {
    await runRecurrenceTransaction({
      workspaceId,
      seriesIds: [item.id],
      mutationKind: 'materialize',
      request: {
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
      },
      callback: async (tx) => {
        const lockedSeries = await tx.schedulingRecurrenceSeries.findFirst({
          where: {
            id: item.id,
            workspaceId,
            status: PrismaSchedulingRecurrenceSeriesStatus.ACTIVE,
          },
          include: { masterEvent: { include: eventInclude } },
        })
        if (!lockedSeries) return []
        return materializeRecurrenceSeries({
          db: tx,
          workspaceId,
          series: lockedSeries,
          rangeStart,
          rangeEnd,
        })
      },
    })
  }
}

async function getScopedRecurringOccurrence(
  db: DbOrTx,
  {
    workspaceId,
    occurrenceId,
  }: {
    workspaceId: string
    occurrenceId: string
  },
) {
  const occurrence = await db.schedulingEvent.findFirst({
    where: {
      id: occurrenceId,
      workspaceId,
      deletedAt: null,
      recurrenceSeriesId: { not: null },
      occurrenceOriginalAt: { not: null },
      occurrenceState: {
        notIn: [
          PrismaSchedulingOccurrenceState.DETACHED,
          PrismaSchedulingOccurrenceState.SUPERSEDED,
          PrismaSchedulingOccurrenceState.DELETED,
        ],
      },
    },
    include: eventInclude,
  })
  if (!occurrence?.recurrenceSeriesId || !occurrence.occurrenceOriginalAt) {
    throw new SchedulingRepositoryError(
      'Choose a recurring occurrence in this workspace.',
      'not_found',
    )
  }
  const series = await db.schedulingRecurrenceSeries.findFirst({
    where: {
      id: occurrence.recurrenceSeriesId,
      workspaceId,
      status: { not: PrismaSchedulingRecurrenceSeriesStatus.CANCELED },
    },
    include: { masterEvent: { include: eventInclude } },
  })
  if (!series) {
    throw new SchedulingRepositoryError(
      'This recurring series could not be found.',
      'not_found',
    )
  }
  return { occurrence, series }
}

async function getRecurringSeriesIdForOccurrence({
  workspaceId,
  occurrenceId,
}: {
  workspaceId: string
  occurrenceId: string
}) {
  const occurrence = await prisma.schedulingEvent.findFirst({
    where: {
      id: occurrenceId,
      workspaceId,
      deletedAt: null,
      recurrenceSeriesId: { not: null },
      occurrenceOriginalAt: { not: null },
    },
    select: { recurrenceSeriesId: true },
  })
  if (!occurrence?.recurrenceSeriesId) {
    throw new SchedulingRepositoryError(
      'Choose a recurring occurrence in this workspace.',
      'not_found',
    )
  }
  return occurrence.recurrenceSeriesId
}

function getSplitBoundary({
  occurrence,
}: {
  occurrence: Prisma.SchedulingEventGetPayload<{ include: typeof eventInclude }>
}) {
  const boundaryUtc = occurrence.occurrenceOriginalAt ?? occurrence.startsAtUtc
  const localDate = getWorkspaceDateKey(boundaryUtc, occurrence.timezone)
  const previousLocalDate = addDateKeys(localDate, -1)
  const originalSeriesUntilUtc = combineDateAndTimeInTimezone({
    dateKey: previousLocalDate,
    time: '23:59',
    timezone: occurrence.timezone,
    milliseconds: 999,
  })
  return { boundaryUtc, localDate, previousLocalDate, originalSeriesUntilUtc }
}

function truncateRuleBeforeSplit({
  rule,
  previousLocalDate,
}: {
  rule: SchedulingEvent['recurrenceRule']
  previousLocalDate: string
}) {
  if (!rule) return null
  return {
    ...rule,
    endType: 'onDate' as const,
    endDate: previousLocalDate,
    occurrenceCount: undefined,
  }
}

function buildMasterInputFromOccurrence({
  occurrence,
  input,
}: {
  occurrence: Prisma.SchedulingEventGetPayload<{ include: typeof eventInclude }>
  input: Partial<SchedulingEventWriteInput>
}): SchedulingEventWriteInput {
  return {
    type: (input.type ??
      occurrence.eventTypeKey) as SchedulingEventWriteInput['type'],
    title: input.title ?? occurrence.title,
    description:
      input.description !== undefined
        ? input.description
        : (occurrence.description ?? undefined),
    status: input.status ?? statusFromPrisma(occurrence.status),
    startsAt: input.startsAt ?? occurrence.startsAtUtc.toISOString(),
    endsAt: input.endsAt ?? occurrence.endsAtUtc.toISOString(),
    allDay: input.allDay ?? occurrence.allDay,
    timezone: input.timezone ?? occurrence.timezone,
    locationType:
      input.locationType ??
      locationTypeFromPrisma(occurrence.locationType, occurrence.locationLabel),
    location: input.location ?? occurrence.locationLabel ?? undefined,
    locationLabel:
      input.locationLabel !== undefined
        ? input.locationLabel
        : (occurrence.locationLabel ?? undefined),
    locationAddress:
      input.locationAddress !== undefined
        ? input.locationAddress
        : (occurrence.locationAddress ?? undefined),
    meetingUrl:
      input.meetingUrl !== undefined
        ? input.meetingUrl
        : (occurrence.meetingUrl ?? undefined),
    phoneNumber: input.phoneNumber,
    assignedMemberIds:
      input.assignedMemberIds ??
      occurrence.assignments
        .filter((assignment) => assignment.workspaceMemberId)
        .map((assignment) => assignment.workspaceMemberId as string),
    linkedRecord:
      input.linkedRecord !== undefined
        ? input.linkedRecord
        : occurrence.linkedRecordType && occurrence.linkedRecordId
          ? {
              recordType: occurrence.linkedRecordType as NonNullable<
                SchedulingEventWriteInput['linkedRecord']
              >['recordType'],
              recordId: occurrence.linkedRecordId,
              label: occurrence.linkedRecordLabel ?? occurrence.linkedRecordId,
            }
          : null,
    recurrenceRule: input.recurrenceRule ?? undefined,
    attendees: input.attendees,
    externalCalendarState: 'notConnected',
  }
}

async function splitRecurringSeries({
  tx,
  workspaceId,
  actorUserId,
  occurrenceId,
  input,
  mode,
}: {
  tx: Tx
  workspaceId: string
  actorUserId: string
  occurrenceId: string
  input: Partial<SchedulingEventWriteInput>
  mode: 'edit' | 'cancel' | 'delete'
}) {
  const { occurrence, series } = await getScopedRecurringOccurrence(tx, {
    workspaceId,
    occurrenceId,
  })
  const { boundaryUtc, localDate, previousLocalDate, originalSeriesUntilUtc } =
    getSplitBoundary({ occurrence })
  const existingRule =
    (series.normalizedRule as SchedulingEvent['recurrenceRule']) ??
    (series.masterEvent.recurrenceRule as SchedulingEvent['recurrenceRule'])
  const truncatedRule = truncateRuleBeforeSplit({
    rule: existingRule,
    previousLocalDate,
  })
  if (!truncatedRule) {
    throw new SchedulingRepositoryError(
      'This recurring series is missing a valid recurrence rule.',
      'invalid_input',
    )
  }
  const normalizedOriginal = normalizeRecurrenceOrThrow({
    rule: truncatedRule,
    startsAt: series.masterEvent.startsAtUtc,
    endsAt: series.masterEvent.endsAtUtc,
    timezone: series.timezone,
  })
  await tx.schedulingRecurrenceSeries.update({
    where: { id: series.id },
    data: {
      rrule: normalizedOriginal.rrule,
      normalizedRule: normalizedOriginal.rule as Prisma.InputJsonValue,
      untilUtc: originalSeriesUntilUtc,
      occurrenceCount: null,
      generatedThroughUtc: originalSeriesUntilUtc,
      version: { increment: 1 },
      metadata: {
        ...(series.metadata &&
        typeof series.metadata === 'object' &&
        !Array.isArray(series.metadata)
          ? (series.metadata as Record<string, unknown>)
          : {}),
        splitForwardAt: boundaryUtc.toISOString(),
      },
    },
  })

  if (mode === 'cancel' || mode === 'delete') {
    await tx.schedulingEvent.updateMany({
      where: {
        workspaceId,
        recurrenceSeriesId: series.id,
        occurrenceOriginalAt: { gte: boundaryUtc },
        occurrenceState: {
          notIn: [
            PrismaSchedulingOccurrenceState.COMPLETED,
            PrismaSchedulingOccurrenceState.CANCELED,
            PrismaSchedulingOccurrenceState.DELETED,
          ],
        },
      },
      data:
        mode === 'cancel'
          ? {
              status: PrismaSchedulingEventStatus.CANCELED,
              occurrenceState: PrismaSchedulingOccurrenceState.CANCELED,
              canceledAt: new Date(),
              updatedByUserId: actorUserId,
            }
          : {
              deletedAt: new Date(),
              occurrenceState: PrismaSchedulingOccurrenceState.DELETED,
              updatedByUserId: actorUserId,
            },
    })
    await appendActivity(tx, {
      workspaceId,
      eventId: occurrence.id,
      actorId: actorUserId,
      action:
        mode === 'cancel'
          ? 'recurrence_following_canceled'
          : 'recurrence_following_deleted',
      summary:
        mode === 'cancel'
          ? 'This and future occurrences canceled.'
          : 'This and future occurrences deleted.',
      metadata: {
        scope: 'thisAndFollowing',
        seriesId: series.id,
        occurrenceId,
        splitBoundaryUtc: boundaryUtc.toISOString(),
      },
    })
    await appendOutbox(tx, {
      workspaceId,
      topic:
        mode === 'cancel'
          ? 'scheduling.recurrence.following_canceled'
          : 'scheduling.recurrence.following_deleted',
      aggregateId: series.id,
      payload: {
        seriesId: series.id,
        occurrenceId,
        scope: 'thisAndFollowing',
        actorUserId,
        splitBoundaryUtc: boundaryUtc.toISOString(),
      },
    })
    return {
      originalSeriesId: series.id,
      resultingSeriesId: undefined,
      affectedOccurrenceIds: [occurrenceId],
    }
  }

  const newMasterInput = buildMasterInputFromOccurrence({
    occurrence,
    input: {
      ...input,
      startsAt:
        input.startsAt ??
        combineDateAndTimeInTimezone({
          dateKey: localDate,
          time:
            series.localStartTime ??
            getWorkspaceTimeInputValue(boundaryUtc, series.timezone),
          timezone: input.timezone ?? series.timezone,
        }).toISOString(),
      recurrenceRule: input.recurrenceRule ?? existingRule,
    },
  })
  validateEventTiming(newMasterInput)
  if (!newMasterInput.recurrenceRule) {
    throw new SchedulingRepositoryError(
      'This recurring series is missing a valid recurrence rule.',
      'invalid_input',
    )
  }
  await validateAssignments({
    db: tx,
    workspaceId,
    assignedMemberIds: newMasterInput.assignedMemberIds,
  })
  const recurrence = normalizeRecurrenceOrThrow({
    rule: newMasterInput.recurrenceRule,
    startsAt: newMasterInput.startsAt,
    endsAt: newMasterInput.endsAt,
    timezone: newMasterInput.timezone,
  })
  const newMaster = await tx.schedulingEvent.create({
    data: {
      ...(buildEventData({
        workspaceId,
        actorUserId,
        input: { ...newMasterInput, recurrenceRule: recurrence.rule },
        isCreate: true,
      }) as Prisma.SchedulingEventUncheckedCreateInput),
      occurrenceState: PrismaSchedulingOccurrenceState.MASTER,
      recurrenceTimezone: recurrence.timezone,
    },
    include: eventInclude,
  })
  await replaceEventAssignments(tx, {
    workspaceId,
    eventId: newMaster.id,
    assignedMemberIds: newMasterInput.assignedMemberIds,
  })
  await replaceEventAttendees(tx, {
    workspaceId,
    eventId: newMaster.id,
    attendees: newMasterInput.attendees,
  })
  const newSeries = await tx.schedulingRecurrenceSeries.create({
    data: {
      workspaceId,
      masterEventId: newMaster.id,
      splitFromSeriesId: series.id,
      splitAtOccurrenceId: occurrenceId,
      splitBoundaryUtc: boundaryUtc,
      timezone: recurrence.timezone,
      rrule: recurrence.rrule,
      startsAtLocal: `${recurrence.localStartDate}T${recurrence.localStartTime}`,
      localStartDate: recurrence.localStartDate,
      localStartTime: recurrence.localStartTime,
      durationMinutes: recurrence.durationMinutes,
      normalizedRule: recurrence.rule as Prisma.InputJsonValue,
      untilUtc: recurrence.untilUtc,
      occurrenceCount: recurrence.occurrenceCount,
      metadata: {
        summary: recurrence.summary,
        splitFromSeriesId: series.id,
        splitAtOccurrenceId: occurrenceId,
        splitAtOriginalStartUtc: boundaryUtc.toISOString(),
      },
      status: PrismaSchedulingRecurrenceSeriesStatus.ACTIVE,
    },
    include: { masterEvent: { include: eventInclude } },
  })

  const futureRows = await tx.schedulingEvent.findMany({
    where: {
      workspaceId,
      recurrenceSeriesId: series.id,
      occurrenceOriginalAt: { gte: boundaryUtc },
      deletedAt: null,
    },
    include: eventInclude,
  })
  const generatedIds = futureRows
    .filter(
      (row) =>
        !row.occurrenceState ||
        row.occurrenceState === PrismaSchedulingOccurrenceState.GENERATED,
    )
    .map((row) => row.id)
  const overrideRows = futureRows.filter(
    (row) =>
      row.occurrenceState === PrismaSchedulingOccurrenceState.OVERRIDDEN ||
      row.occurrenceState === PrismaSchedulingOccurrenceState.CANCELED ||
      row.occurrenceState === PrismaSchedulingOccurrenceState.COMPLETED,
  )
  if (generatedIds.length) {
    await tx.schedulingEvent.updateMany({
      where: { id: { in: generatedIds }, workspaceId },
      data: {
        deletedAt: new Date(),
        occurrenceState: PrismaSchedulingOccurrenceState.SUPERSEDED,
        recurrenceLineage: {
          splitToSeriesId: newSeries.id,
          splitFromSeriesId: series.id,
          splitBoundaryUtc: boundaryUtc.toISOString(),
          supersededReason: 'series_split_generated_replacement',
        },
        updatedByUserId: actorUserId,
      },
    })
  }
  const defaultRange = getDefaultMaterializationRange()
  const materializedIds = await materializeRecurrenceSeries({
    db: tx,
    workspaceId,
    series: newSeries,
    rangeStart:
      boundaryUtc > defaultRange.rangeStart
        ? defaultRange.rangeStart
        : boundaryUtc,
    rangeEnd: defaultRange.rangeEnd,
  })
  const targets = await tx.schedulingEvent.findMany({
    where: {
      workspaceId,
      recurrenceSeriesId: newSeries.id,
      occurrenceOriginalAt: { gte: boundaryUtc },
      deletedAt: null,
      occurrenceState: PrismaSchedulingOccurrenceState.GENERATED,
    },
    orderBy: { occurrenceOriginalAt: 'asc' },
    select: {
      id: true,
      occurrenceOriginalAt: true,
      startsAtUtc: true,
    },
  })
  const remapTargets = targets.map((target, ordinal) => ({
    occurrenceId: target.id,
    originalStartUtc: target.occurrenceOriginalAt ?? target.startsAtUtc,
    originalLocalDateKey: getWorkspaceDateKey(
      target.occurrenceOriginalAt ?? target.startsAtUtc,
      newSeries.timezone,
    ),
    originalLocalTime: getWorkspaceTimeInputValue(
      target.occurrenceOriginalAt ?? target.startsAtUtc,
      newSeries.timezone,
    ),
    ordinal,
  }))
  const remapDecisions: RecurrenceOverrideRemapDecision[] = []
  const detachedOverrideIds: string[] = []
  const remappedOverrideIds: string[] = []

  for (const [ordinal, row] of overrideRows.entries()) {
    const originalStart = row.occurrenceOriginalAt ?? row.startsAtUtc
    const decision = decideRecurrenceOverrideRemap({
      candidate: {
        occurrenceId: row.id,
        originalStartUtc: originalStart,
        originalLocalDateKey: getWorkspaceDateKey(
          originalStart,
          series.timezone,
        ),
        originalLocalTime: getWorkspaceTimeInputValue(
          originalStart,
          series.timezone,
        ),
        currentStartUtc: row.startsAtUtc,
        currentEndUtc: row.endsAtUtc,
        state: occurrenceStateFromPrisma(row.occurrenceState) ?? 'overridden',
        overrideFields: deriveOverrideFields({
          occurrence: row,
          master: series.masterEvent,
        }),
      },
      targets: remapTargets,
      ordinal,
      oldRule: existingRule,
      newRule: recurrence.rule,
    })
    remapDecisions.push(decision)
    if (decision.action === 'remap') {
      const overrideFields = deriveOverrideFields({
        occurrence: row,
        master: series.masterEvent,
      })
      await tx.schedulingEvent.update({
        where: { id: decision.targetOccurrenceId },
        data: {
          eventTypeKey: row.eventTypeKey,
          title: row.title,
          description: row.description,
          status: row.status,
          startsAtUtc: row.startsAtUtc,
          endsAtUtc: row.endsAtUtc,
          timezone: row.timezone,
          allDay: row.allDay,
          locationType: row.locationType,
          locationLabel: row.locationLabel,
          locationAddress: row.locationAddress,
          meetingUrl: row.meetingUrl,
          linkedRecordType: row.linkedRecordType,
          linkedRecordId: row.linkedRecordId,
          linkedRecordLabel: row.linkedRecordLabel,
          blocksAvailability: row.blocksAvailability,
          externalVisibility: row.externalVisibility,
          syncPolicy: row.syncPolicy,
          occurrenceState:
            row.occurrenceState === PrismaSchedulingOccurrenceState.CANCELED ||
            row.occurrenceState === PrismaSchedulingOccurrenceState.COMPLETED
              ? row.occurrenceState
              : PrismaSchedulingOccurrenceState.OVERRIDDEN,
          canceledAt: row.canceledAt,
          completedAt: row.completedAt,
          overrideFields: overrideFields as Prisma.InputJsonValue,
          recurrenceLineage: {
            remappedFromOccurrenceId: row.id,
            splitFromSeriesId: series.id,
            splitToSeriesId: newSeries.id,
            remapStrategy: decision.strategy,
            remappedAt: new Date().toISOString(),
          },
          updatedByUserId: actorUserId,
        },
      })
      await copyEventAssignmentsAndAttendees(tx, {
        workspaceId,
        source: row,
        eventId: decision.targetOccurrenceId,
      })
      await tx.schedulingEvent.update({
        where: { id: row.id },
        data: {
          deletedAt: new Date(),
          occurrenceState: PrismaSchedulingOccurrenceState.SUPERSEDED,
          recurrenceLineage: {
            remappedToOccurrenceId: decision.targetOccurrenceId,
            splitToSeriesId: newSeries.id,
            splitFromSeriesId: series.id,
            remapStrategy: decision.strategy,
            remappedAt: new Date().toISOString(),
          },
          updatedByUserId: actorUserId,
        },
      })
      remappedOverrideIds.push(row.id)
      continue
    }
    await tx.schedulingEvent.update({
      where: { id: row.id },
      data: {
        recurrenceSeriesId: null,
        occurrenceState: PrismaSchedulingOccurrenceState.DETACHED,
        recurrenceLineage: {
          splitFromSeriesId: series.id,
          splitToSeriesId: newSeries.id,
          splitBoundaryUtc: boundaryUtc.toISOString(),
          detachReason: decision.reason,
          remapStrategy: decision.strategy,
          detachedAt: new Date().toISOString(),
        },
        updatedByUserId: actorUserId,
      },
    })
    detachedOverrideIds.push(row.id)
  }
  await appendActivity(tx, {
    workspaceId,
    eventId: newMaster.id,
    actorId: actorUserId,
    action: 'recurrence_series_split',
    summary: `Recurring series split beginning ${localDate}.`,
    metadata: {
      scope: 'thisAndFollowing',
      seriesId: series.id,
      newSeriesId: newSeries.id,
      occurrenceId,
      splitBoundaryUtc: boundaryUtc.toISOString(),
      detachedOverrideIds,
      remappedOverrideIds,
      overrideRemapDecisions: remapDecisions,
      removedGeneratedIds: generatedIds,
    },
  })
  await appendOutbox(tx, {
    workspaceId,
    topic: 'scheduling.recurrence.series_split',
    aggregateId: newSeries.id,
    payload: {
      originalSeriesId: series.id,
      newSeriesId: newSeries.id,
      occurrenceId,
      scope: 'thisAndFollowing',
      actorUserId,
      splitBoundaryUtc: boundaryUtc.toISOString(),
      detachedOverrideIds,
      remappedOverrideIds,
      overrideRemapDecisions: remapDecisions,
      removedGeneratedIds: generatedIds,
    },
  })
  return {
    originalSeriesId: series.id,
    resultingSeriesId: newSeries.id,
    affectedOccurrenceIds: materializedIds,
  }
}

async function replaceEventAssignments(
  db: DbOrTx,
  {
    workspaceId,
    eventId,
    assignedMemberIds,
  }: {
    workspaceId: string
    eventId: string
    assignedMemberIds: string[]
  },
) {
  const validMemberIds = await validateAssignments({
    db,
    workspaceId,
    assignedMemberIds,
  })
  await db.schedulingAssignment.deleteMany({ where: { workspaceId, eventId } })
  if (validMemberIds.length === 0) return
  await db.schedulingAssignment.createMany({
    data: validMemberIds.map((workspaceMemberId) => ({
      workspaceId,
      eventId,
      assignmentType: SchedulingAssignmentType.MEMBER,
      workspaceMemberId,
    })),
    skipDuplicates: true,
  })
}

async function replaceEventAttendees(
  db: DbOrTx,
  {
    workspaceId,
    eventId,
    attendees,
  }: {
    workspaceId: string
    eventId: string
    attendees?: SchedulingAttendeeInput[]
  },
) {
  if (!attendees) return
  await db.schedulingAttendee.deleteMany({ where: { workspaceId, eventId } })
  const normalized = attendees
    .map((attendee) => ({
      ...attendee,
      email: attendee.email.trim().toLowerCase(),
    }))
    .filter((attendee) => attendee.email)
  if (normalized.length === 0) return
  await db.schedulingAttendee.createMany({
    data: normalized.map((attendee) => ({
      workspaceId,
      eventId,
      attendeeType: attendeeTypeToPrisma(attendee.attendeeType),
      name: attendee.name,
      email: attendee.email,
      responseStatus: responseStatusToPrisma(attendee.responseStatus),
      isOrganizer: attendee.isOrganizer ?? false,
      isOptional: attendee.isOptional ?? false,
    })),
    skipDuplicates: true,
  })
}

async function getScopedEvent(
  db: DbOrTx,
  workspaceId: string,
  eventId: string,
) {
  const event = await db.schedulingEvent.findFirst({
    where: { id: eventId, workspaceId },
    include: eventInclude,
  })
  if (!event) {
    throw new SchedulingRepositoryError(
      'This event could not be found in the active workspace.',
      'not_found',
    )
  }
  return event
}

function availabilityToDomain(
  record: Prisma.SchedulingAvailabilityRecordGetPayload<{}>,
): TeamAvailabilityRecord {
  if (record.kind === SchedulingAvailabilityRecordKind.WORKING_HOURS) {
    const locationId = record.teamId?.startsWith('location:')
      ? record.teamId.slice('location:'.length)
      : undefined
    const scope = locationId
      ? 'location'
      : record.teamId
        ? 'team'
        : record.memberId
          ? 'member'
          : 'workspace'
    return normalizeWorkingHoursRecord({
      id: record.id,
      workspaceId: record.workspaceId,
      kind: 'workingHours',
      scope,
      memberId: record.memberId ?? record.teamId ?? '',
      memberName: record.title ?? record.memberId ?? record.teamId ?? undefined,
      workspaceMemberId: record.memberId ?? undefined,
      teamId: scope === 'team' ? record.teamId : undefined,
      teamName: scope === 'team' ? (record.title ?? undefined) : undefined,
      locationId,
      locationName: locationId ? (record.title ?? undefined) : undefined,
      scheduleMode:
        record.startTimeMinutes === null || record.endTimeMinutes === null
          ? 'inherit'
          : 'custom',
      daysOfWeek: record.daysOfWeek,
      startsAt:
        record.startTimeMinutes === null
          ? undefined
          : timeFromMinutes(record.startTimeMinutes),
      endsAt:
        record.endTimeMinutes === null
          ? undefined
          : timeFromMinutes(record.endTimeMinutes),
      timezone: record.timezone,
      effectiveFrom: record.effectiveFrom?.toISOString(),
      effectiveUntil: record.effectiveUntil?.toISOString(),
    })
  }

  if (record.kind === SchedulingAvailabilityRecordKind.AVAILABILITY_EXCEPTION) {
    const timezone = record.timezone
    const startsAt =
      record.startsAtUtc?.toISOString() ?? new Date().toISOString()
    const date = getWorkspaceDateKey(startsAt, timezone)
    const exception: AvailabilityExceptionRecord = {
      id: record.id,
      workspaceId: record.workspaceId,
      kind: 'availabilityException',
      memberId: record.memberId ?? undefined,
      memberName: record.memberId ? (record.title ?? undefined) : undefined,
      teamId: record.teamId ?? undefined,
      teamName: record.teamId ? (record.title ?? undefined) : undefined,
      scope: record.memberId ? 'member' : record.teamId ? 'team' : 'workspace',
      exceptionType:
        record.exceptionType === SchedulingExceptionType.CUSTOM_HOURS
          ? 'customHours'
          : 'closed',
      title: record.title ?? undefined,
      date,
      allDayClosed: record.allDay,
      startTime: record.startsAtUtc
        ? getWorkspaceTimeInputValue(record.startsAtUtc, timezone)
        : undefined,
      endTime: record.endsAtUtc
        ? getWorkspaceTimeInputValue(record.endsAtUtc, timezone)
        : undefined,
      timezone,
      recurrenceRule:
        record.recurrenceRule as AvailabilityExceptionRecord['recurrenceRule'],
      notes: record.notes ?? undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
    return exception
  }

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    kind: 'timeOff',
    memberId: record.memberId ?? record.teamId ?? '',
    memberName:
      record.title ?? record.memberId ?? record.teamId ?? 'Team member',
    category: timeOffCategoryFromPrisma(record.category),
    title: record.title ?? undefined,
    reason: record.title ?? 'Unavailable',
    startsAt: record.startsAtUtc?.toISOString() ?? new Date().toISOString(),
    endsAt: record.endsAtUtc?.toISOString() ?? new Date().toISOString(),
    allDay: record.allDay,
    timezone: record.timezone,
    notes: record.notes ?? undefined,
    createdByUserId: record.createdByUserId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  } as Extract<TeamAvailabilityRecord, { kind: 'timeOff' }>
}

function buildAvailabilityData({
  workspaceId,
  actorUserId,
  record,
}: {
  workspaceId: string
  actorUserId: string
  record: Omit<TeamAvailabilityRecord, 'id' | 'workspaceId'>
}): Prisma.SchedulingAvailabilityRecordUncheckedCreateInput {
  const writeRecord = record as Omit<
    TeamAvailabilityRecord,
    'id' | 'workspaceId'
  > & {
    kind: TeamAvailabilityRecord['kind']
  }

  if (writeRecord.kind === 'workingHours') {
    const workingHours = writeRecord as Omit<
      Extract<TeamAvailabilityRecord, { kind: 'workingHours' }>,
      'id' | 'workspaceId'
    >
    const normalized = normalizeWorkingHoursRecord({
      ...workingHours,
      id: 'pending',
      workspaceId,
    })
    return {
      workspaceId,
      kind: SchedulingAvailabilityRecordKind.WORKING_HOURS,
      memberId:
        normalized.scope === 'member'
          ? normalized.workspaceMemberId
          : undefined,
      teamId:
        normalized.scope === 'team'
          ? normalized.teamId
          : normalized.scope === 'location' && normalized.locationId
            ? getLocationStorageId(normalized.locationId)
            : undefined,
      title: normalized.memberName,
      timezone: workingHours.timezone ?? 'UTC',
      daysOfWeek:
        normalized.scheduleMode === 'inherit'
          ? []
          : (normalized.daysOfWeek ?? []),
      startTimeMinutes:
        normalized.scheduleMode === 'inherit'
          ? null
          : minutesFromTime(normalized.startsAt ?? '09:00'),
      endTimeMinutes:
        normalized.scheduleMode === 'inherit'
          ? null
          : minutesFromTime(normalized.endsAt ?? '17:00'),
      effectiveFrom: workingHours.effectiveFrom
        ? new Date(workingHours.effectiveFrom)
        : undefined,
      effectiveUntil: workingHours.effectiveUntil
        ? new Date(workingHours.effectiveUntil)
        : undefined,
      createdByUserId: actorUserId,
    }
  }

  if (writeRecord.kind === 'availabilityException') {
    const exception = writeRecord as Omit<
      AvailabilityExceptionRecord,
      'id' | 'workspaceId'
    >
    const timezone = exception.timezone ?? 'UTC'
    const startsAtUtc = combineDateAndTimeInTimezone({
      dateKey: exception.date,
      time: exception.allDayClosed ? '00:00' : (exception.startTime ?? '00:00'),
      timezone,
    })
    const endsAtUtc = exception.allDayClosed
      ? new Date(startsAtUtc.getTime() + 24 * 60 * 60 * 1000 - 1)
      : combineDateAndTimeInTimezone({
          dateKey: exception.date,
          time: exception.endTime ?? '23:59',
          timezone,
        })
    return {
      workspaceId,
      kind: SchedulingAvailabilityRecordKind.AVAILABILITY_EXCEPTION,
      memberId: exception.scope === 'member' ? exception.memberId : undefined,
      teamId: exception.scope === 'team' ? exception.teamId : undefined,
      title: exception.title,
      exceptionType:
        exception.exceptionType === 'customHours'
          ? SchedulingExceptionType.CUSTOM_HOURS
          : SchedulingExceptionType.CLOSED,
      startsAtUtc,
      endsAtUtc,
      timezone,
      allDay: exception.allDayClosed,
      daysOfWeek: [],
      recurrenceRule: exception.recurrenceRule as Prisma.InputJsonValue,
      notes: exception.notes,
      createdByUserId: actorUserId,
    }
  }

  const timeOff = writeRecord as Omit<
    Extract<TeamAvailabilityRecord, { kind: 'timeOff' }>,
    'id' | 'workspaceId'
  >
  return {
    workspaceId,
    kind: SchedulingAvailabilityRecordKind.TIME_OFF,
    memberId: timeOff.memberId,
    title: timeOff.title ?? timeOff.reason,
    category: timeOffCategoryToPrisma(timeOff.category),
    startsAtUtc: new Date(timeOff.startsAt),
    endsAtUtc: new Date(timeOff.endsAt),
    timezone: timeOff.timezone ?? 'UTC',
    allDay: timeOff.allDay,
    daysOfWeek: [],
    notes: timeOff.notes,
    createdByUserId: actorUserId,
  }
}

export const schedulingRepository = {
  async listEventsByRange(
    args: SchedulingRangeQuery,
  ): Promise<SchedulingEvent[]> {
    const defaultRange = getDefaultMaterializationRange()
    const rangeStart = args.endsAfter ?? defaultRange.rangeStart
    const rangeEnd = args.startsBefore ?? defaultRange.rangeEnd
    await materializeActiveRecurrenceSeriesForRange({
      db: prisma,
      workspaceId: args.workspaceId,
      rangeStart,
      rangeEnd,
    })
    const events = await prisma.schedulingEvent.findMany({
      where: getListEventsByRangeWhere(args),
      include: eventInclude,
      orderBy: { startsAtUtc: 'asc' },
      take: args.limit,
    })
    return events.map(eventToDomain)
  },

  async getEventById({
    workspaceId,
    eventId,
  }: {
    workspaceId: string
    eventId: string
  }): Promise<SchedulingEvent | null> {
    const event = await prisma.schedulingEvent.findFirst({
      where: { id: eventId, workspaceId, deletedAt: null },
      include: eventInclude,
    })
    return event ? eventToDomain(event) : null
  },

  async createEvent({
    workspaceId,
    actorUserId,
    input,
  }: {
    workspaceId: string
    actorUserId: string
    input: SchedulingEventWriteInput
  }): Promise<SchedulingEvent> {
    validateEventTiming(input)
    return prisma.$transaction(async (tx) => {
      await validateAssignments({
        db: tx,
        workspaceId,
        assignedMemberIds: input.assignedMemberIds,
      })
      const recurrence = input.recurrenceRule
        ? normalizeRecurrenceOrThrow({
            rule: input.recurrenceRule,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            timezone: input.timezone,
          })
        : null
      const created = await tx.schedulingEvent.create({
        data: buildEventData({
          workspaceId,
          actorUserId,
          input: recurrence
            ? { ...input, recurrenceRule: recurrence.rule }
            : input,
          isCreate: true,
        }) as Prisma.SchedulingEventUncheckedCreateInput,
        include: eventInclude,
      })
      if (recurrence) {
        await tx.schedulingEvent.update({
          where: { id: created.id },
          data: {
            occurrenceState: PrismaSchedulingOccurrenceState.MASTER,
            recurrenceTimezone: recurrence.timezone,
          },
        })
      }
      await replaceEventAssignments(tx, {
        workspaceId,
        eventId: created.id,
        assignedMemberIds: input.assignedMemberIds,
      })
      await replaceEventAttendees(tx, {
        workspaceId,
        eventId: created.id,
        attendees: input.attendees,
      })
      await appendActivity(tx, {
        workspaceId,
        eventId: created.id,
        actorId: actorUserId,
        action: 'created',
        summary: 'Event created.',
        metadata: { title: input.title, eventType: input.type },
      })
      await appendOutbox(tx, {
        workspaceId,
        topic: 'scheduling.event.created',
        aggregateId: created.id,
        payload: { eventId: created.id },
      })
      if (!recurrence) {
        return eventToDomain(await getScopedEvent(tx, workspaceId, created.id))
      }

      const series = await tx.schedulingRecurrenceSeries.create({
        data: {
          workspaceId,
          masterEventId: created.id,
          timezone: recurrence.timezone,
          rrule: recurrence.rrule,
          startsAtLocal: `${recurrence.localStartDate}T${recurrence.localStartTime}`,
          localStartDate: recurrence.localStartDate,
          localStartTime: recurrence.localStartTime,
          durationMinutes: recurrence.durationMinutes,
          normalizedRule: recurrence.rule as Prisma.InputJsonValue,
          untilUtc: recurrence.untilUtc,
          occurrenceCount: recurrence.occurrenceCount,
          metadata: { summary: recurrence.summary },
          status: PrismaSchedulingRecurrenceSeriesStatus.ACTIVE,
        },
        include: { masterEvent: { include: eventInclude } },
      })
      const startWindow = new Date(
        new Date(input.startsAt).getTime() -
          RECURRENCE_MATERIALIZATION_DAYS_BEHIND * 86_400_000,
      )
      const endWindow = new Date(
        new Date(input.startsAt).getTime() +
          RECURRENCE_MATERIALIZATION_DAYS_AHEAD * 86_400_000,
      )
      const materializedIds = await materializeRecurrenceSeries({
        db: tx,
        workspaceId,
        series,
        rangeStart: startWindow,
        rangeEnd: endWindow,
      })
      await appendActivity(tx, {
        workspaceId,
        eventId: created.id,
        actorId: actorUserId,
        action: 'recurrence_series_created',
        summary: 'Recurring schedule created.',
        metadata: {
          seriesId: series.id,
          rrule: recurrence.rrule,
          summary: recurrence.summary,
        },
      })
      await appendOutbox(tx, {
        workspaceId,
        topic: 'scheduling.recurrence_series.created',
        aggregateId: series.id,
        payload: { seriesId: series.id, masterEventId: created.id },
      })
      const firstOccurrenceId = materializedIds[0] ?? created.id
      return eventToDomain(
        await getScopedEvent(tx, workspaceId, firstOccurrenceId),
      )
    })
  },

  async updateEvent({
    workspaceId,
    eventId,
    actorUserId,
    input,
  }: {
    workspaceId: string
    eventId: string
    actorUserId: string
    input: Partial<SchedulingEventWriteInput>
  }): Promise<SchedulingEvent> {
    if (input.startsAt && input.endsAt)
      validateEventTiming(input as SchedulingEventWriteInput)
    return prisma.$transaction((tx) =>
      updateEventInTransaction({
        tx,
        workspaceId,
        eventId,
        actorUserId,
        input,
      }),
    )
  },

  async updateRecurringEvent({
    workspaceId,
    occurrenceId,
    actorUserId,
    scope,
    input,
    expectedVersion,
    idempotencyKey,
  }: {
    workspaceId: string
    occurrenceId: string
    actorUserId: string
    scope: SchedulingRecurrenceActionScope
    input: Partial<SchedulingEventWriteInput>
  } & RecurrenceMutationOptions): Promise<SchedulingEvent> {
    if (input.startsAt && input.endsAt)
      validateEventTiming(input as SchedulingEventWriteInput)
    const seriesId = await getRecurringSeriesIdForOccurrence({
      workspaceId,
      occurrenceId,
    })
    if (scope === 'thisOccurrence') {
      return runRecurrenceTransaction({
        workspaceId,
        seriesIds: [seriesId],
        occurrenceId,
        mutationKind: 'updateOccurrence',
        actorUserId,
        scope,
        expectedVersion,
        idempotencyKey,
        request: { input },
        callback: (tx) =>
          updateEventInTransaction({
            tx,
            workspaceId,
            eventId: occurrenceId,
            actorUserId,
            input,
          }),
      })
    }
    return runRecurrenceTransaction({
      workspaceId,
      seriesIds: [seriesId],
      occurrenceId,
      mutationKind:
        scope === 'thisAndFollowing' ? 'splitSeries' : 'updateEntireSeries',
      actorUserId,
      scope,
      expectedVersion,
      idempotencyKey,
      request: { input },
      callback: async (tx) => {
        if (scope === 'thisAndFollowing') {
          const split = await splitRecurringSeries({
            tx,
            workspaceId,
            actorUserId,
            occurrenceId,
            input,
            mode: 'edit',
          })
          const targetId = split.affectedOccurrenceIds[0] ?? occurrenceId
          return eventToDomain(await getScopedEvent(tx, workspaceId, targetId))
        }

        const { occurrence, series } = await getScopedRecurringOccurrence(tx, {
          workspaceId,
          occurrenceId,
        })
        const master = await getScopedEvent(
          tx,
          workspaceId,
          series.masterEventId,
        )
        const mergedInput = {
          ...input,
          recurrenceRule:
            input.recurrenceRule ??
            (series.normalizedRule as SchedulingEvent['recurrenceRule']) ??
            (master.recurrenceRule as SchedulingEvent['recurrenceRule']),
        }
        await tx.schedulingEvent.update({
          where: { id: master.id },
          data: buildEventData({
            workspaceId,
            actorUserId,
            input: mergedInput,
            isCreate: false,
          }) as Prisma.SchedulingEventUncheckedUpdateInput,
        })
        if (input.assignedMemberIds) {
          await replaceEventAssignments(tx, {
            workspaceId,
            eventId: master.id,
            assignedMemberIds: input.assignedMemberIds,
          })
        }
        const updatedMaster = await getScopedEvent(tx, workspaceId, master.id)
        if (!mergedInput.recurrenceRule) {
          throw new SchedulingRepositoryError(
            'This recurring series is missing a valid recurrence rule.',
            'invalid_input',
          )
        }
        const recurrence = normalizeRecurrenceOrThrow({
          rule: mergedInput.recurrenceRule,
          startsAt: updatedMaster.startsAtUtc,
          endsAt: updatedMaster.endsAtUtc,
          timezone: updatedMaster.timezone,
        })
        const updatedSeries = await tx.schedulingRecurrenceSeries.update({
          where: { id: series.id },
          data: {
            timezone: recurrence.timezone,
            rrule: recurrence.rrule,
            startsAtLocal: `${recurrence.localStartDate}T${recurrence.localStartTime}`,
            localStartDate: recurrence.localStartDate,
            localStartTime: recurrence.localStartTime,
            durationMinutes: recurrence.durationMinutes,
            normalizedRule: recurrence.rule as Prisma.InputJsonValue,
            untilUtc: recurrence.untilUtc,
            occurrenceCount: recurrence.occurrenceCount,
            version: { increment: 1 },
            metadata: {
              ...(series.metadata &&
              typeof series.metadata === 'object' &&
              !Array.isArray(series.metadata)
                ? (series.metadata as Record<string, unknown>)
                : {}),
              summary: recurrence.summary,
            },
          },
          include: { masterEvent: { include: eventInclude } },
        })
        const boundary =
          occurrence.occurrenceOriginalAt ?? occurrence.startsAtUtc
        const futureGenerated = await tx.schedulingEvent.findMany({
          where: {
            workspaceId,
            recurrenceSeriesId: series.id,
            occurrenceOriginalAt: { gte: boundary },
            occurrenceState: PrismaSchedulingOccurrenceState.GENERATED,
            deletedAt: null,
          },
          select: { id: true },
        })
        if (futureGenerated.length) {
          await tx.schedulingEvent.updateMany({
            where: {
              id: { in: futureGenerated.map((row) => row.id) },
              workspaceId,
            },
            data: {
              deletedAt: new Date(),
              occurrenceState: PrismaSchedulingOccurrenceState.SUPERSEDED,
              recurrenceLineage: {
                seriesId: series.id,
                supersededReason: 'entire_series_regeneration',
                boundaryUtc: boundary.toISOString(),
                supersededAt: new Date().toISOString(),
              },
              updatedByUserId: actorUserId,
            },
          })
        }
        const defaultRange = getDefaultMaterializationRange()
        await materializeRecurrenceSeries({
          db: tx,
          workspaceId,
          series: updatedSeries,
          rangeStart: boundary,
          rangeEnd: defaultRange.rangeEnd,
        })
        await appendActivity(tx, {
          workspaceId,
          eventId: master.id,
          actorId: actorUserId,
          action: 'recurrence_series_updated',
          summary: 'Recurring series updated.',
          metadata: {
            scope: 'entireSeries',
            seriesId: series.id,
            occurrenceId,
            boundaryUtc: boundary.toISOString(),
            seriesVersionBefore: series.version,
            seriesVersionAfter: series.version + 1,
          },
        })
        await appendOutbox(tx, {
          workspaceId,
          topic: 'scheduling.recurrence.series_updated',
          aggregateId: series.id,
          payload: {
            seriesId: series.id,
            occurrenceId,
            scope: 'entireSeries',
            actorUserId,
            boundaryUtc: boundary.toISOString(),
            seriesVersionBefore: series.version,
            seriesVersionAfter: series.version + 1,
          },
        })
        const updatedOccurrence =
          (await tx.schedulingEvent.findFirst({
            where: {
              workspaceId,
              recurrenceSeriesId: series.id,
              occurrenceOriginalAt: boundary,
              deletedAt: null,
            },
            include: eventInclude,
          })) ?? occurrence
        return eventToDomain(updatedOccurrence)
      },
    })
  },

  async cancelRecurringEvent({
    workspaceId,
    occurrenceId,
    actorUserId,
    scope,
    expectedVersion,
    idempotencyKey,
  }: {
    workspaceId: string
    occurrenceId: string
    actorUserId: string
    scope: SchedulingRecurrenceActionScope
  } & RecurrenceMutationOptions): Promise<void> {
    const seriesId = await getRecurringSeriesIdForOccurrence({
      workspaceId,
      occurrenceId,
    })
    if (scope === 'thisOccurrence') {
      await runRecurrenceTransaction({
        workspaceId,
        seriesIds: [seriesId],
        occurrenceId,
        mutationKind: 'cancelOccurrence',
        actorUserId,
        scope,
        expectedVersion,
        idempotencyKey,
        callback: async (tx) => {
          const existing = await getScopedEvent(tx, workspaceId, occurrenceId)
          const from = statusFromPrisma(existing.status)
          assertSchedulingEventStatusTransition({ from, to: 'canceled' })
          await tx.schedulingEvent.update({
            where: { id: occurrenceId },
            data: {
              status: PrismaSchedulingEventStatus.CANCELED,
              occurrenceState: PrismaSchedulingOccurrenceState.CANCELED,
              canceledAt: new Date(),
              updatedByUserId: actorUserId,
            },
          })
          await appendActivity(tx, {
            workspaceId,
            eventId: occurrenceId,
            actorId: actorUserId,
            action: 'recurrence_occurrence_canceled',
            summary: 'This occurrence canceled.',
            metadata: { from, to: 'canceled', scope, seriesId },
          })
          await appendOutbox(tx, {
            workspaceId,
            topic: 'scheduling.recurrence.occurrence_canceled',
            aggregateId: occurrenceId,
            payload: { occurrenceId, scope, actorUserId, seriesId },
          })
        },
      })
      return
    }
    if (scope === 'entireSeries') {
      await this.cancelRecurrenceSeries({
        workspaceId,
        seriesId,
        actorUserId,
        expectedVersion,
        idempotencyKey,
      })
      return
    }
    await runRecurrenceTransaction({
      workspaceId,
      seriesIds: [seriesId],
      occurrenceId,
      mutationKind: 'cancelFollowing',
      actorUserId,
      scope,
      expectedVersion,
      idempotencyKey,
      callback: (tx) =>
        splitRecurringSeries({
          tx,
          workspaceId,
          actorUserId,
          occurrenceId,
          input: {},
          mode: 'cancel',
        }),
    })
  },

  async deleteRecurringEvent({
    workspaceId,
    occurrenceId,
    actorUserId,
    scope,
    expectedVersion,
    idempotencyKey,
  }: {
    workspaceId: string
    occurrenceId: string
    actorUserId: string
    scope: SchedulingRecurrenceActionScope
  } & RecurrenceMutationOptions): Promise<void> {
    const seriesId = await getRecurringSeriesIdForOccurrence({
      workspaceId,
      occurrenceId,
    })
    if (scope === 'thisOccurrence') {
      await runRecurrenceTransaction({
        workspaceId,
        seriesIds: [seriesId],
        occurrenceId,
        mutationKind: 'deleteOccurrence',
        actorUserId,
        scope,
        expectedVersion,
        idempotencyKey,
        callback: async (tx) => {
          await tx.schedulingEvent.update({
            where: { id: occurrenceId },
            data: {
              deletedAt: new Date(),
              occurrenceState: PrismaSchedulingOccurrenceState.DELETED,
              updatedByUserId: actorUserId,
            },
          })
          await appendActivity(tx, {
            workspaceId,
            eventId: occurrenceId,
            actorId: actorUserId,
            action: 'recurrence_occurrence_deleted',
            summary: 'This occurrence deleted.',
            metadata: { scope, seriesId },
          })
          await appendOutbox(tx, {
            workspaceId,
            topic: 'scheduling.recurrence.occurrence_deleted',
            aggregateId: occurrenceId,
            payload: { occurrenceId, scope, actorUserId, seriesId },
          })
        },
      })
      return
    }
    if (scope === 'entireSeries') {
      await runRecurrenceTransaction({
        workspaceId,
        seriesIds: [seriesId],
        occurrenceId,
        mutationKind: 'deleteSeries',
        actorUserId,
        scope,
        expectedVersion,
        idempotencyKey,
        callback: async (tx) => {
          const { series } = await getScopedRecurringOccurrence(tx, {
            workspaceId,
            occurrenceId,
          })
          await tx.schedulingRecurrenceSeries.update({
            where: { id: series.id },
            data: {
              status: PrismaSchedulingRecurrenceSeriesStatus.CANCELED,
              canceledAt: new Date(),
              version: { increment: 1 },
            },
          })
          await tx.schedulingEvent.updateMany({
            where: {
              workspaceId,
              OR: [
                { id: series.masterEventId },
                {
                  recurrenceSeriesId: series.id,
                  occurrenceState: {
                    notIn: [
                      PrismaSchedulingOccurrenceState.COMPLETED,
                      PrismaSchedulingOccurrenceState.CANCELED,
                    ],
                  },
                },
              ],
            },
            data: {
              deletedAt: new Date(),
              occurrenceState: PrismaSchedulingOccurrenceState.DELETED,
              updatedByUserId: actorUserId,
            },
          })
          await appendOutbox(tx, {
            workspaceId,
            topic: 'scheduling.recurrence.series_deleted',
            aggregateId: series.id,
            payload: {
              seriesId: series.id,
              occurrenceId,
              scope,
              actorUserId,
              seriesVersionBefore: series.version,
              seriesVersionAfter: series.version + 1,
            },
          })
        },
      })
      return
    }
    await runRecurrenceTransaction({
      workspaceId,
      seriesIds: [seriesId],
      occurrenceId,
      mutationKind: 'deleteFollowing',
      actorUserId,
      scope,
      expectedVersion,
      idempotencyKey,
      callback: (tx) =>
        splitRecurringSeries({
          tx,
          workspaceId,
          actorUserId,
          occurrenceId,
          input: {},
          mode: 'delete',
        }),
    })
  },

  async transitionEventStatus({
    workspaceId,
    eventId,
    actorUserId,
    status,
  }: {
    workspaceId: string
    eventId: string
    actorUserId: string
    status: SchedulingEventStatus
  }): Promise<SchedulingEvent> {
    return prisma.$transaction(async (tx) => {
      const existing = await getScopedEvent(tx, workspaceId, eventId)
      const from = statusFromPrisma(existing.status)
      const effect = getSchedulingStatusTransitionEffect({ from, to: status })
      assertSchedulingEventStatusTransition({ from, to: status })
      await tx.schedulingEvent.update({
        where: { id: eventId },
        data: {
          status: statusToPrisma(status),
          occurrenceState:
            existing.recurrenceSeriesId && existing.occurrenceOriginalAt
              ? status === 'canceled'
                ? PrismaSchedulingOccurrenceState.CANCELED
                : status === 'completed'
                  ? PrismaSchedulingOccurrenceState.COMPLETED
                  : undefined
              : undefined,
          completedAt: effect.completedAt ? new Date() : undefined,
          canceledAt: effect.canceledAt ? new Date() : undefined,
          updatedByUserId: actorUserId,
        },
      })
      await appendActivity(tx, {
        workspaceId,
        eventId,
        actorId: actorUserId,
        action: 'status_changed',
        summary: `Status changed from ${from} to ${status}.`,
        metadata: { from, to: status },
      })
      await appendOutbox(tx, {
        workspaceId,
        topic: `scheduling.event.${status === 'canceled' ? 'canceled' : status === 'completed' ? 'completed' : 'status_changed'}`,
        aggregateId: eventId,
        payload: { eventId, from, to: status },
      })
      return eventToDomain(await getScopedEvent(tx, workspaceId, eventId))
    })
  },

  async transitionRecurringOccurrenceStatus({
    workspaceId,
    occurrenceId,
    actorUserId,
    status,
    expectedVersion,
    idempotencyKey,
  }: {
    workspaceId: string
    occurrenceId: string
    actorUserId: string
    status: SchedulingEventStatus
  } & RecurrenceMutationOptions): Promise<SchedulingEvent> {
    const seriesId = await getRecurringSeriesIdForOccurrence({
      workspaceId,
      occurrenceId,
    })
    return runRecurrenceTransaction({
      workspaceId,
      seriesIds: [seriesId],
      occurrenceId,
      mutationKind:
        status === 'completed' ? 'completeOccurrence' : 'updateOccurrence',
      actorUserId,
      scope: 'thisOccurrence',
      expectedVersion,
      idempotencyKey,
      request: { status },
      callback: async (tx) => {
        const existing = await getScopedEvent(tx, workspaceId, occurrenceId)
        const from = statusFromPrisma(existing.status)
        const effect = getSchedulingStatusTransitionEffect({ from, to: status })
        assertSchedulingEventStatusTransition({ from, to: status })
        await tx.schedulingEvent.update({
          where: { id: occurrenceId },
          data: {
            status: statusToPrisma(status),
            occurrenceState:
              status === 'canceled'
                ? PrismaSchedulingOccurrenceState.CANCELED
                : status === 'completed'
                  ? PrismaSchedulingOccurrenceState.COMPLETED
                  : existing.occurrenceState,
            completedAt: effect.completedAt ? new Date() : undefined,
            canceledAt: effect.canceledAt ? new Date() : undefined,
            updatedByUserId: actorUserId,
          },
        })
        await appendActivity(tx, {
          workspaceId,
          eventId: occurrenceId,
          actorId: actorUserId,
          action: 'recurrence_occurrence_status_changed',
          summary: `Recurring occurrence status changed from ${from} to ${status}.`,
          metadata: { from, to: status, scope: 'thisOccurrence', seriesId },
        })
        await appendOutbox(tx, {
          workspaceId,
          topic: 'scheduling.event.status_changed',
          aggregateId: occurrenceId,
          payload: {
            eventId: occurrenceId,
            from,
            to: status,
            scope: 'thisOccurrence',
            seriesId,
          },
        })
        return eventToDomain(
          await getScopedEvent(tx, workspaceId, occurrenceId),
        )
      },
    })
  },

  async softDeleteEvent({
    workspaceId,
    eventId,
    actorUserId,
  }: {
    workspaceId: string
    eventId: string
    actorUserId: string
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await getScopedEvent(tx, workspaceId, eventId)
      await tx.schedulingEvent.update({
        where: { id: eventId },
        data: {
          deletedAt: new Date(),
          updatedByUserId: actorUserId,
          occurrenceState:
            existing.recurrenceSeriesId && existing.occurrenceOriginalAt
              ? PrismaSchedulingOccurrenceState.DELETED
              : undefined,
        },
      })
      await appendActivity(tx, {
        workspaceId,
        eventId,
        actorId: actorUserId,
        action: 'deleted',
        summary: 'Event deleted.',
      })
      await appendOutbox(tx, {
        workspaceId,
        topic: 'scheduling.event.deleted',
        aggregateId: eventId,
        payload: { eventId },
      })
    })
  },

  async duplicateEvent({
    workspaceId,
    eventId,
    actorUserId,
    scope = 'thisOccurrence',
  }: {
    workspaceId: string
    eventId: string
    actorUserId: string
    scope?: SchedulingRecurrenceActionScope
  }): Promise<SchedulingEvent> {
    const existing = await this.getEventById({ workspaceId, eventId })
    if (!existing) {
      throw new SchedulingRepositoryError(
        'This event could not be found in the active workspace.',
        'not_found',
      )
    }
    const duplicateSeries =
      scope === 'entireSeries' && Boolean(existing.recurrenceRule)
    return this.createEvent({
      workspaceId,
      actorUserId,
      input: duplicateEventInput({
        event: existing,
        duplicateSeries,
      }),
    })
  },

  async listAssignments({
    workspaceId,
    eventId,
  }: {
    workspaceId: string
    eventId: string
  }) {
    return prisma.schedulingAssignment.findMany({
      where: { workspaceId, eventId },
      orderBy: { createdAt: 'asc' },
    })
  },

  async replaceAssignments(args: {
    workspaceId: string
    eventId: string
    assignedMemberIds: string[]
  }) {
    await prisma.$transaction((tx) => replaceEventAssignments(tx, args))
  },

  async listAttendees({
    workspaceId,
    eventId,
  }: {
    workspaceId: string
    eventId: string
  }) {
    return prisma.schedulingAttendee.findMany({
      where: { workspaceId, eventId },
      orderBy: { createdAt: 'asc' },
    })
  },

  async replaceAttendees(args: {
    workspaceId: string
    eventId: string
    attendees: SchedulingAttendeeInput[]
  }) {
    await prisma.$transaction((tx) => replaceEventAttendees(tx, args))
  },

  async listAvailabilityRecords({
    workspaceId,
    startsBefore,
    endsAfter,
    includeDeleted,
  }: SchedulingRangeQuery): Promise<TeamAvailabilityRecord[]> {
    const records = await prisma.schedulingAvailabilityRecord.findMany({
      where: {
        workspaceId,
        deletedAt: includeDeleted ? undefined : null,
        OR:
          startsBefore || endsAfter
            ? [
                {
                  startsAtUtc: startsBefore ? { lt: startsBefore } : undefined,
                  endsAtUtc: endsAfter ? { gt: endsAfter } : undefined,
                },
                { kind: SchedulingAvailabilityRecordKind.WORKING_HOURS },
              ]
            : undefined,
      },
      orderBy: [{ kind: 'asc' }, { startsAtUtc: 'asc' }],
    })
    return records.map(availabilityToDomain)
  },

  async createAvailabilityRecord({
    workspaceId,
    actorUserId,
    record,
  }: {
    workspaceId: string
    actorUserId: string
    record: Omit<TeamAvailabilityRecord, 'id' | 'workspaceId'>
  }) {
    const created = await prisma.schedulingAvailabilityRecord.create({
      data: buildAvailabilityData({ workspaceId, actorUserId, record }),
    })
    return availabilityToDomain(created)
  },

  async updateAvailabilityRecord({
    workspaceId,
    recordId,
    actorUserId,
    record,
  }: {
    workspaceId: string
    recordId: string
    actorUserId: string
    record: Omit<TeamAvailabilityRecord, 'id' | 'workspaceId'>
  }) {
    const existing = await prisma.schedulingAvailabilityRecord.findFirst({
      where: { id: recordId, workspaceId, deletedAt: null },
    })
    if (!existing) {
      throw new SchedulingRepositoryError(
        'This availability record could not be found in the active workspace.',
        'not_found',
      )
    }
    const data = buildAvailabilityData({ workspaceId, actorUserId, record })
    const updated = await prisma.schedulingAvailabilityRecord.update({
      where: { id: recordId },
      data: {
        ...data,
        id: undefined,
        workspaceId: undefined,
        createdByUserId: existing.createdByUserId,
      },
    })
    return availabilityToDomain(updated)
  },

  async deleteAvailabilityRecord({
    workspaceId,
    recordId,
  }: {
    workspaceId: string
    recordId: string
  }) {
    await prisma.schedulingAvailabilityRecord.updateMany({
      where: { id: recordId, workspaceId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  },

  createTimeOff(args: {
    workspaceId: string
    actorUserId: string
    record: Omit<
      Extract<TeamAvailabilityRecord, { kind: 'timeOff' }>,
      'id' | 'workspaceId'
    >
  }) {
    return this.createAvailabilityRecord(args)
  },
  updateTimeOff(args: {
    workspaceId: string
    recordId: string
    actorUserId: string
    record: Omit<
      Extract<TeamAvailabilityRecord, { kind: 'timeOff' }>,
      'id' | 'workspaceId'
    >
  }) {
    return this.updateAvailabilityRecord(args)
  },
  deleteTimeOff(args: { workspaceId: string; recordId: string }) {
    return this.deleteAvailabilityRecord(args)
  },
  listTimeOff(args: SchedulingRangeQuery) {
    return this.listAvailabilityRecords(args).then((records) =>
      records.filter((record) => record.kind === 'timeOff'),
    )
  },
  createWorkingHours(args: {
    workspaceId: string
    actorUserId: string
    record: Omit<
      Extract<TeamAvailabilityRecord, { kind: 'workingHours' }>,
      'id' | 'workspaceId'
    >
  }) {
    return this.createAvailabilityRecord(args)
  },
  updateWorkingHours(args: {
    workspaceId: string
    recordId: string
    actorUserId: string
    record: Omit<
      Extract<TeamAvailabilityRecord, { kind: 'workingHours' }>,
      'id' | 'workspaceId'
    >
  }) {
    return this.updateAvailabilityRecord(args)
  },
  deleteWorkingHours(args: { workspaceId: string; recordId: string }) {
    return this.deleteAvailabilityRecord(args)
  },
  listWorkingHours(args: SchedulingRangeQuery) {
    return this.listAvailabilityRecords(args).then((records) =>
      records.filter((record) => record.kind === 'workingHours'),
    )
  },
  createAvailabilityException(args: {
    workspaceId: string
    actorUserId: string
    record: Omit<AvailabilityExceptionRecord, 'id' | 'workspaceId'>
  }) {
    return this.createAvailabilityRecord(args)
  },
  updateAvailabilityException(args: {
    workspaceId: string
    recordId: string
    actorUserId: string
    record: Omit<AvailabilityExceptionRecord, 'id' | 'workspaceId'>
  }) {
    return this.updateAvailabilityRecord(args)
  },
  deleteAvailabilityException(args: { workspaceId: string; recordId: string }) {
    return this.deleteAvailabilityRecord(args)
  },
  listAvailabilityExceptions(args: SchedulingRangeQuery) {
    return this.listAvailabilityRecords(args).then((records) =>
      records.filter((record) => record.kind === 'availabilityException'),
    )
  },

  listSchedulingActivity({
    workspaceId,
    eventId,
  }: {
    workspaceId: string
    eventId: string
  }) {
    return prisma.schedulingEventActivity.findMany({
      where: { workspaceId, eventId },
      orderBy: { createdAt: 'desc' },
    })
  },

  appendSchedulingActivity(args: Parameters<typeof appendActivity>[1]) {
    return appendActivity(prisma, args)
  },

  async listRecurrenceSeries({
    workspaceId,
  }: {
    workspaceId: string
  }): Promise<SchedulingSeries[]> {
    const series = await prisma.schedulingRecurrenceSeries.findMany({
      where: {
        workspaceId,
        status: {
          not: PrismaSchedulingRecurrenceSeriesStatus.CANCELED,
        },
      },
      include: { masterEvent: { include: eventInclude } },
      orderBy: { createdAt: 'desc' },
    })
    const now = new Date()
    const rows: SchedulingSeries[] = []
    for (const item of series) {
      const master = item.masterEvent
      if (
        master.eventTypeKey !== 'recurringServiceVisit' &&
        master.eventTypeKey !== 'recurringDelivery'
      ) {
        continue
      }
      const nextOccurrence = await prisma.schedulingEvent.findFirst({
        where: {
          workspaceId,
          recurrenceSeriesId: item.id,
          deletedAt: null,
          occurrenceState: {
            notIn: [
              PrismaSchedulingOccurrenceState.CANCELED,
              PrismaSchedulingOccurrenceState.DELETED,
              PrismaSchedulingOccurrenceState.COMPLETED,
            ],
          },
          endsAtUtc: { gte: now },
        },
        orderBy: { startsAtUtc: 'asc' },
      })
      rows.push({
        id: item.id,
        workspaceId,
        title: master.title,
        eventType: master.eventTypeKey as SchedulingSeries['eventType'],
        recurrenceRule:
          (item.normalizedRule as SchedulingSeries['recurrenceRule']) ??
          (master.recurrenceRule as SchedulingSeries['recurrenceRule']),
        nextOccurrenceAt:
          nextOccurrence?.startsAtUtc.toISOString() ??
          master.startsAtUtc.toISOString(),
        status: recurrenceSeriesStatusFromPrisma(item.status),
        assignedMemberIds: master.assignments
          .filter((assignment) => assignment.workspaceMemberId)
          .map((assignment) => assignment.workspaceMemberId as string),
        linkedRecord:
          master.linkedRecordType && master.linkedRecordId
            ? {
                recordType: master.linkedRecordType as NonNullable<
                  SchedulingSeries['linkedRecord']
                >['recordType'],
                recordId: master.linkedRecordId,
                label: master.linkedRecordLabel ?? master.linkedRecordId,
              }
            : undefined,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })
    }
    return rows
  },

  async materializeRecurrenceSeriesForRange({
    workspaceId,
    startsBefore,
    endsAfter,
  }: {
    workspaceId: string
    startsBefore: Date
    endsAfter: Date
  }) {
    await materializeActiveRecurrenceSeriesForRange({
      db: prisma,
      workspaceId,
      rangeStart: endsAfter,
      rangeEnd: startsBefore,
    })
  },

  async pauseRecurrenceSeries({
    workspaceId,
    seriesId,
    actorUserId,
    expectedVersion,
    idempotencyKey,
  }: {
    workspaceId: string
    seriesId: string
    actorUserId: string
  } & RecurrenceMutationOptions) {
    await runRecurrenceTransaction({
      workspaceId,
      seriesIds: [seriesId],
      mutationKind: 'pauseSeries',
      actorUserId,
      expectedVersion,
      idempotencyKey,
      callback: async (tx) => {
        const existing = await tx.schedulingRecurrenceSeries.findFirst({
          where: { id: seriesId, workspaceId },
          select: { version: true },
        })
        if (!existing) {
          throw new SchedulingRepositoryError(
            'This recurring schedule could not be found.',
            'not_found',
          )
        }
        await tx.schedulingRecurrenceSeries.update({
          where: { id: seriesId },
          data: {
            status: PrismaSchedulingRecurrenceSeriesStatus.PAUSED,
            pausedAt: new Date(),
            version: { increment: 1 },
          },
        })
        await appendOutbox(tx, {
          workspaceId,
          topic: 'scheduling.recurrence_series.paused',
          aggregateId: seriesId,
          payload: {
            seriesId,
            actorUserId,
            seriesVersionBefore: existing.version,
            seriesVersionAfter: existing.version + 1,
          },
        })
      },
    })
  },

  async resumeRecurrenceSeries({
    workspaceId,
    seriesId,
    actorUserId,
    expectedVersion,
    idempotencyKey,
  }: {
    workspaceId: string
    seriesId: string
    actorUserId: string
  } & RecurrenceMutationOptions) {
    await runRecurrenceTransaction({
      workspaceId,
      seriesIds: [seriesId],
      mutationKind: 'resumeSeries',
      actorUserId,
      expectedVersion,
      idempotencyKey,
      callback: async (tx) => {
        const existing = await tx.schedulingRecurrenceSeries.findFirst({
          where: { id: seriesId, workspaceId },
          select: { version: true },
        })
        if (!existing) {
          throw new SchedulingRepositoryError(
            'This recurring schedule could not be found.',
            'not_found',
          )
        }
        await tx.schedulingRecurrenceSeries.update({
          where: { id: seriesId },
          data: {
            status: PrismaSchedulingRecurrenceSeriesStatus.ACTIVE,
            pausedAt: null,
            version: { increment: 1 },
          },
        })
        await appendOutbox(tx, {
          workspaceId,
          topic: 'scheduling.recurrence_series.resumed',
          aggregateId: seriesId,
          payload: {
            seriesId,
            actorUserId,
            seriesVersionBefore: existing.version,
            seriesVersionAfter: existing.version + 1,
          },
        })
      },
    })
  },

  async cancelRecurrenceSeries({
    workspaceId,
    seriesId,
    actorUserId,
    expectedVersion,
    idempotencyKey,
  }: {
    workspaceId: string
    seriesId: string
    actorUserId: string
  } & RecurrenceMutationOptions) {
    await runRecurrenceTransaction({
      workspaceId,
      seriesIds: [seriesId],
      mutationKind: 'cancelSeries',
      actorUserId,
      expectedVersion,
      idempotencyKey,
      callback: async (tx) => {
        const existing = await tx.schedulingRecurrenceSeries.findFirst({
          where: { id: seriesId, workspaceId },
          select: { version: true },
        })
        if (!existing) {
          throw new SchedulingRepositoryError(
            'This recurring schedule could not be found.',
            'not_found',
          )
        }
        await tx.schedulingRecurrenceSeries.update({
          where: { id: seriesId },
          data: {
            status: PrismaSchedulingRecurrenceSeriesStatus.CANCELED,
            canceledAt: new Date(),
            version: { increment: 1 },
          },
        })
        await tx.schedulingEvent.updateMany({
          where: {
            workspaceId,
            recurrenceSeriesId: seriesId,
            occurrenceState: PrismaSchedulingOccurrenceState.GENERATED,
            startsAtUtc: { gte: new Date() },
          },
          data: {
            status: PrismaSchedulingEventStatus.CANCELED,
            occurrenceState: PrismaSchedulingOccurrenceState.CANCELED,
            canceledAt: new Date(),
            updatedByUserId: actorUserId,
          },
        })
        await appendOutbox(tx, {
          workspaceId,
          topic: 'scheduling.recurrence_series.canceled',
          aggregateId: seriesId,
          payload: {
            seriesId,
            actorUserId,
            seriesVersionBefore: existing.version,
            seriesVersionAfter: existing.version + 1,
          },
        })
      },
    })
  },

  async checkRecurrenceIntegrity({
    workspaceId,
    seriesId,
  }: {
    workspaceId: string
    seriesId?: string
  }): Promise<RecurrenceIntegrityFinding[]> {
    const findings: RecurrenceIntegrityFinding[] = []
    const series = await prisma.schedulingRecurrenceSeries.findMany({
      where: { workspaceId, id: seriesId },
      include: { masterEvent: true },
    })
    const seriesIds = series.map((item) => item.id)
    if (seriesId && seriesIds.length === 0) {
      findings.push({
        severity: 'error',
        code: 'SERIES_NOT_FOUND',
        seriesId,
        message: 'This recurrence series does not exist in the workspace.',
        repairable: false,
      })
      return findings
    }

    for (const item of series) {
      if (!item.masterEvent || item.masterEvent.workspaceId !== workspaceId) {
        findings.push({
          severity: 'error',
          code: 'MISSING_MASTER',
          seriesId: item.id,
          message:
            'The recurrence series is missing its workspace master event.',
          repairable: false,
        })
      }
      const normalizedRule =
        item.normalizedRule as SchedulingEvent['recurrenceRule']
      if (normalizedRule) {
        try {
          const normalized = normalizeSchedulingRecurrenceRule({
            rule: normalizedRule,
            startsAt: item.masterEvent.startsAtUtc,
            endsAt: item.masterEvent.endsAtUtc,
            timezone: item.timezone,
          })
          if (normalized.rrule !== item.rrule) {
            findings.push({
              severity: 'warning',
              code: 'RRULE_MISMATCH',
              seriesId: item.id,
              message: 'The stored RRULE does not match the normalized rule.',
              repairable: true,
              metadata: {
                expectedRrule: normalized.rrule,
                actualRrule: item.rrule,
              },
            })
          }
        } catch {
          findings.push({
            severity: 'error',
            code: 'INVALID_NORMALIZED_RULE',
            seriesId: item.id,
            message: 'The normalized recurrence rule is invalid.',
            repairable: false,
          })
        }
      }
      if (item.status === PrismaSchedulingRecurrenceSeriesStatus.CANCELED) {
        const activeFuture = await prisma.schedulingEvent.count({
          where: {
            workspaceId,
            recurrenceSeriesId: item.id,
            deletedAt: null,
            occurrenceState: {
              in: [
                PrismaSchedulingOccurrenceState.GENERATED,
                PrismaSchedulingOccurrenceState.OVERRIDDEN,
              ],
            },
            startsAtUtc: { gte: item.canceledAt ?? new Date() },
          },
        })
        if (activeFuture > 0) {
          findings.push({
            severity: 'error',
            code: 'ACTIVE_AFTER_CANCELED_SERIES',
            seriesId: item.id,
            message:
              'Future active occurrences remain after a canceled series.',
            repairable: true,
            metadata: { activeFuture },
          })
        }
      }
      if (item.splitBoundaryUtc) {
        const activeAfterSplit = await prisma.schedulingEvent.count({
          where: {
            workspaceId,
            recurrenceSeriesId: item.id,
            deletedAt: null,
            occurrenceOriginalAt: { gte: item.splitBoundaryUtc },
            occurrenceState: {
              in: [
                PrismaSchedulingOccurrenceState.GENERATED,
                PrismaSchedulingOccurrenceState.OVERRIDDEN,
              ],
            },
          },
        })
        if (activeAfterSplit > 0) {
          findings.push({
            severity: 'error',
            code: 'ACTIVE_OLD_SERIES_AFTER_SPLIT',
            seriesId: item.id,
            message: 'The original split series still has active future rows.',
            repairable: true,
            metadata: { activeAfterSplit },
          })
        }
      }
      const latestGenerated = await prisma.schedulingEvent.findFirst({
        where: {
          workspaceId,
          recurrenceSeriesId: item.id,
          deletedAt: null,
          occurrenceOriginalAt: { not: null },
          occurrenceState: {
            in: [
              PrismaSchedulingOccurrenceState.GENERATED,
              PrismaSchedulingOccurrenceState.OVERRIDDEN,
            ],
          },
        },
        orderBy: { occurrenceOriginalAt: 'desc' },
        select: { id: true, occurrenceOriginalAt: true },
      })
      if (
        latestGenerated?.occurrenceOriginalAt &&
        (!item.generatedThroughUtc ||
          item.generatedThroughUtc < latestGenerated.occurrenceOriginalAt)
      ) {
        findings.push({
          severity: 'warning',
          code: 'GENERATED_THROUGH_BEHIND',
          seriesId: item.id,
          occurrenceId: latestGenerated.id,
          message:
            'generatedThroughUtc is behind the latest active occurrence.',
          repairable: true,
          metadata: {
            expectedGeneratedThroughUtc:
              latestGenerated.occurrenceOriginalAt.toISOString(),
            actualGeneratedThroughUtc: item.generatedThroughUtc?.toISOString(),
          },
        })
      }
    }

    if (seriesIds.length) {
      const duplicates = await prisma.schedulingEvent.groupBy({
        by: ['recurrenceSeriesId', 'occurrenceOriginalAt'],
        where: {
          workspaceId,
          recurrenceSeriesId: { in: seriesIds },
          occurrenceOriginalAt: { not: null },
          deletedAt: null,
          occurrenceState: {
            in: [
              PrismaSchedulingOccurrenceState.GENERATED,
              PrismaSchedulingOccurrenceState.OVERRIDDEN,
            ],
          },
        },
        _count: { _all: true },
        having: { id: { _count: { gt: 1 } } },
      })
      duplicates.forEach((duplicate) => {
        findings.push({
          severity: 'error',
          code: 'DUPLICATE_ACTIVE_OCCURRENCE',
          seriesId: duplicate.recurrenceSeriesId ?? undefined,
          message:
            'Multiple active occurrences share the same recurrence identity.',
          repairable: true,
          metadata: {
            occurrenceOriginalAt:
              duplicate.occurrenceOriginalAt?.toISOString() ?? null,
            count: duplicate._count._all,
          },
        })
      })
    }

    const activeSuperseded = await prisma.schedulingEvent.findMany({
      where: {
        workspaceId,
        recurrenceSeriesId: seriesId ? seriesId : undefined,
        deletedAt: null,
        occurrenceState: PrismaSchedulingOccurrenceState.SUPERSEDED,
      },
      select: { id: true, recurrenceSeriesId: true },
      take: 50,
    })
    activeSuperseded.forEach((row) => {
      findings.push({
        severity: 'error',
        code: 'ACTIVE_SUPERSEDED_OCCURRENCE',
        seriesId: row.recurrenceSeriesId ?? undefined,
        occurrenceId: row.id,
        message: 'A superseded occurrence is still active.',
        repairable: true,
      })
    })

    return findings
  },

  async repairRecurrenceIntegrity({
    workspaceId,
    seriesId,
    repairCodes,
    actorUserId,
    dryRun = true,
  }: {
    workspaceId: string
    seriesId: string
    repairCodes?: string[]
    actorUserId: string
    dryRun?: boolean
  }): Promise<RecurrenceRepairResult> {
    const findings = await this.checkRecurrenceIntegrity({
      workspaceId,
      seriesId,
    })
    const selectedCodes = new Set(
      repairCodes ?? findings.map((item) => item.code),
    )
    const repairable = findings.filter(
      (finding) => finding.repairable && selectedCodes.has(finding.code),
    )
    const result: RecurrenceRepairResult = {
      dryRun,
      findings,
      repairedCount: 0,
      supersededCount: 0,
      rematerializedCount: 0,
      updatedSeriesCount: 0,
    }
    if (dryRun || repairable.length === 0) return result

    await runRecurrenceTransaction({
      workspaceId,
      seriesIds: [seriesId],
      mutationKind: 'repairSeries',
      actorUserId,
      request: { repairCodes: [...selectedCodes].sort() },
      callback: async (tx) => {
        const series = await tx.schedulingRecurrenceSeries.findFirst({
          where: { id: seriesId, workspaceId },
          include: { masterEvent: { include: eventInclude } },
        })
        if (!series) {
          throw new SchedulingRepositoryError(
            'This recurring schedule could not be found.',
            'not_found',
          )
        }
        if (selectedCodes.has('ACTIVE_SUPERSEDED_OCCURRENCE')) {
          const updated = await tx.schedulingEvent.updateMany({
            where: {
              workspaceId,
              recurrenceSeriesId: seriesId,
              deletedAt: null,
              occurrenceState: PrismaSchedulingOccurrenceState.SUPERSEDED,
            },
            data: { deletedAt: new Date(), updatedByUserId: actorUserId },
          })
          result.repairedCount += updated.count
          result.supersededCount += updated.count
        }
        if (
          selectedCodes.has('ACTIVE_OLD_SERIES_AFTER_SPLIT') &&
          series.splitBoundaryUtc
        ) {
          const updated = await tx.schedulingEvent.updateMany({
            where: {
              workspaceId,
              recurrenceSeriesId: seriesId,
              deletedAt: null,
              occurrenceOriginalAt: { gte: series.splitBoundaryUtc },
              occurrenceState: {
                in: [
                  PrismaSchedulingOccurrenceState.GENERATED,
                  PrismaSchedulingOccurrenceState.OVERRIDDEN,
                ],
              },
            },
            data: {
              deletedAt: new Date(),
              occurrenceState: PrismaSchedulingOccurrenceState.SUPERSEDED,
              updatedByUserId: actorUserId,
            },
          })
          result.repairedCount += updated.count
          result.supersededCount += updated.count
        }
        if (selectedCodes.has('ACTIVE_AFTER_CANCELED_SERIES')) {
          const updated = await tx.schedulingEvent.updateMany({
            where: {
              workspaceId,
              recurrenceSeriesId: seriesId,
              deletedAt: null,
              occurrenceState: {
                in: [
                  PrismaSchedulingOccurrenceState.GENERATED,
                  PrismaSchedulingOccurrenceState.OVERRIDDEN,
                ],
              },
            },
            data: {
              status: PrismaSchedulingEventStatus.CANCELED,
              occurrenceState: PrismaSchedulingOccurrenceState.CANCELED,
              canceledAt: new Date(),
              updatedByUserId: actorUserId,
            },
          })
          result.repairedCount += updated.count
        }
        if (selectedCodes.has('RRULE_MISMATCH')) {
          const rule =
            series.normalizedRule as SchedulingEvent['recurrenceRule']
          if (rule) {
            const normalized = normalizeSchedulingRecurrenceRule({
              rule,
              startsAt: series.masterEvent.startsAtUtc,
              endsAt: series.masterEvent.endsAtUtc,
              timezone: series.timezone,
            })
            await tx.schedulingRecurrenceSeries.update({
              where: { id: seriesId },
              data: {
                rrule: normalized.rrule,
                metadata: {
                  ...(series.metadata &&
                  typeof series.metadata === 'object' &&
                  !Array.isArray(series.metadata)
                    ? (series.metadata as Record<string, unknown>)
                    : {}),
                  summary: normalized.summary,
                },
                version: { increment: 1 },
              },
            })
            result.repairedCount += 1
            result.updatedSeriesCount += 1
          }
        }
        if (selectedCodes.has('GENERATED_THROUGH_BEHIND')) {
          const latest = await tx.schedulingEvent.findFirst({
            where: {
              workspaceId,
              recurrenceSeriesId: seriesId,
              deletedAt: null,
              occurrenceOriginalAt: { not: null },
              occurrenceState: {
                in: [
                  PrismaSchedulingOccurrenceState.GENERATED,
                  PrismaSchedulingOccurrenceState.OVERRIDDEN,
                ],
              },
            },
            orderBy: { occurrenceOriginalAt: 'desc' },
            select: { occurrenceOriginalAt: true },
          })
          if (latest?.occurrenceOriginalAt) {
            await tx.schedulingRecurrenceSeries.update({
              where: { id: seriesId },
              data: {
                generatedThroughUtc: latest.occurrenceOriginalAt,
                version: { increment: 1 },
              },
            })
            result.repairedCount += 1
            result.updatedSeriesCount += 1
          }
        }
        await appendActivity(tx, {
          workspaceId,
          eventId: series.masterEventId,
          actorId: actorUserId,
          action: 'recurrence_integrity_repaired',
          summary: 'Recurring schedule integrity repaired.',
          metadata: {
            repairCodes: [...selectedCodes].sort(),
            repairedCount: result.repairedCount,
          },
        })
        await appendOutbox(tx, {
          workspaceId,
          topic: 'scheduling.recurrence.repaired',
          aggregateId: seriesId,
          payload: {
            seriesId,
            actorUserId,
            repairCodes: [...selectedCodes].sort(),
            repairedCount: result.repairedCount,
          },
        })
      },
    })
    return result
  },

  createRecurrenceSeries(
    args: Prisma.SchedulingRecurrenceSeriesUncheckedCreateInput,
  ) {
    return prisma.schedulingRecurrenceSeries.create({ data: args })
  },
  updateRecurrenceSeries({
    workspaceId,
    seriesId,
    data,
  }: {
    workspaceId: string
    seriesId: string
    data: Prisma.SchedulingRecurrenceSeriesUncheckedUpdateInput
  }) {
    return prisma.schedulingRecurrenceSeries.updateMany({
      where: { id: seriesId, workspaceId },
      data,
    })
  },
  getRecurrenceSeries({
    workspaceId,
    seriesId,
  }: {
    workspaceId: string
    seriesId: string
  }) {
    return prisma.schedulingRecurrenceSeries.findFirst({
      where: { id: seriesId, workspaceId },
    })
  },
}

export type SchedulingRepository = typeof schedulingRepository

export function assertWorkspaceScopedRecord({
  expectedWorkspaceId,
  actualWorkspaceId,
  recordType,
}: {
  expectedWorkspaceId: string
  actualWorkspaceId: string
  recordType: string
}): void {
  if (expectedWorkspaceId !== actualWorkspaceId) {
    throw new SchedulingRepositoryError(
      `${recordType} does not belong to workspace ${expectedWorkspaceId}.`,
      'forbidden',
    )
  }
}
