import { describe, expect, it } from 'vitest'

import type { WorkItemClientRecord } from '@/lib/jobs/clientTypes'
import { filterTodos, matchesTodoSavedView } from '@/lib/jobs/todoPresentation'

function todo(
  overrides: Partial<WorkItemClientRecord> &
    Pick<WorkItemClientRecord, 'id' | 'title'>,
): WorkItemClientRecord {
  const { id, title, ...rest } = overrides
  return {
    id,
    workspaceId: 'ws-a',
    kind: 'TODO',
    jobId: null,
    title,
    description: null,
    notes: null,
    status: 'OPEN',
    priority: 'NORMAL',
    dueAt: null,
    completedAt: null,
    assigneeMemberId: null,
    createdByUserId: 'user-a',
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    archivedAt: null,
    ...rest,
  }
}

describe('durable To-Do presentation filters', () => {
  const now = new Date(2026, 8, 23, 12, 0, 0)
  const localIso = (year: number, month: number, day: number, hour: number) =>
    new Date(year, month, day, hour).toISOString()

  it('maps every saved view to durable fields using local calendar semantics', () => {
    const dueToday = todo({
      id: 'today',
      title: 'Today',
      dueAt: localIso(2026, 8, 23, 17),
    })
    const overdue = todo({
      id: 'overdue',
      title: 'Overdue',
      dueAt: localIso(2026, 8, 22, 17),
    })
    const mine = todo({
      id: 'mine',
      title: 'Mine',
      assigneeMemberId: 'member-a',
    })
    const high = todo({
      id: 'high',
      title: 'High',
      priority: 'HIGH',
    })
    const completed = todo({
      id: 'completed',
      title: 'Completed',
      status: 'COMPLETED',
      completedAt: localIso(2026, 8, 22, 10),
    })

    expect(matchesTodoSavedView(dueToday, 'due-today', 'member-a', now)).toBe(
      true,
    )
    expect(matchesTodoSavedView(overdue, 'overdue', 'member-a', now)).toBe(true)
    expect(matchesTodoSavedView(mine, 'mine', 'member-a', now)).toBe(true)
    expect(matchesTodoSavedView(high, 'high-priority', 'member-a', now)).toBe(
      true,
    )
    expect(matchesTodoSavedView(mine, 'open', 'member-a', now)).toBe(true)
    expect(matchesTodoSavedView(completed, 'completed', 'member-a', now)).toBe(
      true,
    )
    expect(
      matchesTodoSavedView(completed, 'completed-week', 'member-a', now),
    ).toBe(true)
  })

  it('excludes archived records and Job Steps from views and search results', () => {
    const records = [
      todo({
        id: 'visible',
        title: 'Order trimmer line',
        assigneeMemberId: 'member-a',
      }),
      todo({
        id: 'archived',
        title: 'Archived responsibility',
        assigneeMemberId: 'member-a',
        archivedAt: localIso(2026, 8, 23, 9),
      }),
      todo({
        id: 'step',
        title: 'Job-only step',
        kind: 'JOB_STEP',
        jobId: 'job-a',
        assigneeMemberId: 'member-a',
      }),
    ]

    expect(
      filterTodos(records, 'mine', 'member-a', '', now).map((item) => item.id),
    ).toEqual(['visible'])
    expect(
      filterTodos(records, 'mine', 'member-a', 'trimmer', now).map(
        (item) => item.id,
      ),
    ).toEqual(['visible'])
  })

  it('defines due-now and Monday-based completed-week boundaries in local time', () => {
    const mondayNoon = new Date(2026, 8, 21, 12, 0, 0)
    const dueNow = todo({
      id: 'due-now',
      title: 'Due now',
      dueAt: mondayNoon.toISOString(),
    })
    const justOverdue = todo({
      id: 'just-overdue',
      title: 'Just overdue',
      dueAt: new Date(mondayNoon.getTime() - 1).toISOString(),
    })
    const weekStart = todo({
      id: 'week-start',
      title: 'Week start',
      status: 'COMPLETED',
      completedAt: new Date(2026, 8, 21, 0, 0, 0).toISOString(),
    })
    const beforeWeek = todo({
      id: 'before-week',
      title: 'Before week',
      status: 'COMPLETED',
      completedAt: new Date(2026, 8, 20, 23, 59, 59, 999).toISOString(),
    })
    const nextWeek = todo({
      id: 'next-week',
      title: 'Next week',
      status: 'COMPLETED',
      completedAt: new Date(2026, 8, 28, 0, 0, 0).toISOString(),
    })

    expect(
      matchesTodoSavedView(dueNow, 'overdue', 'member-a', mondayNoon),
    ).toBe(false)
    expect(
      matchesTodoSavedView(justOverdue, 'overdue', 'member-a', mondayNoon),
    ).toBe(true)
    expect(
      matchesTodoSavedView(weekStart, 'completed-week', 'member-a', mondayNoon),
    ).toBe(true)
    expect(
      matchesTodoSavedView(
        beforeWeek,
        'completed-week',
        'member-a',
        mondayNoon,
      ),
    ).toBe(false)
    expect(
      matchesTodoSavedView(nextWeek, 'completed-week', 'member-a', mondayNoon),
    ).toBe(false)
  })
})
