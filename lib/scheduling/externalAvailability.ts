import {
  CalendarConnectionApprovalStatus,
  CalendarConnectionPurpose,
  CalendarEventOwnership,
  CalendarEventSyncState,
  PersonalCalendarAvailabilityBehavior,
  type CalendarProvider,
} from '@prisma/client'

import { prisma } from '@/lib/db'

export type ExternalAvailabilityEffect = 'suggestion' | 'blocking'
export type ExternalAvailabilitySeverity = 'none' | ExternalAvailabilityEffect

export type ExternalAvailabilitySignal = {
  id: string
  workspaceId: string
  workspaceMemberId: string
  connectionId: string
  calendarId?: string
  provider: CalendarProvider | string
  startsAtUtc: string
  endsAtUtc: string
  timezone: string
  effect: ExternalAvailabilityEffect
  sourcePurpose: 'PERSONAL'
  displayLabel: 'Unavailable'
  approvalStatus: string
}

export type ExternalAvailabilityConflictResult = {
  workspaceMemberId: string
  memberName?: string
  conflicts: ExternalAvailabilitySignal[]
  highestSeverity: ExternalAvailabilitySeverity
  conflictCount: number
  blockingCount: number
  suggestionCount: number
  totalUnavailableMinutes: number
}

function getExternalAvailabilityTotals(
  conflicts: ExternalAvailabilitySignal[],
) {
  return conflicts.reduce(
    (totals, conflict) => {
      const minutes = Math.max(
        0,
        Math.round(
          (new Date(conflict.endsAtUtc).getTime() -
            new Date(conflict.startsAtUtc).getTime()) /
            60_000,
        ),
      )
      totals.totalUnavailableMinutes += minutes
      totals.conflictCount += 1
      if (conflict.effect === 'blocking') {
        totals.blockingCount += 1
      } else {
        totals.suggestionCount += 1
      }
      return totals
    },
    {
      conflictCount: 0,
      blockingCount: 0,
      suggestionCount: 0,
      totalUnavailableMinutes: 0,
    },
  )
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function signalFromProviderSnapshot({
  mapping,
  workspaceMemberId,
  connectionId,
  provider,
}: {
  mapping: {
    id: string
    workspaceId: string
    connectedCalendarId: string
    providerSnapshot: unknown
    connectedCalendar: {
      availabilityBehavior: PersonalCalendarAvailabilityBehavior
    }
  }
  workspaceMemberId: string
  connectionId: string
  provider: CalendarProvider
}): ExternalAvailabilitySignal | null {
  const snapshot = record(mapping.providerSnapshot)
  if (snapshot.kind !== 'externalAvailability') return null
  const startsAtUtc = String(snapshot.startsAtUtc ?? '')
  const endsAtUtc = String(snapshot.endsAtUtc ?? '')
  if (!startsAtUtc || !endsAtUtc) return null
  const effect =
    snapshot.effect === 'blocking' ||
    mapping.connectedCalendar.availabilityBehavior ===
      PersonalCalendarAvailabilityBehavior.BLOCK_AVAILABILITY
      ? 'blocking'
      : 'suggestion'
  return {
    id: mapping.id,
    workspaceId: mapping.workspaceId,
    workspaceMemberId,
    connectionId,
    calendarId: mapping.connectedCalendarId,
    provider,
    startsAtUtc,
    endsAtUtc,
    timezone: String(snapshot.timezone ?? 'UTC'),
    effect,
    sourcePurpose: 'PERSONAL',
    displayLabel: 'Unavailable',
    approvalStatus: CalendarConnectionApprovalStatus.APPROVED,
  }
}

function overlaps({
  startsAtUtc,
  endsAtUtc,
  rangeStart,
  rangeEnd,
}: {
  startsAtUtc: string
  endsAtUtc: string
  rangeStart: Date
  rangeEnd: Date
}) {
  const start = new Date(startsAtUtc).getTime()
  const end = new Date(endsAtUtc).getTime()
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    end > rangeStart.getTime() &&
    start < rangeEnd.getTime()
  )
}

async function expandAssignmentIds({
  workspaceId,
  ids,
}: {
  workspaceId: string
  ids: string[]
}) {
  const directMemberIds = ids.filter((id) => !id.startsWith('team-'))
  const teamIds = ids.filter((id) => id.startsWith('team-'))
  if (!teamIds.length) return [...new Set(directMemberIds)]
  const teamMembers = await prisma.workspaceTeamMember.findMany({
    where: {
      workspaceId,
      teamId: { in: teamIds },
      team: { isActive: true, archivedAt: null },
    },
    select: { workspaceMemberId: true },
  })
  return [
    ...new Set([
      ...directMemberIds,
      ...teamMembers.map((member) => member.workspaceMemberId),
    ]),
  ]
}

