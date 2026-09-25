import { describe, expect, it } from 'vitest'

import type { JobClientRecord } from '@/lib/jobs/clientTypes'
import { filterJobs, matchesJobSavedView } from '@/lib/jobs/presentation'

function job(
  overrides: Partial<JobClientRecord> & Pick<JobClientRecord, 'id' | 'title'>,
): JobClientRecord {
  const { id, title, ...rest } = overrides
  return {
    id,
    workspaceId: 'ws-a',
    title,
    description: null,
    notes: null,
    status: 'OPEN',
    priority: 'NORMAL',
    customerReferenceId: null,
    customerId: null,
    customerDisplayName: null,
    valueCents: null,
    currency: 'USD',
    scheduledStartAt: null,
    scheduledEndAt: null,
    completedAt: null,
    assigneeMemberId: null,
    createdByUserId: 'user-a',
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    archivedAt: null,
    ...rest,
  }
}

describe('durable Jobs presentation filters', () => {
  const now = new Date('2026-09-22T16:00:00.000Z')

  it('maps saved views to durable fields without fabricated semantics', () => {
    expect(
      matchesJobSavedView(
        job({ id: 'urgent', title: 'Urgent', priority: 'URGENT' }),
        'urgent',
        now,
      ),
    ).toBe(true)
    expect(
      matchesJobSavedView(
        job({
          id: 'today',
          title: 'Today',
          status: 'SCHEDULED',
          scheduledStartAt: '2026-09-22T18:00:00.000Z',
        }),
        'scheduled-today',
        now,
      ),
    ).toBe(true)
    expect(
      matchesJobSavedView(
        job({ id: 'waiting', title: 'Waiting', status: 'WAITING_ON_CLIENT' }),
        'waiting',
        now,
      ),
    ).toBe(true)
  })

  it('excludes archived Jobs and searches durable customer context', () => {
    const jobs = [
      job({
        id: 'visible',
        title: 'Spring cleanup',
        customerDisplayName: 'Rivera Family',
      }),
      job({
        id: 'archived',
        title: 'Archived cleanup',
        archivedAt: '2026-09-22T10:00:00.000Z',
      }),
    ]

    expect(
      filterJobs(jobs, 'all', 'Rivera', now).map((item) => item.id),
    ).toEqual(['visible'])
    expect(
      filterJobs(jobs, 'all', '', now).map((item) => item.id),
    ).not.toContain('archived')
  })

  it('uses browser-local day boundaries and excludes terminal Jobs from open views', () => {
    const localNow = new Date(2026, 8, 22, 12, 0, 0)
    const localIso = (day: number, hour: number, minute = 0) =>
      new Date(2026, 8, day, hour, minute).toISOString()

    expect(
      matchesJobSavedView(
        job({
          id: 'midnight',
          title: 'Midnight',
          status: 'SCHEDULED',
          scheduledStartAt: localIso(22, 0),
        }),
        'scheduled-today',
        localNow,
      ),
    ).toBe(true)
    expect(
      matchesJobSavedView(
        job({
          id: 'end-of-day',
          title: 'End of day',
          status: 'SCHEDULED',
          scheduledStartAt: localIso(22, 23, 59),
        }),
        'scheduled-today',
        localNow,
      ),
    ).toBe(true)
    expect(
      matchesJobSavedView(
        job({
          id: 'tomorrow',
          title: 'Tomorrow',
          status: 'SCHEDULED',
          scheduledStartAt: localIso(23, 0),
        }),
        'scheduled-today',
        localNow,
      ),
    ).toBe(false)
    expect(
      matchesJobSavedView(
        job({ id: 'completed', title: 'Completed', status: 'COMPLETED' }),
        'open',
        localNow,
      ),
    ).toBe(false)
    expect(
      matchesJobSavedView(
        job({ id: 'canceled', title: 'Canceled', status: 'CANCELED' }),
        'open',
        localNow,
      ),
    ).toBe(false)
  })
})
