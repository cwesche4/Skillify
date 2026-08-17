import { createHash } from 'crypto'

import {
  DomainOutboxStatus,
  SchedulingEventStatus as PrismaSchedulingEventStatus,
  SchedulingNotificationCategory as PrismaSchedulingNotificationCategory,
  SchedulingNotificationDeliveryStatus as PrismaSchedulingNotificationDeliveryStatus,
  SchedulingNotificationChannel as PrismaSchedulingNotificationChannel,
  SchedulingNotificationPriority as PrismaSchedulingNotificationPriority,
  SchedulingReminderStatus as PrismaSchedulingReminderStatus,
  type Prisma,
} from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  categoryFromSchedulingOutboxTopic,
  buildSchedulingActionUrl,
  deliveryStatusToPrisma,
  getRetryDelayMs,
  maxDeliveryAttempts,
  maxNotificationWorkerAttempts,
  notificationCategoryFromPrisma,
  notificationCategoryToPrisma,
  notificationChannelFromPrisma,
  notificationChannelToPrisma,
  notificationWorkerLeaseMs,
  priorityForSchedulingCategory,
  reminderPastDueGraceMs,
  reminderStatusToPrisma,
  reminderWorkerLeaseMs,
  deliveryWorkerLeaseMs,
  notificationPriorityToPrisma,
} from '@/lib/scheduling/notifications/notificationPolicy'
import {
  defaultWorkspaceSchedulingNotificationPreferences,
  resolveQuietHoursDelivery,
  resolveSchedulingNotificationPreference,
} from '@/lib/scheduling/notifications/preferences'
import {
  resolveSchedulingNotificationRecipients,
  type SchedulingNotificationRecipient,
} from '@/lib/scheduling/notifications/recipientResolution'
import {
  isValidEmailAddress,
  getSchedulingEmailProvider,
  type SchedulingEmailProvider,
} from '@/lib/scheduling/notifications/emailProvider'
import {
  renderSchedulingNotificationTemplate,
  type SchedulingNotificationRenderedTemplate,
} from '@/lib/scheduling/notifications/templates'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import type {
  MemberSchedulingNotificationPreferences,
  SchedulingNotificationCategory,
  SchedulingReminderInput,
  WorkspaceSchedulingNotificationPreferences,
} from '@/lib/scheduling/types'

type ClaimedOutboxRecord = {
  id: string
  workspaceId: string
  topic: string
  aggregateType: string
  aggregateId: string
  payload: Prisma.JsonValue
  attempts: number
}

type ClaimedReminderRecord = {
  id: string
  workspaceId: string
  schedulingEventId: string | null
  recurrenceSeriesId: string | null
  occurrenceId: string | null
  recipientType: string
  recipientUserId: string | null
  recipientWorkspaceMemberId: string | null
  recipientEmail: string | null
  channel: PrismaSchedulingNotificationChannel
  offsetMinutes: number | null
  scheduledForUtc: Date
  eventStartsAtUtc: Date | null
  timezone: string
  attempts: number
  metadata: Prisma.JsonValue
}

type ClaimedDeliveryRecord = {
  id: string
  workspaceId: string
  notificationId: string
  schedulingEventId: string | null
  recipientEmail: string | null
  destination: string | null
  channel: PrismaSchedulingNotificationChannel
  attempts: number
  idempotencyKey: string | null
  notification: {
    title: string
    body: string
    category: PrismaSchedulingNotificationCategory
    priority: PrismaSchedulingNotificationPriority
    actionUrl: string | null
    metadata: Prisma.JsonValue
  }
}

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function addMs(date: Date, ms: number) {
  return new Date(date.getTime() + ms)
}

function getPublicBaseUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

async function getWorkspaceNotificationContext(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      settings: true,
      members: {
        include: { user: true },
      },
      workspaceTeams: {
        include: { members: true },
      },
    },
  })
  if (!workspace) return null
  const schedulingSettings = normalizeSchedulingSettings({
    businessModel: workspace.businessModel,
    settings: workspace.settings?.scheduling as any,
    workspaceTimezone: workspace.settings?.scheduling
      ? (workspace.settings.scheduling as any)?.timezone
      : undefined,
  })
  const workspacePreferenceRow =
    await prisma.schedulingNotificationPreference.findFirst({
      where: {
        workspaceId,
        scopeType: 'workspace',
        workspaceMemberId: workspacePreferenceScopeKey,
      },
    })
  const workspacePreferences: WorkspaceSchedulingNotificationPreferences = {
    ...defaultWorkspaceSchedulingNotificationPreferences,
    ...(schedulingSettings.notificationPreferences ?? {}),
    ...(workspacePreferenceRow
      ? {
          schedulingEnabled:
            workspacePreferenceRow.schedulingEnabled ?? undefined,
          inAppEnabled: workspacePreferenceRow.inAppEnabled ?? undefined,
          emailEnabled: workspacePreferenceRow.emailEnabled ?? undefined,
          categorySettings:
            (workspacePreferenceRow.categorySettings as any) ?? undefined,
          quietHours: (workspacePreferenceRow.quietHours as any) ?? undefined,
          defaultReminders:
            (workspacePreferenceRow.defaultReminders as any) ?? undefined,
          externalAttendeesEnabled:
            workspacePreferenceRow.externalAttendeesEnabled ?? undefined,
          linkedClientsEnabled:
            workspacePreferenceRow.linkedClientsEnabled ?? undefined,
          deliveryFailureAlertsEnabled:
            workspacePreferenceRow.deliveryFailureAlertsEnabled ?? undefined,
        }
      : {}),
  } as WorkspaceSchedulingNotificationPreferences
  const memberPreferenceRows =
    await prisma.schedulingNotificationPreference.findMany({
      where: { workspaceId, scopeType: 'member' },
    })
  const memberPreferences = new Map<
    string,
    MemberSchedulingNotificationPreferences
  >(
    memberPreferenceRows
      .filter((row) => row.workspaceMemberId)
      .map((row) => [
        row.workspaceMemberId as string,
        {
          schedulingEnabled: row.schedulingEnabled ?? undefined,
          inAppEnabled: row.inAppEnabled ?? undefined,
          emailEnabled: row.emailEnabled ?? undefined,
          categorySettings: (row.categorySettings as any) ?? undefined,
          quietHours: (row.quietHours as any) ?? undefined,
          timezone: row.timezone ?? undefined,
          selfNotifications: row.selfNotifications ?? undefined,
          defaultReminders: (row.defaultReminders as any) ?? undefined,
        },
      ]),
  )
  return {
    workspace,
    schedulingSettings,
    workspacePreferences,
    memberPreferences,
    members: workspace.members.map((member) => ({
      workspaceMemberId: member.id,
      userId: member.userId,
      label: member.user.fullName || member.user.email || member.id,
      email: member.user.email,
      active: true,
    })),
    teams: workspace.workspaceTeams.map((team) => ({
      teamId: team.id,
      label: team.name,
      active: team.isActive && !team.archivedAt,
      memberIds: team.members.map((member) => member.workspaceMemberId),
    })),
  }
}