export async function checkExternalAvailabilityConflicts({
  workspaceId,
  workspaceMemberIds,
  startsAtUtc,
  endsAtUtc,
  schedulingEventId,
}: {
  workspaceId: string
  workspaceMemberIds: string[]
  startsAtUtc: string
  endsAtUtc: string
  schedulingEventId?: string | null
}): Promise<ExternalAvailabilityConflictResult[]> {
  const rangeStart = new Date(startsAtUtc)
  const rangeEnd = new Date(endsAtUtc)
  if (
    !workspaceMemberIds.length ||
    !Number.isFinite(rangeStart.getTime()) ||
    !Number.isFinite(rangeEnd.getTime()) ||
    rangeEnd <= rangeStart
  ) {
    return []
  }
  const expandedMemberIds = await expandAssignmentIds({
    workspaceId,
    ids: workspaceMemberIds,
  })
  if (!expandedMemberIds.length) return []

  const activeMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      id: { in: expandedMemberIds },
    },
    select: { id: true, user: { select: { fullName: true } } },
  })
  const activeMemberIds = activeMembers.map((member) => member.id)
  const memberNameById = new Map(
    activeMembers.map((member) => [
      member.id,
      member.user.fullName ?? 'Workspace member',
    ]),
  )
  if (!activeMemberIds.length) return []

  const mappings = await prisma.calendarEventMapping.findMany({
    where: {
      workspaceId,
      schedulingEventId: null,
      syncState: CalendarEventSyncState.SYNCED,
      ownership: CalendarEventOwnership.EXTERNAL_ONLY,
      deletedAtProvider: false,
      deletedAtSkillify: false,
      ...(schedulingEventId ? { id: { not: schedulingEventId } } : {}),
      connectedCalendar: {
        calendarPurpose: CalendarConnectionPurpose.PERSONAL,
        selectedForSync: true,
        availabilityEnabled: true,
        availabilityBehavior: {
          in: [
            PersonalCalendarAvailabilityBehavior.SUGGEST_CONFLICTS,
            PersonalCalendarAvailabilityBehavior.BLOCK_AVAILABILITY,
          ],
        },
        connection: {
          workspaceMemberId: { in: activeMemberIds },
          connectionPurpose: CalendarConnectionPurpose.PERSONAL,
          approvalStatus: CalendarConnectionApprovalStatus.APPROVED,
          disabledAt: null,
          disconnectedAt: null,
        },
      },
    },
    include: {
      connectedCalendar: {
        select: {
          availabilityBehavior: true,
          connection: {
            select: {
              id: true,
              provider: true,
              workspaceMemberId: true,
              approvalStatus: true,
            },
          },
        },
      },
    },
  })

  const byMember = new Map<string, ExternalAvailabilitySignal[]>()
  const seen = new Set<string>()
  for (const mapping of mappings) {
    const memberId = mapping.connectedCalendar.connection.workspaceMemberId
    if (!memberId) continue
    const signal = signalFromProviderSnapshot({
      mapping,
      workspaceMemberId: memberId,
      connectionId: mapping.connectedCalendar.connection.id,
      provider: mapping.connectedCalendar.connection.provider,
    })
    if (!signal) continue
    if (
      !overlaps({
        startsAtUtc: signal.startsAtUtc,
        endsAtUtc: signal.endsAtUtc,
        rangeStart,
        rangeEnd,
      })
    ) {
      continue
    }
    const key = [
      signal.workspaceMemberId,
      signal.startsAtUtc,
      signal.endsAtUtc,
      signal.provider,
      signal.effect,
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    byMember.set(memberId, [...(byMember.get(memberId) ?? []), signal])
  }

  return activeMemberIds.map((memberId) => {
    const conflicts = (byMember.get(memberId) ?? []).sort(
      (first, second) =>
        new Date(first.startsAtUtc).getTime() -
        new Date(second.startsAtUtc).getTime(),
    )
    const highestSeverity = conflicts.some(
      (conflict) => conflict.effect === 'blocking',
    )
      ? 'blocking'
      : conflicts.length
        ? 'suggestion'
        : 'none'
    return {
      workspaceMemberId: memberId,
      memberName: memberNameById.get(memberId),
      conflicts,
      highestSeverity,
      ...getExternalAvailabilityTotals(conflicts),
    }
  })
}

export async function summarizeExternalAvailability({
  workspaceId,
  workspaceMemberIds,
  rangeStartUtc,
  rangeEndUtc,
}: {
  workspaceId: string
  workspaceMemberIds: string[]
  rangeStartUtc: string
  rangeEndUtc: string
}) {
  const results = await checkExternalAvailabilityConflicts({
    workspaceId,
    workspaceMemberIds,
    startsAtUtc: rangeStartUtc,
    endsAtUtc: rangeEndUtc,
  })
  return results.map((result) => {
    return {
      workspaceMemberId: result.workspaceMemberId,
      rangeStartUtc,
      rangeEndUtc,
      totalUnavailableMinutes: result.totalUnavailableMinutes,
      blockCount: result.conflictCount,
      blockingCount: result.blockingCount,
      suggestionCount: result.suggestionCount,
    }
  })
}
