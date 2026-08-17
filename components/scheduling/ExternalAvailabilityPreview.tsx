'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import { formatInWorkspaceTimezone } from '@/lib/scheduling/schedulingDateTime'
import type {
  SchedulingRecurrenceActionScope,
  SchedulingRecurrenceRule,
} from '@/lib/scheduling/types'

export type ExternalAvailabilityPreviewRequest = {
  workspaceId: string
  workspaceMemberIds: string[]
  teamIds?: string[]
  startsAtUtc: string
  endsAtUtc: string
  timezone: string
  schedulingEventId?: string
  occurrenceId?: string
  recurrenceScope?: SchedulingRecurrenceActionScope
  recurrenceRule?: SchedulingRecurrenceRule
  previewRangeEndUtc?: string
}

export type ExternalAvailabilityPreviewSignal = {
  signalId: string
  startsAtUtc: string
  endsAtUtc: string
  provider: string
  effect: 'suggestion' | 'blocking'
  displayLabel: 'Unavailable'
}

export type ExternalAvailabilityPreviewMember = {
  workspaceMemberId: string
  memberName: string
  highestSeverity: 'none' | 'suggestion' | 'blocking'
  conflictCount: number
  blockingCount: number
  suggestionCount: number
  totalUnavailableMinutes: number
  conflicts: ExternalAvailabilityPreviewSignal[]
}

export type ExternalAvailabilityPreviewResult = {
  members: ExternalAvailabilityPreviewMember[]
  recurrenceSummary?: {
    checkedOccurrenceCount: number
    affectedOccurrenceCount: number
    previewRangeStartUtc: string
    previewRangeEndUtc: string
  }
}

const previewCache = new Map<string, ExternalAvailabilityPreviewResult>()

function normalizePreviewRequest(
  input: ExternalAvailabilityPreviewRequest | null,
) {
  if (!input) return null
  const memberIds = [...new Set(input.workspaceMemberIds.filter(Boolean))]
  const teamIds = [...new Set((input.teamIds ?? []).filter(Boolean))]
  if (
    !input.workspaceId ||
    !memberIds.length ||
    !input.startsAtUtc ||
    !input.endsAtUtc ||
    !input.timezone
  ) {
    return null
  }
  return {
    ...input,
    workspaceMemberIds: memberIds,
    teamIds,
  }
}

export function getExternalAvailabilityPreviewSignalIds(
  result: ExternalAvailabilityPreviewResult | null,
) {
  return (
    result?.members.flatMap((member) =>
      member.conflicts.map((conflict) => conflict.signalId),
    ) ?? []
  ).filter(Boolean)
}