async function claimOutboxRecords({
  nowUtc,
  batchSize,
  workerId,
}: {
  nowUtc: Date
  batchSize: number
  workerId: string
}) {
  const leaseExpiresAt = addMs(nowUtc, notificationWorkerLeaseMs)
  return prisma.$queryRaw<ClaimedOutboxRecord[]>`
    WITH candidates AS (
      SELECT id
      FROM "DomainOutboxEvent"
      WHERE topic LIKE 'scheduling.%'
        AND (
          status = 'PENDING'
          OR (status = 'FAILED' AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${nowUtc}))
          OR (status = 'PROCESSING' AND "leaseExpiresAt" IS NOT NULL AND "leaseExpiresAt" <= ${nowUtc})
        )
        AND "availableAt" <= ${nowUtc}
      ORDER BY "availableAt" ASC, "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "DomainOutboxEvent" outbox
    SET status = 'PROCESSING',
        attempts = outbox.attempts + 1,
        "claimedAt" = ${nowUtc},
        "claimedBy" = ${workerId},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "updatedAt" = ${nowUtc}
    FROM candidates
    WHERE outbox.id = candidates.id
    RETURNING outbox.id, outbox."workspaceId", outbox.topic, outbox."aggregateType", outbox."aggregateId", outbox.payload, outbox.attempts
  `
}

async function markOutboxProcessed(id: string, nowUtc: Date) {
  await prisma.domainOutboxEvent.update({
    where: { id },
    data: {
      status: DomainOutboxStatus.PROCESSED,
      processedAt: nowUtc,
      claimedAt: null,
      claimedBy: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })
}

async function markOutboxFailed({
  record,
  nowUtc,
  error,
}: {
  record: ClaimedOutboxRecord
  nowUtc: Date
  error: unknown
}) {
  const attempts = record.attempts
  const dead = attempts >= maxNotificationWorkerAttempts
  await prisma.domainOutboxEvent.update({
    where: { id: record.id },
    data: {
      status: dead ? DomainOutboxStatus.DEAD : DomainOutboxStatus.FAILED,
      nextAttemptAt: dead ? null : addMs(nowUtc, getRetryDelayMs(attempts)),
      claimedAt: null,
      claimedBy: null,
      leaseExpiresAt: null,
      lastErrorCode: dead
        ? 'NOTIFICATION_OUTBOX_DEAD'
        : 'NOTIFICATION_OUTBOX_FAILED',
      lastErrorMessage:
        error instanceof Error
          ? error.message.slice(0, 240)
          : 'Scheduling notification outbox processing failed.',
    },
  })
}

async function loadEventForNotification({
  workspaceId,
  eventId,
}: {
  workspaceId: string
  eventId: string
}) {
  return prisma.schedulingEvent.findFirst({
    where: { workspaceId, id: eventId },
    include: {
      assignments: true,
      attendees: true,
      recurrenceSeries: true,
      masterSeries: true,
    },
  })
}

function buildNotificationSnapshot({
  workspaceName,
  event,
  actionUrl,
  category,
  scopeSummary,
}: {
  workspaceName: string
  event: NonNullable<Awaited<ReturnType<typeof loadEventForNotification>>>
  actionUrl: string
  category: SchedulingNotificationCategory
  scopeSummary?: string
}) {
  const rendered = renderSchedulingNotificationTemplate({
    category,
    recipientType: 'workspaceMember',
    workspaceName,
    eventTitle: event.title,
    startsAt: event.startsAtUtc,
    endsAt: event.endsAtUtc,
    timezone: event.timezone,
    location: event.locationLabel || event.locationAddress,
    meetingUrl: event.meetingUrl,
    recurrenceSummary:
      (event.recurrenceSeries?.metadata as any)?.summary ??
      (event.masterSeries?.metadata as any)?.summary,
    actionUrl,
    scopeSummary,
    priority: priorityForSchedulingCategory(category),
  })
  return rendered
}

async function createNotificationForRecipient({
  sourceOutboxId,
  workspaceSlug,
  workspaceName,
  event,
  category,
  recipient,
  workspacePreferences,
  memberPreferences,
  actorUserId,
  scopeSummary,
}: {
  sourceOutboxId: string
  workspaceSlug: string
  workspaceName: string
  event: NonNullable<Awaited<ReturnType<typeof loadEventForNotification>>>
  category: SchedulingNotificationCategory
  recipient: SchedulingNotificationRecipient
  workspacePreferences: WorkspaceSchedulingNotificationPreferences
  memberPreferences?: MemberSchedulingNotificationPreferences | null
  actorUserId?: string | null
  scopeSummary?: string
}) {
  const priority = priorityForSchedulingCategory(category)
  const recipientIdentity = `${recipient.type}:${recipient.id}`
  const deduplicationKey = stableHash({
    sourceOutboxId,
    recipientIdentity,
    category,
    eventId: event.id,
    seriesId: event.recurrenceSeriesId ?? event.masterSeries?.id ?? null,
  })
  const actionUrl = buildSchedulingActionUrl({
    workspaceSlug,
    eventId: event.id,
    seriesId: event.recurrenceSeriesId ?? event.masterSeries?.id,
  })
  const baseUrl = getPublicBaseUrl()
  const absoluteActionUrl = `${baseUrl}${actionUrl}`
  const templateInput = {
    category,
    recipientType: recipient.type,
    workspaceName,
    eventTitle: event.title,
    startsAt: event.startsAtUtc,
    endsAt: event.endsAtUtc,
    timezone: event.timezone,
    location: event.locationLabel || event.locationAddress,
    meetingUrl: event.meetingUrl,
    recurrenceSummary:
      recipient.type === 'workspaceMember'
        ? ((event.recurrenceSeries?.metadata as any)?.summary ??
          (event.masterSeries?.metadata as any)?.summary)
        : undefined,
    actionUrl:
      recipient.type === 'workspaceMember' ? absoluteActionUrl : undefined,
    scopeSummary,
    priority,
  }
  const rendered = renderSchedulingNotificationTemplate(templateInput)
  const inAppPreference = resolveSchedulingNotificationPreference({
    workspacePreferences,
    memberPreferences,
    category,
    channel: 'inApp',
    recipientType: recipient.type,
    workspaceTimezone: event.timezone,
  })
  const emailPreference = resolveSchedulingNotificationPreference({
    workspacePreferences,
    memberPreferences,
    category,
    channel: 'email',
    recipientType: recipient.type,
    workspaceTimezone: event.timezone,
  })
  if (!inAppPreference.inAppEnabled && !emailPreference.emailEnabled) {
    return { created: false, suppressed: true }
  }

  const notification = await prisma.schedulingNotification.upsert({
    where: {
      workspaceId_deduplicationKey: {
        workspaceId: event.workspaceId,
        deduplicationKey,
      },
    },
    create: {
      workspaceId: event.workspaceId,
      key: deduplicationKey,
      deduplicationKey,
      sourceOutboxId,
      category: notificationCategoryToPrisma(category),
      priority: notificationPriorityToPrisma(priority),
      recipientType: recipient.type,
      recipientUserId:
        recipient.type === 'workspaceMember' ? recipient.userId : null,
      recipientWorkspaceMemberId:
        recipient.type === 'workspaceMember'
          ? recipient.workspaceMemberId
          : null,
      recipientEmail: 'email' in recipient ? recipient.email : null,
      title: rendered.title,
      body: rendered.body,
      deepLink: actionUrl,
      actionUrl,
      entityType: 'SchedulingEvent',
      entityId: event.id,
      schedulingEventId: event.id,
      occurrenceId: event.occurrenceOriginalAt ? event.id : null,
      seriesId: event.recurrenceSeriesId ?? event.masterSeries?.id,
      relatedRecordType: event.linkedRecordType,
      relatedRecordId: event.linkedRecordId,
      metadata: jsonInput({
        snapshot: templateInput,
        rendered,
        actorUserId,
        recipientReason: recipient.reason,
      }),
    },
    update: {},
  })

  if (inAppPreference.inAppEnabled && recipient.type === 'workspaceMember') {
    await prisma.schedulingNotificationDelivery.upsert({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: event.workspaceId,
          idempotencyKey: `${deduplicationKey}:inApp`,
        },
      },
      create: {
        workspaceId: event.workspaceId,
        notificationId: notification.id,
        schedulingEventId: event.id,
        recipientUserId: recipient.userId,
        recipientEmail: recipient.email,
        channel: notificationChannelToPrisma('inApp'),
        status: deliveryStatusToPrisma('sent'),
        destination: recipient.userId ?? recipient.workspaceMemberId,
        provider: 'skillify',
        attempts: 1,
        idempotencyKey: `${deduplicationKey}:inApp`,
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
      update: {},
    })
  }

  if (emailPreference.emailEnabled) {
    const email = 'email' in recipient ? recipient.email : undefined
    const quiet = resolveQuietHoursDelivery({
      intendedDeliveryUtc: new Date(),
      eventStartUtc: event.startsAtUtc,
      recipientTimezone: emailPreference.timezone,
      quietHours:
        memberPreferences?.quietHours ?? workspacePreferences.quietHours,
      priority,
    })
    await prisma.schedulingNotificationDelivery.upsert({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: event.workspaceId,
          idempotencyKey: `${deduplicationKey}:email`,
        },
      },
      create: {
        workspaceId: event.workspaceId,
        notificationId: notification.id,
        schedulingEventId: event.id,
        recipientUserId:
          recipient.type === 'workspaceMember' ? recipient.userId : null,
        recipientEmail: email,
        channel: notificationChannelToPrisma('email'),
        status:
          !email || !isValidEmailAddress(email)
            ? deliveryStatusToPrisma('skipped')
            : quiet.action === 'defer'
              ? deliveryStatusToPrisma('deferred')
              : quiet.action === 'skip'
                ? deliveryStatusToPrisma('skipped')
                : deliveryStatusToPrisma('pending'),
        destination: email,
        provider: 'pending',
        nextAttemptAt:
          quiet.action === 'defer' ? quiet.deferUntilUtc : new Date(),
        attempts: 0,
        idempotencyKey: `${deduplicationKey}:email`,
        lastErrorCode:
          quiet.action === 'skip'
            ? quiet.reason
            : !email || !isValidEmailAddress(email)
              ? 'INVALID_EMAIL'
              : null,
      },
      update: {},
    })
  }

  return { created: true, suppressed: false }
}

