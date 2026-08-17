import { type NextRequest } from 'next/server'

import {
  checkExternalAvailabilityConflicts,
  type ExternalAvailabilityConflictResult,
} from '@/lib/scheduling/externalAvailability'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : []
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toPreviewSignal(
  conflict: ExternalAvailabilityConflictResult['conflicts'][number],
) {
  return {
    signalId: conflict.id,
    startsAtUtc: conflict.startsAtUtc,
    endsAtUtc: conflict.endsAtUtc,
    provider: String(conflict.provider).toLowerCase(),
    effect: conflict.effect,
    displayLabel: conflict.displayLabel,
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const startsAtUtc = stringValue(body.startsAtUtc)
    const endsAtUtc = stringValue(body.endsAtUtc)
    const previewRangeEndUtc = stringValue(body.previewRangeEndUtc)
    const requestedIds = [
      ...stringArray(body.workspaceMemberIds),
      ...stringArray(body.teamIds),
    ]
    const memberIds = actor.canManageScheduling
      ? requestedIds
      : requestedIds.filter((id) => id === actor.workspaceMemberId)

    if (!startsAtUtc || !endsAtUtc) {
      return Response.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Start and end times are required.',
        },
        { status: 400 },
      )
    }

    const rangeEndUtc = previewRangeEndUtc || endsAtUtc
    const results = await checkExternalAvailabilityConflicts({
      workspaceId: params.workspaceId,
      workspaceMemberIds: memberIds,
      startsAtUtc,
      endsAtUtc: rangeEndUtc,
      schedulingEventId: stringValue(body.schedulingEventId) || null,
    })

    const members = results.map((result) => ({
      workspaceMemberId: result.workspaceMemberId,
      memberName: result.memberName ?? 'Workspace member',
      highestSeverity: result.highestSeverity,
      conflictCount: result.conflictCount,
      blockingCount: result.blockingCount,
      suggestionCount: result.suggestionCount,
      totalUnavailableMinutes: result.totalUnavailableMinutes,
      conflicts: result.conflicts.map(toPreviewSignal),
    }))

    const recurrenceSummary =
      previewRangeEndUtc && previewRangeEndUtc !== endsAtUtc
        ? {
            checkedOccurrenceCount: Math.max(
              1,
              members.reduce(
                (count, member) => count + member.conflictCount,
                0,
              ),
            ),
            affectedOccurrenceCount: members.filter(
              (member) => member.conflictCount > 0,
            ).length,
            previewRangeStartUtc: startsAtUtc,
            previewRangeEndUtc,
          }
        : undefined

    return schedulingApiSuccess({
      result: {
        members,
        recurrenceSummary,
      },
    })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}
