import { describe, expect, it } from 'vitest'

import {
  canonicalizeRecurrenceMutationRequest,
  createRecurrenceAdvisoryLockSql,
  decideRecurrenceOverrideRemap,
  deriveRecurrenceSeriesLockKey,
  hashRecurrenceMutationRequest,
  isRetryableRecurrenceMutationError,
  sortRecurrenceSeriesLockKeys,
  validateRecurrenceIdempotencyKey,
  type RecurrenceOverrideRemapCandidate,
  type RecurrenceOverrideRemapTarget,
} from '@/lib/scheduling/recurrenceHardening'
import type { SchedulingRecurrenceRule } from '@/lib/scheduling/types'

const weeklyRule: SchedulingRecurrenceRule = {
  frequency: 'weekly',
  interval: 1,
  daysOfWeek: [1],
  endType: 'never',
}

const dailyRule: SchedulingRecurrenceRule = {
  frequency: 'daily',
  interval: 1,
  endType: 'never',
}

const monthlyRule: SchedulingRecurrenceRule = {
  frequency: 'monthly',
  interval: 1,
  endType: 'never',
}

const candidate: RecurrenceOverrideRemapCandidate = {
  occurrenceId: 'old_override_1',
  originalStartUtc: new Date('2026-08-03T14:00:00.000Z'),
  originalLocalDateKey: '2026-08-03',
  originalLocalTime: '10:00',
  currentStartUtc: new Date('2026-08-03T15:00:00.000Z'),
  currentEndUtc: new Date('2026-08-03T16:00:00.000Z'),
  state: 'overridden',
  overrideFields: ['startsAtUtc', 'endsAtUtc'],
}

function target(
  occurrenceId: string,
  originalLocalDateKey: string,
  ordinal: number,
  originalLocalTime = '10:00',
): RecurrenceOverrideRemapTarget {
  return {
    occurrenceId,
    originalStartUtc: new Date(`${originalLocalDateKey}T14:00:00.000Z`),
    originalLocalDateKey,
    originalLocalTime,
    ordinal,
  }
}