async function processSingleOutboxRecord({
  record,
  nowUtc,
}: {
  record: ClaimedOutboxRecord
  nowUtc: Date
}) {
  const payload = asRecord(record.payload)
  if (payload.notificationEligible === false) {
    await markOutboxProcessed(record.id, nowUtc)
    return { processed: 1, skipped: 1, notificationsCreated: 0 }
  }
  const category = categoryFromSchedulingOutboxTopic(record.topic, payload)
  if (!category) {
    await markOutboxProcessed(record.id, nowUtc)
    return { processed: 1, skipped: 1, notificationsCreated: 0 }
  }
  const eventId =
    typeof payload.eventId === 'string' ? payload.eventId : record.aggregateId
  const event = await loadEventForNotification({
    workspaceId: record.workspaceId,
    eventId,
  })
  if (!event || event.deletedAt) {
    await markOutboxProcessed(record.id, nowUtc)
    return { processed: 1, skipped: 1, notificationsCreated: 0 }
  }
  const context = await getWorkspaceNotificationContext(record.workspaceId)
  if (!context) {
    await markOutboxProcessed(record.id, nowUtc)
    return { processed: 1, skipped: 1, notificationsCreated: 0 }
  }
  const assignedMemberIds = event.assignments
    .map((assignment) => assignment.workspaceMemberId)
    .filter(Boolean) as string[]
  const assignedTeamIds = event.assignments
    .map((assignment) => assignment.teamId)
    .filter(Boolean) as string[]
  const recipients = resolveSchedulingNotificationRecipients({
    assignedMemberIds,
    assignedTeamIds,
    members: context.members,
    teams: context.teams,
    attendees: event.attendees.map((attendee) => ({
      attendeeId: attendee.id,
      email: attendee.email,
      displayName: attendee.name,
      isOrganizer: attendee.isOrganizer,
    })),
    category,
    actorUserId:
      typeof payload.actorUserId === 'string' ? payload.actorUserId : null,
    includeActor: false,
    includeExternalAttendees:
      context.workspacePreferences.externalAttendeesEnabled,
  })
  let notificationsCreated = 0
  let suppressed = 0
  for (const recipient of recipients) {
    const memberPreferences =
      recipient.type === 'workspaceMember'
        ? context.memberPreferences.get(recipient.workspaceMemberId)
        : null
    const result = await createNotificationForRecipient({
      sourceOutboxId: record.id,
      workspaceSlug: context.workspace.slug,
      workspaceName: context.workspace.businessName || context.workspace.name,
      event,
      category,
      recipient,
      workspacePreferences: context.workspacePreferences,
      memberPreferences,
      actorUserId:
        typeof payload.actorUserId === 'string' ? payload.actorUserId : null,
      scopeSummary:
        typeof payload.scope === 'string'
          ? `Scope: ${payload.scope}.`
          : undefined,
    })
    if (result.created) notificationsCreated += 1
    if (result.suppressed) suppressed += 1
  }
  await reconcileSchedulingReminders({
    workspaceId: record.workspaceId,
    eventId: event.id,
    seriesId: event.recurrenceSeriesId ?? event.masterSeries?.id,
    reason: record.topic,
    nowUtc,
  })
  await markOutboxProcessed(record.id, nowUtc)
  return {
    processed: 1,
    skipped: 0,
    notificationsCreated,
    suppressed,
  }
}

