import { describe, expect, it } from 'vitest'

import {
  createPreviewLeadRecord,
  getLeadDuplicateWarning,
  validateCreateLeadInput,
  type CreateLeadInput,
} from '@/lib/crm/createLead'
import type { LeadRecord } from '@/lib/sales/demoSalesRecords'

function input(overrides: Partial<CreateLeadInput> = {}): CreateLeadInput {
  return {
    name: 'Avery Brooks',
    company: 'Brooks Studio',
    contactEmail: 'avery@example.com',
    source: 'Manual Entry',
    stage: 'New',
    value: '2500',
    ownerId: 'owner-user-corbin',
    nextStep: 'Schedule intro call',
    notes: 'Interested in workflow help.',
    ...overrides,
  }
}

function lead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead-existing',
    name: 'Avery Brooks',
    company: 'Brooks Studio',
    contactEmail: 'avery@example.com',
    status: 'New',
    stage: 'New',
    source: 'Manual Entry',
    value: 1000,
    nextStep: 'Follow up',
    ownerId: 'owner-user-corbin',
    createdAt: '2026-06-01',
    converted: false,
    notes: 'Existing',
    ...overrides,
  }
}

describe('create lead helper', () => {
  it('validates required lead fields and optional email/value formats', () => {
    const validation = validateCreateLeadInput(
      input({
        name: '',
        contactEmail: 'not-an-email',
        value: '-10',
        ownerId: '',
      }),
    )

    expect(validation.valid).toBe(false)
    expect(validation.errors).toMatchObject({
      name: 'Lead name is required.',
      contactEmail: 'Enter a valid email address.',
      value: 'Estimated value must be zero or higher.',
      ownerId: 'Lead owner is required.',
    })
  })

  it('creates a normalized preview lead with status derived from stage', () => {
    const record = createPreviewLeadRecord({
      input: input({ stage: 'Qualified', value: '3250' }),
      existingLeads: [],
      now: new Date(2026, 6, 30, 9, 15, 0),
    })

    expect(record).toMatchObject({
      id: 'lead-avery-brooks-brooks-studio',
      name: 'Avery Brooks',
      company: 'Brooks Studio',
      status: 'Qualified',
      stage: 'Qualified',
      source: 'Manual Entry',
      value: 3250,
      ownerId: 'owner-user-corbin',
      converted: false,
      sharedContactId: 'contact-lead-avery-brooks-brooks-studio',
    })
    expect(record.createdAt).toContain('2026-07-30T09:15:00')
    expect(record.lastActivityAt).toContain('2026-07-30T09:15:00')
  })

  it('warns about likely duplicate leads without blocking creation', () => {
    expect(getLeadDuplicateWarning(input(), [lead()])).toContain(
      'Avery Brooks is already tracked as a lead',
    )
    expect(validateCreateLeadInput(input()).valid).toBe(true)
  })

  it('keeps generated IDs stable and unique within the workspace collection', () => {
    const first = lead({ id: 'lead-avery-brooks-brooks-studio' })
    const record = createPreviewLeadRecord({
      input: input(),
      existingLeads: [first],
      now: new Date(2026, 6, 30, 9, 15, 0),
    })

    expect(record.id).toBe('lead-avery-brooks-brooks-studio-2')
  })
})
