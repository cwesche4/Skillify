import { beforeEach, describe, expect, it } from 'vitest'

import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import {
  getSchedulingLinkedRecordOptions,
  getSupportedLinkedRecordTypes,
  normalizeSchedulingMemberOptions,
} from '@/lib/scheduling/schedulingWorkspaceData'
import type { SchedulingCapabilities } from '@/lib/scheduling/types'

const baseCapabilities: SchedulingCapabilities = {
  enabled: true,
  preset: 'consultative',
  supportedSections: ['calendar', 'appointments', 'crmMeetings'],
  defaultVisibleSections: ['calendar', 'appointments', 'crmMeetings'],
  visibleSections: ['calendar', 'appointments', 'crmMeetings'],
  supportedEventTypes: ['discoveryCall', 'consultation', 'proposalReview'],
  supportsCustomerLinks: false,
  supportsClientLinks: true,
  supportsLeadLinks: true,
  supportsOpportunityLinks: true,
  supportsSaleLinks: true,
  supportsOrderLinks: false,
  supportsFulfillmentLinks: false,
  supportsProductLinks: false,
  supportsJobLinks: false,
  supportsRecurringSeries: true,
  supportsPickupWindows: false,
  supportsDeliveryWindows: false,
  supportsExternalCalendarSync: false,
}

describe('scheduling workspace data helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('normalizes active workspace members into selectable member options', () => {
    const members = normalizeSchedulingMemberOptions([
      {
        id: 'member-a',
        userId: 'user-a',
        fullName: 'Rachel Adams',
        email: 'rachel@example.com',
        role: 'ADMIN',
      },
      {
        id: 'duplicate-member-a',
        userId: 'user-a',
        fullName: 'Duplicate Rachel',
        email: 'duplicate@example.com',
        role: 'MEMBER',
      },
      {
        id: 'member-inactive',
        userId: 'user-inactive',
        fullName: 'Inactive Person',
        email: 'inactive@example.com',
        role: 'MEMBER',
        status: 'inactive',
      },
    ])

    expect(members).toEqual([
      {
        id: 'member-a',
        label: 'Rachel Adams',
        secondary: 'rachel@example.com',
        role: 'ADMIN',
      },
    ])
  })

  it('resolves supported linked record types from capabilities', () => {
    expect(getSupportedLinkedRecordTypes(baseCapabilities)).toEqual([
      'lead',
      'opportunity',
      'sale',
      'client',
    ])

    expect(
      getSupportedLinkedRecordTypes({
        ...baseCapabilities,
        preset: 'commerce',
        supportsLeadLinks: false,
        supportsOpportunityLinks: false,
        supportsSaleLinks: false,
        supportsClientLinks: false,
        supportsCustomerLinks: true,
        supportsOrderLinks: true,
        supportsFulfillmentLinks: true,
        supportsProductLinks: true,
      }),
    ).toEqual(['customer', 'order', 'fulfillment', 'product'])
  })

  it('returns friendly linked-record options without requiring typed labels', () => {
    const leads = getSchedulingLinkedRecordOptions({
      workspaceId: 'workspace-a',
      recordType: 'lead',
    })

    expect(leads.some((lead) => lead.label === 'Rachel Adams')).toBe(true)
    expect(leads.find((lead) => lead.label === 'Rachel Adams')).toMatchObject({
      recordType: 'lead',
      recordId: 'lead-rachel-adams',
      secondary: expect.stringContaining('Adams Bookkeeping'),
    })
  })

  it('keeps event type visibility and order preferences in normalized settings', () => {
    const settings = normalizeSchedulingSettings({
      businessModel: 'CONSULTATIVE_SALES',
      settings: {
        preset: 'consultative',
        eventTypePreferences: [
          { key: 'proposalReview', isVisible: false, sortOrder: 0 },
          {
            key: 'discoveryCall',
            isVisible: true,
            sortOrder: 1,
            defaultDurationMinutes: 45,
          },
          { key: 'blockedTime', isVisible: true, sortOrder: 2 },
        ],
      },
    })

    expect(settings.eventTypePreferences).toEqual([
      {
        key: 'proposalReview',
        isVisible: false,
        sortOrder: 0,
        defaultDurationMinutes: undefined,
      },
      {
        key: 'discoveryCall',
        isVisible: true,
        sortOrder: 1,
        defaultDurationMinutes: 45,
      },
      {
        key: 'blockedTime',
        isVisible: true,
        sortOrder: 2,
        defaultDurationMinutes: undefined,
      },
    ])
  })
})