export async function processSchedulingNotificationOutbox({
  batchSize = 50,
  nowUtc = new Date(),
  workerId = `worker-${process.pid}`,
}: {
  batchSize?: number
  nowUtc?: Date
  workerId?: string
} = {}) {
  const records = await claimOutboxRecords({ nowUtc, batchSize, workerId })
  const result = {
    claimed: records.length,
    processed: 0,
    skipped: 0,
    notificationsCreated: 0,
    suppressed: 0,
    failed: 0,
  }
  for (const record of records) {
    try {
      const item = await processSingleOutboxRecord({ record, nowUtc })
      result.processed += item.processed
      result.skipped += item.skipped
      result.notificationsCreated += item.notificationsCreated
      result.suppressed += item.suppressed ?? 0
    } catch (error) {
      result.failed += 1
      await markOutboxFailed({ record, nowUtc, error })
    }
  }
  console.info('[scheduling notifications outbox]', result)
  return result
}

function getReminderPolicyForEvent({
  eventReminderPolicy,
  workspacePreferences,
}: {
  eventReminderPolicy: Prisma.JsonValue
  workspacePreferences: WorkspaceSchedulingNotificationPreferences
}): SchedulingReminderInput[] {
  const policy = asRecord(eventReminderPolicy)
  if (policy.mode === 'none') return []
  if (policy.mode === 'custom' && Array.isArray(policy.reminders)) {
    return policy.reminders.filter(Boolean) as SchedulingReminderInput[]
  }
  return workspacePreferences.defaultReminders ?? []
}

export async function reconcileSchedulingReminders({
  workspaceId,
  eventId,
  seriesId,
  reason,
  nowUtc = new Date(),
}: {
  workspaceId: string
  eventId?: string
  seriesId?: string | null
  reason: string
  nowUtc?: Date
}) {
  const context = await getWorkspaceNotificationContext(workspaceId)
  if (!context) return { created: 0, canceled: 0, skipped: 0 }
  const events = await prisma.schedulingEvent.findMany({
    where: {
      workspaceId,
      id: eventId ? eventId : undefined,
      recurrenceSeriesId: !eventId && seriesId ? seriesId : undefined,
      deletedAt: null,
      status: {
        notIn: [
          PrismaSchedulingEventStatus.CANCELED,
          PrismaSchedulingEventStatus.COMPLETED,
          PrismaSchedulingEventStatus.MISSED,
        ],
      },
      occurrenceState: {
        notIn: ['MASTER', 'CANCELED', 'DELETED', 'SUPERSEDED'] as any,
      },
      startsAtUtc: { gte: addMs(nowUtc, -reminderPastDueGraceMs) },
    },
    include: { assignments: true, attendees: true },
    orderBy: { startsAtUtc: 'asc' },
    take: 500,
  })
  const existingWhere = {
    workspaceId,
    schedulingEventId: eventId ? eventId : undefined,
    recurrenceSeriesId: !eventId && seriesId ? seriesId : undefined,
    status: {
      in: [
        PrismaSchedulingReminderStatus.SCHEDULED,
        PrismaSchedulingReminderStatus.FAILED,
        PrismaSchedulingReminderStatus.PROCESSING,
      ],
    },
  }
  const canceled = await prisma.schedulingReminderSchedule.updateMany({
    where: existingWhere,
    data: {
      status: PrismaSchedulingReminderStatus.CANCELED,
      canceledAt: nowUtc,
      lastErrorCode: 'REMINDER_RECONCILED',
    },
  })
  let created = 0
  let skipped = 0
  for (const event of events) {
    const reminders = getReminderPolicyForEvent({
      eventReminderPolicy: event.reminderPolicy,
      workspacePreferences: context.workspacePreferences,
    })
    const assignedMemberIds = event.assignments
      .map((assignment) => assignment.workspaceMemberId)
      .filter(Boolean) as string[]
    const assignedTeamIds = event.assignments
      .map((assignment) => assignment.teamId)
      .filter(Boolean) as string[]
    for (const reminder of reminders) {
      const recipients = resolveSchedulingNotificationRecipients({
        assignedMemberIds,
        assignedTeamIds,
        members: context.members,
        teams: context.teams,
        attendees: event.attendees.map((attendee) => ({
          attendeeId: attendee.id,
          email: attendee.email,
          displayName: attendee.name,
          isOrganizer: attendee.isOrganizer,
        })),
        category: 'reminder',
        includeActor: true,
        includeExternalAttendees:
          context.workspacePreferences.externalAttendeesEnabled,
        reminderRecipientGroup: reminder.recipientGroup,
      })
      for (const recipient of recipients) {
        const scheduledForUtc = addMs(
          event.startsAtUtc,
          -reminder.offsetMinutes * 60_000,
        )
        if (event.endsAtUtc <= nowUtc) {
          skipped += 1
          continue
        }
        if (
          scheduledForUtc < addMs(nowUtc, -reminderPastDueGraceMs) &&
          event.startsAtUtc <= nowUtc
        ) {
          skipped += 1
          continue
        }
        const idempotencyKey = stableHash({
          eventId: event.id,
          seriesId: event.recurrenceSeriesId,
          occurrenceOriginalAt: event.occurrenceOriginalAt?.toISOString(),
          recipient: `${recipient.type}:${recipient.id}`,
          channel: reminder.channel,
          offsetMinutes: reminder.offsetMinutes,
        })
        await prisma.schedulingReminderSchedule.upsert({
          where: {
            workspaceId_idempotencyKey: { workspaceId, idempotencyKey },
          },
          create: {
            workspaceId,
            schedulingEventId: event.id,
            recurrenceSeriesId: event.recurrenceSeriesId,
            occurrenceId: event.occurrenceOriginalAt ? event.id : null,
            occurrenceOriginalAt: event.occurrenceOriginalAt,
            recipientType: recipient.type,
            recipientUserId:
              recipient.type === 'workspaceMember' ? recipient.userId : null,
            recipientWorkspaceMemberId:
              recipient.type === 'workspaceMember'
                ? recipient.workspaceMemberId
                : null,
            recipientEmail: 'email' in recipient ? recipient.email : null,
            channel: notificationChannelToPrisma(reminder.channel),
            offsetMinutes: reminder.offsetMinutes,
            scheduledForUtc:
              scheduledForUtc < nowUtc ? nowUtc : scheduledForUtc,
            eventStartsAtUtc: event.startsAtUtc,
            timezone: event.timezone,
            status: reminderStatusToPrisma('scheduled'),
            idempotencyKey,
            source: reason,
            nextAttemptAt: scheduledForUtc < nowUtc ? nowUtc : scheduledForUtc,
            metadata: jsonInput({
              eventTitle: event.title,
              recipientReason: recipient.reason,
            }),
          },
          update: {
            status: reminderStatusToPrisma('scheduled'),
            scheduledForUtc:
              scheduledForUtc < nowUtc ? nowUtc : scheduledForUtc,
            eventStartsAtUtc: event.startsAtUtc,
            canceledAt: null,
            skippedAt: null,
            failedAt: null,
            nextAttemptAt: scheduledForUtc < nowUtc ? nowUtc : scheduledForUtc,
          },
        })
        created += 1
      }
    }
  }
  return { created, canceled: canceled.count, skipped }
}

