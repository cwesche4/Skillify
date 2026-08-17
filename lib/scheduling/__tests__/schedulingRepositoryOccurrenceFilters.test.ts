import { SchedulingOccurrenceState as PrismaSchedulingOccurrenceState } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
  getListEventsByRangeWhere,
  getListEventsByRangeOccurrenceStateWhere,
  isListEventsByRangeVisibleOccurrenceState,
} from '@/lib/scheduling/occurrenceStateFilters'

describe('scheduling repository occurrence filters', () => {
  it('includes standalone rows and generated occurrences in listEventsByRange', () => {
    expect(isListEventsByRangeVisibleOccurrenceState(null)).toBe(true)
    expect(isListEventsByRangeVisibleOccurrenceState(undefined)).toBe(true)
    expect(
      isListEventsByRangeVisibleOccurrenceState(
        PrismaSchedulingOccurrenceState.GENERATED,
      ),
    ).toBe(true)
  })

  it('excludes recurrence masters and inactive occurrence rows from listEventsByRange', () => {
    expect(
      isListEventsByRangeVisibleOccurrenceState(
        PrismaSchedulingOccurrenceState.MASTER,
      ),
    ).toBe(false)
    expect(
      isListEventsByRangeVisibleOccurrenceState(
        PrismaSchedulingOccurrenceState.SUPERSEDED,
      ),
    ).toBe(false)
    expect(
      isListEventsByRangeVisibleOccurrenceState(
        PrismaSchedulingOccurrenceState.CANCELED,
      ),
    ).toBe(false)
    expect(
      isListEventsByRangeVisibleOccurrenceState(
        PrismaSchedulingOccurrenceState.DELETED,
      ),
    ).toBe(false)
  })

  it('builds the Prisma predicate used by listEventsByRange', () => {
    expect(getListEventsByRangeOccurrenceStateWhere()).toEqual({
      OR: [
        { occurrenceState: null },
        { occurrenceState: PrismaSchedulingOccurrenceState.GENERATED },
      ],
    })
  })

  it('keeps listEventsByRange scoped to one workspace and overlapping date range', () => {
    const startsBefore = new Date('2026-08-06T04:00:00.000Z')
    const endsAfter = new Date('2026-08-05T04:00:00.000Z')

    expect(
      getListEventsByRangeWhere({
        workspaceId: 'workspace-alpha',
        startsBefore,
        endsAfter,
      }),
    ).toEqual({
      workspaceId: 'workspace-alpha',
      deletedAt: null,
      startsAtUtc: { lt: startsBefore },
      endsAtUtc: { gt: endsAfter },
      OR: [
        { occurrenceState: null },
        { occurrenceState: PrismaSchedulingOccurrenceState.GENERATED },
      ],
    })
  })
})