export function useExternalAvailabilityPreview({
  request,
  enabled = true,
  debounceMs = 300,
}: {
  request: ExternalAvailabilityPreviewRequest | null
  enabled?: boolean
  debounceMs?: number
}) {
  const rawRequestKey = JSON.stringify(request ?? null)
  const normalizedRequest = useMemo(
    () => normalizePreviewRequest(request),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawRequestKey],
  )
  const requestKey = useMemo(
    () => (normalizedRequest ? JSON.stringify(normalizedRequest) : ''),
    [normalizedRequest],
  )
  const [data, setData] = useState<ExternalAvailabilityPreviewResult | null>(
    () => (requestKey ? (previewCache.get(requestKey) ?? null) : null),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const latestRequestKeyRef = useRef(requestKey)

  const refresh = useCallback(() => {
    if (requestKey) previewCache.delete(requestKey)
    setRefreshNonce((value) => value + 1)
  }, [requestKey])

  useEffect(() => {
    latestRequestKeyRef.current = requestKey
    if (!enabled || !normalizedRequest || !requestKey) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    const cached = previewCache.get(requestKey)
    if (cached && refreshNonce === 0) {
      setData(cached)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const timeout = window.setTimeout(() => {
      fetch(
        `/api/workspaces/${normalizedRequest.workspaceId}/scheduling/external-availability/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizedRequest),
          signal: controller.signal,
        },
      )
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as {
            ok?: boolean
            result?: ExternalAvailabilityPreviewResult
            message?: string
          } | null
          if (!response.ok || !body?.ok || !body.result) {
            throw new Error(
              body?.message ??
                'External availability could not be fully verified.',
            )
          }
          return body.result
        })
        .then((result) => {
          if (latestRequestKeyRef.current !== requestKey) return
          previewCache.set(requestKey, result)
          setData(result)
        })
        .catch((caught) => {
          if ((caught as Error).name === 'AbortError') return
          if (latestRequestKeyRef.current !== requestKey) return
          setData(null)
          setError(
            caught instanceof Error
              ? caught.message
              : 'External availability could not be fully verified.',
          )
        })
        .finally(() => {
          if (latestRequestKeyRef.current === requestKey) setLoading(false)
        })
    }, debounceMs)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [debounceMs, enabled, normalizedRequest, refreshNonce, requestKey])

  const membersWithConflicts =
    data?.members.filter((member) => member.conflictCount > 0) ?? []
  const hasBlockingConflict = membersWithConflicts.some(
    (member) => member.highestSeverity === 'blocking',
  )
  const hasSuggestionConflict = membersWithConflicts.some(
    (member) => member.highestSeverity === 'suggestion',
  )

  return {
    loading,
    data,
    error,
    refresh,
    hasBlockingConflict,
    hasSuggestionConflict,
    signalIds: getExternalAvailabilityPreviewSignalIds(data),
  }
}

function formatUnavailableMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}

function providerLabel(value: string) {
  if (value.toLowerCase() === 'google') return 'Google'
  if (value.toLowerCase() === 'microsoft') return 'Microsoft'
  return value
}

export function ExternalAvailabilityConflictSummary({
  result,
  loading,
  error,
  timezone,
  variant = 'form',
  showNoConflict = false,
  overrideReason,
  onOverrideReasonChange,
}: {
  result: ExternalAvailabilityPreviewResult | null
  loading?: boolean
  error?: string | null
  timezone: string
  variant?: 'compact' | 'form' | 'drawer' | 'memberDetail' | 'recurrenceSummary'
  showNoConflict?: boolean
  overrideReason?: string
  onOverrideReasonChange?: (value: string) => void
}) {
  const members =
    result?.members.filter((member) => member.conflictCount > 0) ?? []
  const hasBlocking = members.some(
    (member) => member.highestSeverity === 'blocking',
  )
  const conflictCount = members.reduce(
    (total, member) => total + member.conflictCount,
    0,
  )
  const unavailableMinutes = members.reduce(
    (total, member) => total + member.totalUnavailableMinutes,
    0,
  )

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-2 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/45 p-3 text-xs text-neutral-300"
      >
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-200" />
        Checking external availability...
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3 text-xs text-amber-100">
        <p className="font-semibold">
          External availability could not be fully verified.
        </p>
        <p className="mt-1 text-amber-100/75">{error}</p>
      </div>
    )
  }

  if (!members.length) {
    return showNoConflict ? (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-3 text-xs text-emerald-100">
        <Check className="h-3.5 w-3.5" />
        No external availability conflicts found.
      </div>
    ) : null
  }

  const heading = hasBlocking
    ? 'Personal calendar availability block'
    : 'External availability conflict'
  const tone = hasBlocking
    ? 'border-rose-300/30 bg-rose-300/[0.07] text-rose-100'
    : 'border-amber-300/25 bg-amber-300/[0.06] text-amber-100'

  return (
    <section
      aria-labelledby="external-availability-summary-title"
      className={cn(
        'mt-2 space-y-3 rounded-xl border p-3',
        tone,
        variant === 'compact' && 'p-2',
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <h3
            id="external-availability-summary-title"
            className="text-xs font-semibold"
          >
            {members.length > 1
              ? `${members.length} members have external availability conflicts`
              : heading}
          </h3>
          <p className="mt-1 text-xs text-neutral-200">
            {conflictCount} privacy-safe availability{' '}
            {conflictCount === 1 ? 'signal' : 'signals'} ·{' '}
            {formatUnavailableMinutes(unavailableMinutes)} unavailable.
          </p>
          {result?.recurrenceSummary ? (
            <p className="mt-1 text-xs text-neutral-300">
              Recurrence preview checks a bounded range through{' '}
              {formatInWorkspaceTimezone(
                result.recurrenceSummary.previewRangeEndUtc,
                timezone,
                { month: 'short', day: 'numeric', year: 'numeric' },
              )}
              .
            </p>
          ) : null}
          <p className="mt-1 text-xs text-neutral-300">
            These signals come from approved connected personal calendars. They
            are not approved Time Off records.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {members.map((member) => (
          <details
            key={member.workspaceMemberId}
            className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-neutral-100"
            open={members.length === 1}
          >
            <summary className="cursor-pointer font-medium">
              {member.memberName} · {member.conflictCount}{' '}
              {member.conflictCount === 1 ? 'block' : 'blocks'}
              {member.blockingCount
                ? ` · ${member.blockingCount} blocking`
                : ''}
            </summary>
            <div className="mt-2 space-y-1">
              {member.conflicts.slice(0, 5).map((conflict) => (
                <p
                  key={conflict.signalId}
                  className="text-neutral-text-secondary"
                >
                  Unavailable ·{' '}
                  {formatInWorkspaceTimezone(conflict.startsAtUtc, timezone, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {'-'}
                  {formatInWorkspaceTimezone(conflict.endsAtUtc, timezone, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {providerLabel(conflict.provider)}
                  {' · '}
                  {conflict.effect === 'blocking' ? 'Blocking' : 'Suggestion'}
                </p>
              ))}
              {member.conflicts.length > 5 ? (
                <p className="text-neutral-text-secondary">
                  + {member.conflicts.length - 5} more privacy-safe blocks
                </p>
              ) : null}
            </div>
          </details>
        ))}
      </div>
      {hasBlocking && onOverrideReasonChange ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-rose-100">
            Override reason
          </span>
          <Textarea
            value={overrideReason ?? ''}
            onChange={(event) => onOverrideReasonChange(event.target.value)}
            placeholder="Explain why this assignment should override the personal-calendar block."
            aria-describedby="external-availability-override-help"
          />
          <span
            id="external-availability-override-help"
            className="block text-[11px] text-rose-100/75"
          >
            Blocking personal-calendar conflicts require permission and a reason
            before saving.
          </span>
        </label>
      ) : hasBlocking ? (
        <p className="text-xs text-rose-100">
          Choose another time or member, or use an authorized override before
          saving.
        </p>
      ) : (
        <p className="text-xs text-amber-100">
          You can continue anyway or choose another time or member.
        </p>
      )}
    </section>
  )
}