async function claimReminderRecords({
  nowUtc,
  batchSize,
  workerId,
}: {
  nowUtc: Date
  batchSize: number
  workerId: string
}) {
  const leaseExpiresAt = addMs(nowUtc, reminderWorkerLeaseMs)
  return prisma.$queryRaw<ClaimedReminderRecord[]>`
    WITH candidates AS (
      SELECT id
      FROM "SchedulingReminderSchedule"
      WHERE (
          status = 'SCHEDULED'
          OR (status = 'FAILED' AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${nowUtc}))
          OR (status = 'PROCESSING' AND "leaseExpiresAt" IS NOT NULL AND "leaseExpiresAt" <= ${nowUtc})
        )
        AND "scheduledForUtc" <= ${nowUtc}
      ORDER BY "scheduledForUtc" ASC, "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "SchedulingReminderSchedule" reminder
    SET status = 'PROCESSING',
        attempts = reminder.attempts + 1,
        "claimedAt" = ${nowUtc},
        "claimedBy" = ${workerId},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "updatedAt" = ${nowUtc}
    FROM candidates
    WHERE reminder.id = candidates.id
    RETURNING reminder.*
  `
}

export async function processDueSchedulingReminders({
  batchSize = 50,
  nowUtc = new Date(),
  workerId = `worker-${process.pid}`,
}: {
  batchSize?: number
  nowUtc?: Date
  workerId?: string
} = {}) {
  const reminders = await claimReminderRecords({ nowUtc, batchSize, workerId })
  const result = { claimed: reminders.length, sent: 0, skipped: 0, failed: 0 }
  for (const reminder of reminders) {
    try {
      const event = reminder.schedulingEventId
        ? await loadEventForNotification({
            workspaceId: reminder.workspaceId,
            eventId: reminder.schedulingEventId,
          })
        : null
      if (
        !event ||
        event.deletedAt ||
        event.status === PrismaSchedulingEventStatus.CANCELED ||
        event.status === PrismaSchedulingEventStatus.COMPLETED ||
        event.status === PrismaSchedulingEventStatus.MISSED ||
        (event.endsAtUtc <= nowUtc &&
          reminder.scheduledForUtc < addMs(nowUtc, -reminderPastDueGraceMs))
      ) {
        await prisma.schedulingReminderSchedule.update({
          where: { id: reminder.id },
          data: {
            status: PrismaSchedulingReminderStatus.SKIPPED,
            skippedAt: nowUtc,
            claimedAt: null,
            claimedBy: null,
            leaseExpiresAt: null,
            lastErrorCode: 'REMINDER_NO_LONGER_RELEVANT',
          },
        })
        result.skipped += 1
        continue
      }
      const outboxId = `reminder:${reminder.id}`
      const context = await getWorkspaceNotificationContext(
        reminder.workspaceId,
      )
      if (!context) throw new Error('Workspace not found for reminder.')
      const recipient: SchedulingNotificationRecipient =
        reminder.recipientType === 'workspaceMember'
          ? {
              type: 'workspaceMember',
              id: reminder.recipientWorkspaceMemberId ?? reminder.id,
              workspaceMemberId: reminder.recipientWorkspaceMemberId ?? '',
              userId: reminder.recipientUserId ?? undefined,
              email: reminder.recipientEmail ?? undefined,
              reason: 'reminder',
            }
          : {
              type: 'externalAttendee',
              id: reminder.recipientEmail ?? reminder.id,
              attendeeId: reminder.recipientEmail ?? reminder.id,
              email: reminder.recipientEmail ?? '',
              reason: 'reminder',
            }
      const memberPreferences =
        recipient.type === 'workspaceMember'
          ? context.memberPreferences.get(recipient.workspaceMemberId)
          : null
      await createNotificationForRecipient({
        sourceOutboxId: outboxId,
        workspaceSlug: context.workspace.slug,
        workspaceName: context.workspace.businessName || context.workspace.name,
        event,
        category: 'reminder',
        recipient,
        workspacePreferences: context.workspacePreferences,
        memberPreferences,
      })
      await prisma.schedulingReminderSchedule.update({
        where: { id: reminder.id },
        data: {
          status: PrismaSchedulingReminderStatus.SENT,
          sentAt: nowUtc,
          claimedAt: null,
          claimedBy: null,
          leaseExpiresAt: null,
        },
      })
      result.sent += 1
    } catch (error) {
      const permanentlyFailed = reminder.attempts >= maxDeliveryAttempts
      await prisma.schedulingReminderSchedule.update({
        where: { id: reminder.id },
        data: {
          status: permanentlyFailed
            ? PrismaSchedulingReminderStatus.PERMANENTLY_FAILED
            : PrismaSchedulingReminderStatus.FAILED,
          nextAttemptAt: permanentlyFailed
            ? null
            : addMs(nowUtc, getRetryDelayMs(reminder.attempts)),
          claimedAt: null,
          claimedBy: null,
          leaseExpiresAt: null,
          failedAt: nowUtc,
          lastErrorCode: permanentlyFailed
            ? 'REMINDER_PERMANENTLY_FAILED'
            : 'REMINDER_FAILED',
          lastErrorMessage:
            error instanceof Error ? error.message.slice(0, 240) : undefined,
        },
      })
      result.failed += 1
    }
  }
  console.info('[scheduling reminders]', result)
  return result
}

async function claimDeliveryRecords({
  nowUtc,
  batchSize,
  workerId,
}: {
  nowUtc: Date
  batchSize: number
  workerId: string
}) {
  const leaseExpiresAt = addMs(nowUtc, deliveryWorkerLeaseMs)
  return prisma.$queryRaw<ClaimedDeliveryRecord[]>`
    WITH candidates AS (
      SELECT id
      FROM "SchedulingNotificationDelivery"
      WHERE channel = 'EMAIL'
        AND (
          status = 'PENDING'
          OR status = 'DEFERRED'
          OR (status = 'FAILED' AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${nowUtc}))
          OR (status = 'PROCESSING' AND "leaseExpiresAt" IS NOT NULL AND "leaseExpiresAt" <= ${nowUtc})
        )
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${nowUtc})
      ORDER BY "nextAttemptAt" ASC NULLS FIRST, "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "SchedulingNotificationDelivery" delivery
    SET status = 'PROCESSING',
        attempts = delivery.attempts + 1,
        "claimedAt" = ${nowUtc},
        "claimedBy" = ${workerId},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "lastAttemptAt" = ${nowUtc},
        "updatedAt" = ${nowUtc}
    FROM candidates
    WHERE delivery.id = candidates.id
    RETURNING delivery.*
  `
}

