import { describe, expect, it } from 'vitest'

import {
  filterLeads,
  getLeadSavedViewCounts,
  getNormalizedLeads,
  sortLeads,
} from '@/lib/crm/leadSelectors'
import type { LeadRecord } from '@/lib/sales/demoSalesRecords'

const today = '2026-06-29'
const staleCutoff = '2026-06-21'

function lead(
  overrides: Partial<LeadRecord> & Pick<LeadRecord, 'id' | 'status' | 'stage'>,
): LeadRecord {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    company: overrides.company ?? 'Acme',
    status: overrides.status,
    stage: overrides.stage,
    source: overrides.source ?? 'Website Form',
    value: overrides.value ?? 1000,
    nextStep: overrides.nextStep ?? 'Follow up',
    ownerId: overrides.ownerId ?? 'owner',
    createdAt: overrides.createdAt ?? '2026-06-01',
    convertedAt: overrides.convertedAt,
    lastActivityAt: overrides.lastActivityAt,
    followUpDue: overrides.followUpDue,
    converted: overrides.converted ?? false,
    notes: overrides.notes ?? 'Notes',
  }
}

describe('lead selectors', () => {
  it('normalizes converted leads out of active stages and follow-up queues', () => {
    const records = getNormalizedLeads([
      lead({
        id: 'active-qualified',
        status: 'Qualified',
        stage: 'Qualified',
        followUpDue: '2026-06-20',
      }),
      lead({
        id: 'converted-qualified',
        status: 'Qualified',
        stage: 'Converted',
        converted: true,
        followUpDue: '2026-06-20',
      }),
    ])

    expect(
      records.find((record) => record.id === 'converted-qualified'),
    ).toMatchObject({
      status: 'Converted',
      stage: 'Qualified',
      nextStep: 'None - converted',
      followUpDue: undefined,
    })
    expect(getLeadSavedViewCounts(records)).toMatchObject({
      qualified: 1,
      converted: 1,
      needsFollowUp: 1,
    })
  })

  it('uses one predicate for saved-view counts and filtered rows', () => {
    const records = [
      lead({
        id: 'new-active',
        status: 'New',
        stage: 'New',
        followUpDue: today,
      }),
      lead({ id: 'contacted-active', status: 'Contacted', stage: 'Contacted' }),
      lead({
        id: 'converted',
        status: 'Qualified',
        stage: 'Qualified',
        converted: true,
      }),
    ]
    const counts = getLeadSavedViewCounts(records)
    const newRows = filterLeads(records, {
      drilldown: { type: 'status', status: 'New' },
      today,
      staleActivityCutoff: staleCutoff,
    })
    const contactedRows = filterLeads(records, {
      drilldown: { type: 'status', status: 'Contacted' },
      today,
      staleActivityCutoff: staleCutoff,
    })

    expect(counts.new).toBe(newRows.length)
    expect(counts.contacted).toBe(contactedRows.length)
    expect(newRows.map((record) => record.id)).toEqual(['new-active'])
    expect(contactedRows.map((record) => record.id)).toEqual([
      'contacted-active',
    ])
  })

  it('sorts active lifecycle stages before converted and disqualified records', () => {
    const records = [
      lead({
        id: 'converted',
        status: 'Converted',
        stage: 'Qualified',
        converted: true,
        convertedAt: '2026-06-28',
      }),
      lead({
        id: 'disqualified',
        status: 'Disqualified',
        stage: 'Disqualified',
        lastActivityAt: '2026-06-27',
      }),
      lead({ id: 'qualified', status: 'Qualified', stage: 'Qualified' }),
      lead({
        id: 'new-overdue',
        status: 'New',
        stage: 'New',
        followUpDue: '2026-06-20',
      }),
      lead({ id: 'contacted', status: 'Contacted', stage: 'Contacted' }),
    ]

    expect(
      sortLeads(records, today, staleCutoff).map((record) => record.id),
    ).toEqual([
      'new-overdue',
      'contacted',
      'qualified',
      'converted',
      'disqualified',
    ])
  })

  it('sorts follow-up priority by overdue age, today, upcoming, no follow-up, then terminal records', () => {
    const records = [
      lead({
        id: 'no-follow-up-newer',
        status: 'New',
        stage: 'New',
        createdAt: '2026-06-28',
      }),
      lead({
        id: 'upcoming-later',
        status: 'Contacted',
        stage: 'Contacted',
        followUpDue: '2026-07-05',
      }),
      lead({
        id: 'due-today',
        status: 'Qualified',
        stage: 'Qualified',
        followUpDue: today,
      }),
      lead({
        id: 'overdue-less',
        status: 'New',
        stage: 'New',
        followUpDue: '2026-06-28',
      }),
      lead({
        id: 'overdue-more',
        status: 'Contacted',
        stage: 'Contacted',
        followUpDue: '2026-06-24',
      }),
      lead({
        id: 'upcoming-sooner',
        status: 'Qualified',
        stage: 'Qualified',
        followUpDue: '2026-07-01',
      }),
      lead({
        id: 'converted-overdue',
        status: 'Converted',
        stage: 'Converted',
        converted: true,
        followUpDue: '2026-06-01',
      }),
    ]

    expect(
      sortLeads(records, today, staleCutoff).map((record) => record.id),
    ).toEqual([
      'overdue-more',
      'overdue-less',
      'due-today',
      'upcoming-sooner',
      'upcoming-later',
      'no-follow-up-newer',
      'converted-overdue',
    ])
  })

  it('uses newest-created as the follow-up priority tie-breaker and lead id as the final stable tie-breaker', () => {
    const records = [
      lead({
        id: 'same-b',
        status: 'New',
        stage: 'New',
        createdAt: '2026-06-20',
      }),
      lead({
        id: 'newest',
        status: 'New',
        stage: 'New',
        createdAt: '2026-06-27',
      }),
      lead({
        id: 'same-a',
        status: 'New',
        stage: 'New',
        createdAt: '2026-06-20',
      }),
    ]

    expect(
      sortLeads(records, today, staleCutoff).map((record) => record.id),
    ).toEqual(['newest', 'same-a', 'same-b'])
  })

  it('supports explicit date and value sort options', () => {
    const records = [
      lead({
        id: 'middle',
        status: 'New',
        stage: 'New',
        createdAt: '2026-06-15',
        followUpDue: '2026-07-03',
        value: 200,
      }),
      lead({
        id: 'newest',
        status: 'New',
        stage: 'New',
        createdAt: '2026-06-29',
        followUpDue: '2026-07-01',
        value: 100,
      }),
      lead({
        id: 'oldest',
        status: 'New',
        stage: 'New',
        createdAt: '2026-06-01',
        followUpDue: '2026-07-05',
        value: 300,
      }),
    ]

    expect(
      sortLeads(records, today, staleCutoff, 'newestAdded').map(
        (record) => record.id,
      ),
    ).toEqual(['newest', 'middle', 'oldest'])
    expect(
      sortLeads(records, today, staleCutoff, 'oldestAdded').map(
        (record) => record.id,
      ),
    ).toEqual(['oldest', 'middle', 'newest'])
    expect(
      sortLeads(records, today, staleCutoff, 'followUpSoonest').map(
        (record) => record.id,
      ),
    ).toEqual(['newest', 'middle', 'oldest'])
    expect(
      sortLeads(records, today, staleCutoff, 'followUpLatest').map(
        (record) => record.id,
      ),
    ).toEqual(['oldest', 'middle', 'newest'])
    expect(
      sortLeads(records, today, staleCutoff, 'highestValue').map(
        (record) => record.id,
      ),
    ).toEqual(['oldest', 'middle', 'newest'])
    expect(
      sortLeads(records, today, staleCutoff, 'lowestValue').map(
        (record) => record.id,
      ),
    ).toEqual(['newest', 'middle', 'oldest'])
  })

  it('sorts by status deterministically without crashing on null or invalid dates', () => {
    const records = [
      lead({
        id: 'qualified',
        status: 'Qualified',
        stage: 'Qualified',
        createdAt: 'not-a-date',
        followUpDue: 'invalid',
      }),
      lead({ id: 'new', status: 'New', stage: 'New', createdAt: '2026-06-01' }),
      lead({
        id: 'contacted',
        status: 'Contacted',
        stage: 'Contacted',
        createdAt: '2026-06-02',
      }),
    ]

    expect(
      sortLeads(records, today, staleCutoff, 'status').map(
        (record) => record.id,
      ),
    ).toEqual(['new', 'contacted', 'qualified'])
  })

  it('uses workspace timezone when comparing timestamp-created leads', () => {
    const records = [
      lead({
        id: 'new-york-july',
        status: 'New',
        stage: 'New',
        createdAt: '2026-07-01T00:30:00Z',
      }),
      lead({
        id: 'new-york-june',
        status: 'New',
        stage: 'New',
        createdAt: '2026-06-30T23:30:00Z',
      }),
    ]

    expect(
      sortLeads(
        records,
        today,
        staleCutoff,
        'newestAdded',
        'America/New_York',
      ).map((record) => record.id),
    ).toEqual(['new-york-july', 'new-york-june'])
  })
})
