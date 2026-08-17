import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'

import type {
  SchedulingOccurrenceState,
  SchedulingRecurrenceActionScope,
  SchedulingRecurrenceMutationKind,
  SchedulingRecurrenceRule,
} from '@/lib/scheduling/types'

export type RecurrenceLockKey = {
  workspaceId: string
  seriesId: string
  first: number
  second: number
  sortKey: string
}

export type RecurrenceMutationDescriptor = {
  workspaceId: string
  seriesId?: string
  occurrenceId?: string
  mutationKind: SchedulingRecurrenceMutationKind
  actorId?: string
  scope?: SchedulingRecurrenceActionScope
  idempotencyKey?: string
  expectedVersion?: number
}

export type RecurrenceOverrideRemapCandidate = {
  occurrenceId: string
  originalStartUtc: Date
  originalLocalDateKey: string
  originalLocalTime?: string
  currentStartUtc: Date
  currentEndUtc: Date
  state: SchedulingOccurrenceState
  overrideFields?: string[]
  overridePayload?: Record<string, unknown>
}

export type RecurrenceOverrideRemapTarget = {
  occurrenceId: string
  originalStartUtc: Date
  originalLocalDateKey: string
  originalLocalTime?: string
  ordinal: number
}

export type RecurrenceOverrideRemapDecision =
  | {
      action: 'remap'
      strategy: 'exactOriginalIdentity' | 'ordinal' | 'semanticLocalDate'
      candidateOccurrenceId: string
      targetOccurrenceId: string
      reason: string
    }
  | {
      action: 'detach'
      strategy: 'detached'
      candidateOccurrenceId: string
      reason: string
    }

const transientPrismaCodes = new Set(['P2002', 'P2034'])
const transientPostgresCodes = new Set(['40001', '40P01', '55P03'])

function toSignedInt32(buffer: Buffer, offset: number) {
  return buffer.readInt32BE(offset)
}

export function deriveRecurrenceSeriesLockKey({
  workspaceId,
  seriesId,
}: {
  workspaceId: string
  seriesId: string
}): RecurrenceLockKey {
  const digest = createHash('sha256')
    .update(`skillify:scheduling:recurrence:${workspaceId}:${seriesId}`)
    .digest()
  const first = toSignedInt32(digest, 0)
  const second = toSignedInt32(digest, 4)
  return {
    workspaceId,
    seriesId,
    first,
    second,
    sortKey: `${first.toString().padStart(12, '0')}:${second
      .toString()
      .padStart(12, '0')}`,
  }
}

export function sortRecurrenceSeriesLockKeys(keys: RecurrenceLockKey[]) {
  return [...keys].sort((first, second) =>
    first.sortKey.localeCompare(second.sortKey),
  )
}

export function createRecurrenceAdvisoryLockSql(key: {
  first: number
  second: number
}) {
  return Prisma.sql`SELECT pg_advisory_xact_lock(${key.first}, ${key.second})::text AS lock_result`
}

function normalizeCanonicalValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalizeCanonicalValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(
          ([key]) =>
            key !== 'requestTimestamp' &&
            key !== 'timestamp' &&
            key !== 'createdAt' &&
            key !== 'updatedAt',
        )
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, entry]) => [key, normalizeCanonicalValue(entry)]),
    )
  }
  return value
}

export function canonicalizeRecurrenceMutationRequest(value: unknown) {
  return JSON.stringify(normalizeCanonicalValue(value))
}

export function hashRecurrenceMutationRequest(value: unknown) {
  return createHash('sha256')
    .update(canonicalizeRecurrenceMutationRequest(value))
    .digest('hex')
}

export function isRetryableRecurrenceMutationError(error: unknown) {
  const candidate = error as {
    code?: unknown
    meta?: { code?: unknown }
    cause?: { code?: unknown }
  }
  const code =
    typeof candidate.code === 'string'
      ? candidate.code
      : typeof candidate.meta?.code === 'string'
        ? candidate.meta.code
        : typeof candidate.cause?.code === 'string'
          ? candidate.cause.code
          : undefined
  return Boolean(
    code &&
    (transientPrismaCodes.has(code) || transientPostgresCodes.has(code)),
  )
}

function rulesHaveCompatibleOrdinalMapping({
  oldRule,
  newRule,
}: {
  oldRule?: SchedulingRecurrenceRule | null
  newRule?: SchedulingRecurrenceRule | null
}) {
  if (!oldRule || !newRule) return false
  if (oldRule.frequency === newRule.frequency) return true
  if (oldRule.frequency === 'weekly' && newRule.frequency === 'weekly')
    return true
  return false
}

export function decideRecurrenceOverrideRemap({
  candidate,
  targets,
  ordinal,
  oldRule,
  newRule,
}: {
  candidate: RecurrenceOverrideRemapCandidate
  targets: RecurrenceOverrideRemapTarget[]
  ordinal: number
  oldRule?: SchedulingRecurrenceRule | null
  newRule?: SchedulingRecurrenceRule | null
}): RecurrenceOverrideRemapDecision {
  const exact = targets.filter(
    (target) =>
      target.originalLocalDateKey === candidate.originalLocalDateKey &&
      (!candidate.originalLocalTime ||
        target.originalLocalTime === candidate.originalLocalTime),
  )
  if (exact.length === 1) {
    return {
      action: 'remap',
      strategy: 'exactOriginalIdentity',
      candidateOccurrenceId: candidate.occurrenceId,
      targetOccurrenceId: exact[0].occurrenceId,
      reason: 'Matched the same original local recurrence identity.',
    }
  }

  if (rulesHaveCompatibleOrdinalMapping({ oldRule, newRule })) {
    const ordinalTarget = targets.find((target) => target.ordinal === ordinal)
    if (ordinalTarget) {
      return {
        action: 'remap',
        strategy: 'ordinal',
        candidateOccurrenceId: candidate.occurrenceId,
        targetOccurrenceId: ordinalTarget.occurrenceId,
        reason: 'Matched by recurrence ordinal after the split boundary.',
      }
    }
  }

  const semantic = targets.filter(
    (target) => target.originalLocalDateKey === candidate.originalLocalDateKey,
  )
  if (semantic.length === 1) {
    return {
      action: 'remap',
      strategy: 'semanticLocalDate',
      candidateOccurrenceId: candidate.occurrenceId,
      targetOccurrenceId: semantic[0].occurrenceId,
      reason: 'Matched a unique local recurrence date.',
    }
  }

  return {
    action: 'detach',
    strategy: 'detached',
    candidateOccurrenceId: candidate.occurrenceId,
    reason:
      semantic.length > 1
        ? 'Multiple new occurrences could match this override.'
        : 'No deterministic new occurrence matched this override.',
  }
}

export function validateRecurrenceIdempotencyKey(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new Error('Idempotency key must be a string.')
  }
  const trimmed = value.trim()
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(trimmed)) {
    throw new Error('Use a valid idempotency key.')
  }
  return trimmed
}