async function loadClaimedDelivery(
  id: string,
): Promise<ClaimedDeliveryRecord | null> {
  return prisma.schedulingNotificationDelivery.findUnique({
    where: { id },
    include: {
      notification: {
        select: {
          title: true,
          body: true,
          category: true,
          priority: true,
          actionUrl: true,
          metadata: true,
        },
      },
    },
  }) as Promise<ClaimedDeliveryRecord | null>
}

export async function processPendingNotificationDeliveries({
  batchSize = 50,
  nowUtc = new Date(),
  workerId = `worker-${process.pid}`,
  emailProvider = getSchedulingEmailProvider(),
}: {
  batchSize?: number
  nowUtc?: Date
  workerId?: string
  emailProvider?: SchedulingEmailProvider
} = {}) {
  const claimed = await claimDeliveryRecords({ nowUtc, batchSize, workerId })
  const result = { claimed: claimed.length, sent: 0, skipped: 0, failed: 0 }
  for (const row of claimed) {
    const delivery = await loadClaimedDelivery(row.id)
    if (!delivery) continue
    const destination = delivery.destination ?? delivery.recipientEmail
    if (typeof destination !== 'string' || !isValidEmailAddress(destination)) {
      await prisma.schedulingNotificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: PrismaSchedulingNotificationDeliveryStatus.SKIPPED,
          failedAt: nowUtc,
          claimedAt: null,
          claimedBy: null,
          leaseExpiresAt: null,
          lastErrorCode: 'INVALID_EMAIL',
          lastErrorMessage: 'Recipient email is missing or invalid.',
        },
      })
      result.skipped += 1
      continue
    }
    const emailDestination = destination
    const metadata = asRecord(delivery.notification.metadata)
    const rendered = asRecord(
      metadata.rendered as Prisma.JsonValue,
    ) as Partial<SchedulingNotificationRenderedTemplate>
    const sendResult = await emailProvider.send({
      to: emailDestination,
      subject: rendered.subject ?? delivery.notification.title,
      html: rendered.html ?? `<p>${delivery.notification.body}</p>`,
      text: rendered.text ?? delivery.notification.body,
      idempotencyKey:
        delivery.idempotencyKey ?? `${delivery.workspaceId}:${delivery.id}`,
      metadata: {
        workspaceId: delivery.workspaceId,
        notificationId: delivery.notificationId,
        deliveryId: delivery.id,
      },
    })
    if (sendResult.status === 'sent') {
      await prisma.schedulingNotificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: PrismaSchedulingNotificationDeliveryStatus.SENT,
          provider: sendResult.provider,
          providerMessageId: sendResult.providerMessageId,
          sentAt: nowUtc,
          claimedAt: null,
          claimedBy: null,
          leaseExpiresAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      })
      result.sent += 1
      continue
    }
    const permanent =
      sendResult.status === 'skipped' ||
      (sendResult.status === 'failed' && !sendResult.retryable) ||
      delivery.attempts >= maxDeliveryAttempts
    await prisma.schedulingNotificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status:
          sendResult.status === 'skipped'
            ? PrismaSchedulingNotificationDeliveryStatus.SKIPPED
            : permanent
              ? PrismaSchedulingNotificationDeliveryStatus.PERMANENTLY_FAILED
              : PrismaSchedulingNotificationDeliveryStatus.FAILED,
        provider: sendResult.provider,
        nextAttemptAt: permanent
          ? null
          : addMs(nowUtc, getRetryDelayMs(delivery.attempts)),
        failedAt: nowUtc,
        claimedAt: null,
        claimedBy: null,
        leaseExpiresAt: null,
        lastErrorCode: sendResult.code,
        lastErrorMessage: sendResult.message,
      },
    })
    if (sendResult.status === 'skipped') result.skipped += 1
    else result.failed += 1
  }
  console.info('[scheduling notification deliveries]', result)
  return result
}

export async function listSchedulingNotifications({
  workspaceId,
  userId,
  status = 'active',
  category,
  cursor,
  limit = 20,
}: {
  workspaceId: string
  userId: string
  status?: 'active' | 'unread' | 'read' | 'archived'
  category?: SchedulingNotificationCategory | null
  cursor?: string
  limit?: number
}) {
  const take = Math.min(Math.max(limit, 1), 50)
  const rows = await prisma.schedulingNotification.findMany({
    where: {
      workspaceId,
      recipientUserId: userId,
      archivedAt: status === 'archived' ? { not: null } : null,
      readAt:
        status === 'unread'
          ? null
          : status === 'read'
            ? { not: null }
            : undefined,
      category: category ? notificationCategoryToPrisma(category) : undefined,
    },
    orderBy: { createdAt: 'desc' },
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    take: take + 1,
  })
  const items = rows.slice(0, take)
  return {
    notifications: items.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      category: notificationCategoryFromPrisma(item.category),
      priority: item.priority.toLowerCase(),
      actionUrl: item.actionUrl ?? item.deepLink,
      readAt: item.readAt?.toISOString() ?? null,
      archivedAt: item.archivedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      metadata: item.metadata,
    })),
    nextCursor: rows.length > take ? rows[take].id : null,
  }
}

export async function countUnreadSchedulingNotifications({
  workspaceId,
  userId,
}: {
  workspaceId: string
  userId: string
}) {
  return prisma.schedulingNotification.count({
    where: {
      workspaceId,
      recipientUserId: userId,
      readAt: null,
      archivedAt: null,
    },
  })
}

export async function markSchedulingNotificationRead({
  workspaceId,
  userId,
  notificationId,
}: {
  workspaceId: string
  userId: string
  notificationId: string
}) {
  await prisma.schedulingNotification.updateMany({
    where: { id: notificationId, workspaceId, recipientUserId: userId },
    data: { readAt: new Date() },
  })
}

