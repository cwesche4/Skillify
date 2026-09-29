import { describe, expect, it } from 'vitest'

import type { LeadClientRecord } from '@/lib/leads/clientTypes'
import {
  matchesDurableLeadSavedView,
  normalizeDurableLeadSavedView,
} from '@/lib/leads/presentation'

function lead(overrides: Partial<LeadClientRecord> = {}): LeadClientRecord {
  return {
    id: 'lead-a',
    workspaceId: 'workspace-a',
    displayName: 'Lead A',
    companyName: null,
    email: null,
    phone: null,
    stage: 'FOLLOW_UP',
    source: null,
    estimatedValueCents: null,
    currency: 'USD',
    nextStep: null,
    followUpAt: null,
    assignedMemberId: null,
    notes: null,
    convertedCustomerId: null,
    convertedAt: null,
    convertedCustomer: null,
    createdByUserId: 'user-a',
    createdAt: '2026-09-28T12:00:00.000Z',
    updatedAt: '2026-09-28T12:00:00.000Z',
    archivedAt: null,
    ...overrides,
  }
}

const options = {
  now: new Date('2026-09-29T04:30:00.000Z'),
  timezone: 'America/New_York',
}

describe('durable Lead attention presentation', () => {
  it('uses workspace-local calendar dates at midnight boundaries', () => {
    expect(
      matchesDurableLeadSavedView(
        lead({ followUpAt: '2026-09-29T03:59:59.000Z' }),
        'overdue',
        options,
      ),
    ).toBe(true)
    expect(
      matchesDurableLeadSavedView(
        lead({ followUpAt: '2026-09-29T04:00:00.000Z' }),
        'due-today',
        options,
      ),
    ).toBe(true)
    expect(
      matchesDurableLeadSavedView(
        lead({ followUpAt: '2026-09-30T04:00:00.000Z' }),
        'due-or-overdue',
        options,
      ),
    ).toBe(false)
  })

  it.each([
    {
      transition: 'spring daylight-saving transition',
      now: '2026-03-08T05:30:00.000Z',
      previousDay: '2026-03-08T04:59:59.000Z',
      currentDay: '2026-03-08T05:00:00.000Z',
    },
    {
      transition: 'fall daylight-saving transition',
      now: '2026-11-01T04:30:00.000Z',
      previousDay: '2026-11-01T03:59:59.000Z',
      currentDay: '2026-11-01T04:00:00.000Z',
    },
  ])(
    'keeps calendar-day attention stable across the $transition',
    ({ now, previousDay, currentDay }) => {
      const transitionOptions = {
        now: new Date(now),
        timezone: 'America/New_York',
      }
      expect(
        matchesDurableLeadSavedView(
          lead({ followUpAt: previousDay }),
          'overdue',
          transitionOptions,
        ),
      ).toBe(true)
      expect(
        matchesDurableLeadSavedView(
          lead({ followUpAt: currentDay }),
          'due-today',
          transitionOptions,
        ),
      ).toBe(true)
    },
  )

  it.each([
    ['null date', { followUpAt: null }],
    ['Won', { stage: 'WON' as const, followUpAt: '2026-09-29T04:00:00.000Z' }],
    [
      'Lost',
      { stage: 'LOST' as const, followUpAt: '2026-09-29T04:00:00.000Z' },
    ],
    [
      'converted',
      {
        followUpAt: '2026-09-29T04:00:00.000Z',
        convertedCustomerId: 'customer-a',
      },
    ],
    [
      'archived',
      {
        followUpAt: '2026-09-29T04:00:00.000Z',
        archivedAt: '2026-09-29T05:00:00.000Z',
      },
    ],
  ])('excludes %s Leads from active follow-up attention', (_label, input) => {
    expect(
      matchesDurableLeadSavedView(lead(input), 'due-or-overdue', options),
    ).toBe(false)
  })

  it('supports canonical views and the historical follow-up alias', () => {
    expect(normalizeDurableLeadSavedView('due-today')).toBe('due-today')
    expect(normalizeDurableLeadSavedView('overdue')).toBe('overdue')
    expect(normalizeDurableLeadSavedView('needs-follow-up')).toBe(
      'due-or-overdue',
    )
    expect(normalizeDurableLeadSavedView('new')).toBe('new')
    expect(normalizeDurableLeadSavedView('unsupported')).toBe('all')
  })

  it('does not match a Lead from another workspace record set accidentally', () => {
    const workspaceA = [
      lead({
        id: 'lead-a',
        workspaceId: 'workspace-a',
        followUpAt: '2026-09-29T04:00:00.000Z',
      }),
    ]
    const workspaceB = [
      lead({
        id: 'lead-b',
        workspaceId: 'workspace-b',
        followUpAt: '2026-09-29T04:00:00.000Z',
      }),
    ]
    expect(
      workspaceA.filter((item) => item.workspaceId === 'workspace-a'),
    ).toHaveLength(1)
    expect(
      workspaceB.filter((item) => item.workspaceId === 'workspace-a'),
    ).toHaveLength(0)
  })
})