describe('recurrence hardening helpers', () => {
  it('derives deterministic advisory lock keys and sorts them consistently', () => {
    const first = deriveRecurrenceSeriesLockKey({
      workspaceId: 'workspace_1',
      seriesId: 'series_b',
    })
    const firstAgain = deriveRecurrenceSeriesLockKey({
      workspaceId: 'workspace_1',
      seriesId: 'series_b',
    })
    const second = deriveRecurrenceSeriesLockKey({
      workspaceId: 'workspace_1',
      seriesId: 'series_a',
    })

    expect(first).toEqual(firstAgain)
    expect(first.first).toEqual(expect.any(Number))
    expect(first.second).toEqual(expect.any(Number))
    expect(sortRecurrenceSeriesLockKeys([first, second])).toEqual(
      [first, second].sort((left, right) =>
        left.sortKey.localeCompare(right.sortKey),
      ),
    )
  })

  it('builds a scalar transaction-scoped advisory lock query for Prisma', () => {
    const key = deriveRecurrenceSeriesLockKey({
      workspaceId: 'workspace_1',
      seriesId: 'series_a',
    })
    const query = createRecurrenceAdvisoryLockSql(key) as unknown as {
      sql?: string
      values?: unknown[]
    }

    expect(query.sql).toContain('pg_advisory_xact_lock')
    expect(query.sql).toContain('::text AS lock_result')
    expect(query.values).toEqual([key.first, key.second])
  })

  it('canonicalizes mutation requests before hashing', () => {
    const first = {
      scope: 'thisAndFollowing',
      event: {
        title: 'Proposal Review',
        updatedAt: '2026-07-28T12:00:00.000Z',
        metadata: { b: 2, a: 1 },
      },
    }
    const reordered = {
      event: {
        metadata: { a: 1, b: 2 },
        title: 'Proposal Review',
        updatedAt: '2026-07-29T12:00:00.000Z',
      },
      scope: 'thisAndFollowing',
    }
    const different = {
      ...reordered,
      scope: 'entireSeries',
    }

    expect(canonicalizeRecurrenceMutationRequest(first)).toBe(
      canonicalizeRecurrenceMutationRequest(reordered),
    )
    expect(hashRecurrenceMutationRequest(first)).toBe(
      hashRecurrenceMutationRequest(reordered),
    )
    expect(hashRecurrenceMutationRequest(first)).not.toBe(
      hashRecurrenceMutationRequest(different),
    )
  })

  it('validates idempotency keys and rejects malformed keys', () => {
    expect(validateRecurrenceIdempotencyKey('  recur_12345678  ')).toBe(
      'recur_12345678',
    )
    expect(validateRecurrenceIdempotencyKey(undefined)).toBeUndefined()
    expect(() => validateRecurrenceIdempotencyKey('bad key')).toThrow(
      'Use a valid idempotency key.',
    )
    expect(() => validateRecurrenceIdempotencyKey(123)).toThrow(
      'Idempotency key must be a string.',
    )
  })

  it('classifies transient database failures as retryable', () => {
    expect(isRetryableRecurrenceMutationError({ code: 'P2034' })).toBe(true)
    expect(
      isRetryableRecurrenceMutationError({ meta: { code: '40001' } }),
    ).toBe(true)
    expect(
      isRetryableRecurrenceMutationError({ cause: { code: '40P01' } }),
    ).toBe(true)
    expect(isRetryableRecurrenceMutationError({ code: 'P2025' })).toBe(false)
  })

  it('remaps an override by exact original recurrence identity first', () => {
    const decision = decideRecurrenceOverrideRemap({
      candidate,
      targets: [
        target('new_generated_1', '2026-08-10', 0),
        target('new_generated_2', '2026-08-03', 1),
      ],
      ordinal: 0,
      oldRule: weeklyRule,
      newRule: weeklyRule,
    })

    expect(decision).toMatchObject({
      action: 'remap',
      strategy: 'exactOriginalIdentity',
      targetOccurrenceId: 'new_generated_2',
    })
  })

  it('remaps by ordinal when compatible recurrence rules shift dates', () => {
    const decision = decideRecurrenceOverrideRemap({
      candidate,
      targets: [
        target('new_generated_1', '2026-08-04', 0),
        target('new_generated_2', '2026-08-11', 1),
      ],
      ordinal: 1,
      oldRule: weeklyRule,
      newRule: weeklyRule,
    })

    expect(decision).toMatchObject({
      action: 'remap',
      strategy: 'ordinal',
      targetOccurrenceId: 'new_generated_2',
    })
  })

  it('remaps by unique semantic local date when ordinal mapping is unsafe', () => {
    const decision = decideRecurrenceOverrideRemap({
      candidate,
      targets: [
        target('new_generated_1', '2026-08-03', 0, '11:00'),
        target('new_generated_2', '2026-09-03', 1, '11:00'),
      ],
      ordinal: 1,
      oldRule: dailyRule,
      newRule: monthlyRule,
    })

    expect(decision).toMatchObject({
      action: 'remap',
      strategy: 'semanticLocalDate',
      targetOccurrenceId: 'new_generated_1',
    })
  })

  it('detaches an override only when no deterministic remap exists', () => {
    const decision = decideRecurrenceOverrideRemap({
      candidate,
      targets: [
        target('new_generated_1', '2026-08-03', 0, '11:00'),
        target('new_generated_2', '2026-08-03', 1, '12:00'),
      ],
      ordinal: 4,
      oldRule: dailyRule,
      newRule: monthlyRule,
    })

    expect(decision).toMatchObject({
      action: 'detach',
      strategy: 'detached',
      candidateOccurrenceId: 'old_override_1',
    })
  })
})