export async function markAllSchedulingNotificationsRead({
  workspaceId,
  userId,
}: {
  workspaceId: string
  userId: string
}) {
  const result = await prisma.schedulingNotification.updateMany({
    where: { workspaceId, recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  })
  return { updated: result.count }
}

export async function archiveSchedulingNotification({
  workspaceId,
  userId,
  notificationId,
}: {
  workspaceId: string
  userId: string
  notificationId: string
}) {
  await prisma.schedulingNotification.updateMany({
    where: { id: notificationId, workspaceId, recipientUserId: userId },
    data: { archivedAt: new Date(), readAt: new Date() },
  })
}

export async function listSchedulingNotificationDeliveries({
  workspaceId,
  limit = 50,
}: {
  workspaceId: string
  limit?: number
}) {
  const rows = await prisma.schedulingNotificationDelivery.findMany({
    where: { workspaceId },
    include: { notification: true },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  })
  return rows.map((row) => ({
    id: row.id,
    notificationId: row.notificationId,
    category: notificationCategoryFromPrisma(row.notification.category),
    recipient: row.recipientEmail ?? row.recipientUserId ?? 'Unknown',
    channel: notificationChannelFromPrisma(row.channel),
    status: row.status.toLowerCase(),
    attempts: row.attempts,
    provider: row.provider,
    providerMessageId: row.providerMessageId,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function retrySchedulingNotificationDelivery({
  workspaceId,
  deliveryId,
}: {
  workspaceId: string
  deliveryId: string
}) {
  await prisma.schedulingNotificationDelivery.updateMany({
    where: {
      id: deliveryId,
      workspaceId,
      status: {
        in: [
          PrismaSchedulingNotificationDeliveryStatus.FAILED,
          PrismaSchedulingNotificationDeliveryStatus.PERMANENTLY_FAILED,
          PrismaSchedulingNotificationDeliveryStatus.SKIPPED,
        ],
      },
    },
    data: {
      status: PrismaSchedulingNotificationDeliveryStatus.PENDING,
      nextAttemptAt: new Date(),
      claimedAt: null,
      claimedBy: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })
}

const workspacePreferenceScopeKey = '__workspace__'

export async function getSchedulingNotificationPreferences({
  workspaceId,
  userId,
}: {
  workspaceId: string
  userId: string
}) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    select: { id: true },
  })
  const preferenceScopes: Prisma.SchedulingNotificationPreferenceWhereInput[] =
    [{ scopeType: 'workspace', workspaceMemberId: workspacePreferenceScopeKey }]
  if (membership) {
    preferenceScopes.push({
      scopeType: 'member',
      workspaceMemberId: membership.id,
    })
  }
  const rows = await prisma.schedulingNotificationPreference.findMany({
    where: {
      workspaceId,
      OR: preferenceScopes,
    },
  })
  const workspace = rows.find((row) => row.scopeType === 'workspace')
  const member = rows.find((row) => row.scopeType === 'member')
  return {
    workspace: workspace
      ? {
          schedulingEnabled: workspace.schedulingEnabled,
          inAppEnabled: workspace.inAppEnabled,
          emailEnabled: workspace.emailEnabled,
          categorySettings: workspace.categorySettings,
          quietHours: workspace.quietHours,
          defaultReminders: workspace.defaultReminders,
          externalAttendeesEnabled: workspace.externalAttendeesEnabled,
          linkedClientsEnabled: workspace.linkedClientsEnabled,
          deliveryFailureAlertsEnabled: workspace.deliveryFailureAlertsEnabled,
        }
      : defaultWorkspaceSchedulingNotificationPreferences,
    member: member
      ? {
          schedulingEnabled: member.schedulingEnabled,
          inAppEnabled: member.inAppEnabled,
          emailEnabled: member.emailEnabled,
          categorySettings: member.categorySettings,
          quietHours: member.quietHours,
          timezone: member.timezone,
          selfNotifications: member.selfNotifications,
          defaultReminders: member.defaultReminders,
        }
      : null,
  }
}

export async function saveWorkspaceSchedulingNotificationPreferences({
  workspaceId,
  preferences,
}: {
  workspaceId: string
  preferences: Partial<WorkspaceSchedulingNotificationPreferences>
}) {
  return prisma.schedulingNotificationPreference.upsert({
    where: {
      workspaceId_scopeType_workspaceMemberId: {
        workspaceId,
        scopeType: 'workspace',
        workspaceMemberId: workspacePreferenceScopeKey,
      },
    },
    create: {
      workspaceId,
      scopeType: 'workspace',
      workspaceMemberId: workspacePreferenceScopeKey,
      schedulingEnabled: preferences.schedulingEnabled,
      inAppEnabled: preferences.inAppEnabled,
      emailEnabled: preferences.emailEnabled,
      categorySettings: preferences.categorySettings
        ? jsonInput(preferences.categorySettings)
        : undefined,
      quietHours: preferences.quietHours
        ? jsonInput(preferences.quietHours)
        : undefined,
      defaultReminders: preferences.defaultReminders
        ? jsonInput(preferences.defaultReminders)
        : undefined,
      externalAttendeesEnabled: preferences.externalAttendeesEnabled,
      linkedClientsEnabled: preferences.linkedClientsEnabled,
      deliveryFailureAlertsEnabled: preferences.deliveryFailureAlertsEnabled,
    },
    update: {
      schedulingEnabled: preferences.schedulingEnabled,
      inAppEnabled: preferences.inAppEnabled,
      emailEnabled: preferences.emailEnabled,
      categorySettings:
        preferences.categorySettings === undefined
          ? undefined
          : jsonInput(preferences.categorySettings),
      quietHours:
        preferences.quietHours === undefined
          ? undefined
          : jsonInput(preferences.quietHours),
      defaultReminders:
        preferences.defaultReminders === undefined
          ? undefined
          : jsonInput(preferences.defaultReminders),
      externalAttendeesEnabled: preferences.externalAttendeesEnabled,
      linkedClientsEnabled: preferences.linkedClientsEnabled,
      deliveryFailureAlertsEnabled: preferences.deliveryFailureAlertsEnabled,
    },
  })
}

export async function saveMemberSchedulingNotificationPreferences({
  workspaceId,
  userId,
  preferences,
}: {
  workspaceId: string
  userId: string
  preferences: Partial<MemberSchedulingNotificationPreferences>
}) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    select: { id: true },
  })
  if (!membership) {
    throw new Error('Workspace membership not found.')
  }
  return prisma.schedulingNotificationPreference.upsert({
    where: {
      workspaceId_scopeType_workspaceMemberId: {
        workspaceId,
        scopeType: 'member',
        workspaceMemberId: membership.id,
      },
    },
    create: {
      workspaceId,
      scopeType: 'member',
      workspaceMemberId: membership.id,
      userId,
      schedulingEnabled: preferences.schedulingEnabled,
      inAppEnabled: preferences.inAppEnabled,
      emailEnabled: preferences.emailEnabled,
      categorySettings: preferences.categorySettings
        ? jsonInput(preferences.categorySettings)
        : undefined,
      quietHours: preferences.quietHours
        ? jsonInput(preferences.quietHours)
        : undefined,
      timezone: preferences.timezone,
      selfNotifications: preferences.selfNotifications,
      defaultReminders: preferences.defaultReminders
        ? jsonInput(preferences.defaultReminders)
        : undefined,
    },
    update: {
      schedulingEnabled: preferences.schedulingEnabled,
      inAppEnabled: preferences.inAppEnabled,
      emailEnabled: preferences.emailEnabled,
      categorySettings:
        preferences.categorySettings === undefined
          ? undefined
          : jsonInput(preferences.categorySettings),
      quietHours:
        preferences.quietHours === undefined
          ? undefined
          : jsonInput(preferences.quietHours),
      timezone: preferences.timezone,
      selfNotifications: preferences.selfNotifications,
      defaultReminders:
        preferences.defaultReminders === undefined
          ? undefined
          : jsonInput(preferences.defaultReminders),
    },
  })
}

export async function resetMemberSchedulingNotificationPreferences({
  workspaceId,
  userId,
}: {
  workspaceId: string
  userId: string
}) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    select: { id: true },
  })
  if (!membership) {
    throw new Error('Workspace membership not found.')
  }
  await prisma.schedulingNotificationPreference.deleteMany({
    where: {
      workspaceId,
      scopeType: 'member',
      workspaceMemberId: membership.id,
    },
  })
}

export async function markSchedulingNotificationUnread({
  workspaceId,
  userId,
  notificationId,
}: {
  workspaceId: string
  userId: string
  notificationId: string
}) {
  await prisma.schedulingNotification.updateMany({
    where: { id: notificationId, workspaceId, recipientUserId: userId },
    data: { readAt: null, archivedAt: null },
  })
}

export async function bulkArchiveSchedulingNotifications({
  workspaceId,
  userId,
}: {
  workspaceId: string
  userId: string
}) {
  const now = new Date()
  const result = await prisma.schedulingNotification.updateMany({
    where: { workspaceId, recipientUserId: userId, archivedAt: null },
    data: { archivedAt: now, readAt: now },
  })
  return { updated: result.count }
}

export async function recoverSchedulingNotificationWorkerLeases({
  nowUtc = new Date(),
}: {
  nowUtc?: Date
} = {}) {
  const [outbox, reminders, deliveries] = await prisma.$transaction([
    prisma.domainOutboxEvent.updateMany({
      where: {
        status: DomainOutboxStatus.PROCESSING,
        leaseExpiresAt: { lte: nowUtc },
      },
      data: {
        status: DomainOutboxStatus.PENDING,
        claimedAt: null,
        claimedBy: null,
        leaseExpiresAt: null,
        nextAttemptAt: nowUtc,
      },
    }),
    prisma.schedulingReminderSchedule.updateMany({
      where: {
        status: PrismaSchedulingReminderStatus.PROCESSING,
        leaseExpiresAt: { lte: nowUtc },
      },
      data: {
        status: PrismaSchedulingReminderStatus.SCHEDULED,
        claimedAt: null,
        claimedBy: null,
        leaseExpiresAt: null,
        nextAttemptAt: nowUtc,
      },
    }),
    prisma.schedulingNotificationDelivery.updateMany({
      where: {
        status: PrismaSchedulingNotificationDeliveryStatus.PROCESSING,
        leaseExpiresAt: { lte: nowUtc },
      },
      data: {
        status: PrismaSchedulingNotificationDeliveryStatus.PENDING,
        claimedAt: null,
        claimedBy: null,
        leaseExpiresAt: null,
        nextAttemptAt: nowUtc,
      },
    }),
  ])
  return {
    recoveredOutbox: outbox.count,
    recoveredReminders: reminders.count,
    recoveredDeliveries: deliveries.count,
  }
}

export async function getSchedulingNotificationWorkerDiagnostics({
  nowUtc = new Date(),
}: {
  nowUtc?: Date
} = {}) {
  const [
    outboxPending,
    outboxProcessing,
    outboxFailed,
    deliveriesPending,
    deliveriesFailed,
    reminderBacklog,
    expiredOutboxLeases,
    expiredReminderLeases,
    expiredDeliveryLeases,
    lastOutboxSuccess,
    lastReminderSuccess,
    lastDeliverySuccess,
  ] = await Promise.all([
    prisma.domainOutboxEvent.count({
      where: {
        topic: { startsWith: 'scheduling.' },
        status: DomainOutboxStatus.PENDING,
      },
    }),
    prisma.domainOutboxEvent.count({
      where: {
        topic: { startsWith: 'scheduling.' },
        status: DomainOutboxStatus.PROCESSING,
      },
    }),
    prisma.domainOutboxEvent.count({
      where: {
        topic: { startsWith: 'scheduling.' },
        status: { in: [DomainOutboxStatus.FAILED, DomainOutboxStatus.DEAD] },
      },
    }),
    prisma.schedulingNotificationDelivery.count({
      where: {
        status: {
          in: [
            PrismaSchedulingNotificationDeliveryStatus.PENDING,
            PrismaSchedulingNotificationDeliveryStatus.DEFERRED,
          ],
        },
      },
    }),
    prisma.schedulingNotificationDelivery.count({
      where: {
        status: {
          in: [
            PrismaSchedulingNotificationDeliveryStatus.FAILED,
            PrismaSchedulingNotificationDeliveryStatus.PERMANENTLY_FAILED,
          ],
        },
      },
    }),
    prisma.schedulingReminderSchedule.count({
      where: {
        status: PrismaSchedulingReminderStatus.SCHEDULED,
        scheduledForUtc: { lte: nowUtc },
      },
    }),
    prisma.domainOutboxEvent.count({
      where: {
        topic: { startsWith: 'scheduling.' },
        status: DomainOutboxStatus.PROCESSING,
        leaseExpiresAt: { lte: nowUtc },
      },
    }),
    prisma.schedulingReminderSchedule.count({
      where: {
        status: PrismaSchedulingReminderStatus.PROCESSING,
        leaseExpiresAt: { lte: nowUtc },
      },
    }),
    prisma.schedulingNotificationDelivery.count({
      where: {
        status: PrismaSchedulingNotificationDeliveryStatus.PROCESSING,
        leaseExpiresAt: { lte: nowUtc },
      },
    }),
    prisma.domainOutboxEvent.findFirst({
      where: {
        topic: { startsWith: 'scheduling.' },
        status: DomainOutboxStatus.PROCESSED,
        processedAt: { not: null },
      },
      orderBy: { processedAt: 'desc' },
      select: { processedAt: true },
    }),
    prisma.schedulingReminderSchedule.findFirst({
      where: {
        status: PrismaSchedulingReminderStatus.SENT,
        sentAt: { not: null },
      },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    }),
    prisma.schedulingNotificationDelivery.findFirst({
      where: {
        status: PrismaSchedulingNotificationDeliveryStatus.SENT,
        sentAt: { not: null },
      },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    }),
  ])
  const recoveredLeases =
    expiredOutboxLeases + expiredReminderLeases + expiredDeliveryLeases
  const lastSuccessfulExecution =
    [
      lastOutboxSuccess?.processedAt,
      lastReminderSuccess?.sentAt,
      lastDeliverySuccess?.sentAt,
    ]
      .filter((date): date is Date => Boolean(date))
      .sort((first, second) => second.getTime() - first.getTime())[0] ?? null

  return {
    outboxPending,
    outboxProcessing,
    outboxFailed,
    notificationsPending: deliveriesPending,
    deliveriesPending,
    deliveriesFailed,
    reminderBacklog,
    expiredLeases: {
      outbox: expiredOutboxLeases,
      reminders: expiredReminderLeases,
      deliveries: expiredDeliveryLeases,
      total: recoveredLeases,
    },
    recoveredLeases,
    averageProcessingTimeMs: null,
    workerVersion: 'scheduling-notifications-phase-2.5',
    lastSuccessfulExecution: lastSuccessfulExecution?.toISOString() ?? null,
  }
}
