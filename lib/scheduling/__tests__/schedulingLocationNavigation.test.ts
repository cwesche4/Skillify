import { describe, expect, it } from 'vitest'

import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getLinkedRecordNavigationTarget } from '@/lib/scheduling/linkedRecordNavigation'
import {
  getSchedulingLocationDisplay,
  normalizeSchedulingLocation,
  resolveSchedulingLocationRule,
  validateSchedulingLocation,
} from '@/lib/scheduling/locationRules'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import type { WorkspaceSchedulingSettings } from '@/lib/scheduling/types'

function getSettings(
  overrides: Partial<WorkspaceSchedulingSettings> = {},
): WorkspaceSchedulingSettings {
  return normalizeSchedulingSettings({
    businessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
    settings: {
      timezone: 'America/New_York',
      defaultCalendarView: 'week',
      weekStartsOn: 0,
      ...overrides,
    },
  })
}

describe('scheduling location rules', () => {
  it('allows optional event types to save with no location', () => {
    const settings = getSettings()
    const result = validateSchedulingLocation({
      eventType: 'discoveryCall',
      settings,
      location: { locationType: 'none' },
    })

    expect(result).toEqual({ valid: true })
    expect(
      normalizeSchedulingLocation({
        eventType: 'discoveryCall',
        settings,
        location: { locationType: 'none' },
      }),
    ).toMatchObject({ locationType: 'none', location: undefined })
  })

  it('requires configured location for required site visits and jobs', () => {
    const settings = getSettings()

    expect(
      validateSchedulingLocation({
        eventType: 'siteVisit',
        settings,
        location: { locationType: 'none' },
      }),
    ).toMatchObject({ valid: false })
    expect(
      validateSchedulingLocation({
        eventType: 'scheduledJob',
        settings,
        location: {
          locationType: 'customerLocation',
          locationAddress: '123 Main Street',
        },
      }),
    ).toEqual({ valid: true })
  })

  it('allows required site visits to use a to-be-determined location when the policy permits it', () => {
    const settings = getSettings()

    expect(
      resolveSchedulingLocationRule({
        eventType: 'siteVisit',
        settings,
      }),
    ).toMatchObject({
      requirement: 'required',
      allowUndeterminedLocation: true,
    })
    expect(
      validateSchedulingLocation({
        eventType: 'siteVisit',
        settings,
        location: { locationType: 'toBeDetermined' },
      }),
    ).toEqual({ valid: true })
    expect(
      normalizeSchedulingLocation({
        eventType: 'siteVisit',
        settings,
        location: { locationType: 'toBeDetermined' },
      }),
    ).toMatchObject({
      locationType: 'toBeDetermined',
      location: 'To be determined',
      locationLabel: 'To be determined',
      locationAddress: undefined,
    })
    expect(
      getSchedulingLocationDisplay({
        locationType: 'toBeDetermined',
      }),
    ).toBe('To be determined')
  })

  it('keeps no-location distinct from to-be-determined for required location rules', () => {
    const settings = getSettings()

    expect(
      validateSchedulingLocation({
        eventType: 'siteVisit',
        settings,
        location: { locationType: 'none' },
      }),
    ).toMatchObject({ valid: false })
    expect(
      normalizeSchedulingLocation({
        eventType: 'siteVisit',
        settings,
        location: { locationType: 'none' },
      }),
    ).toMatchObject({
      locationType: 'customerLocation',
      location: '',
      locationLabel: undefined,
    })
  })

  it('clears location data for event types that do not use location', () => {
    const settings = getSettings()
    const rule = resolveSchedulingLocationRule({
      eventType: 'blockedTime',
      settings,
    })

    expect(rule).toMatchObject({
      requirement: 'notAllowed',
      allowedLocationTypes: ['none'],
      defaultLocationType: 'none',
    })
    expect(
      normalizeSchedulingLocation({
        eventType: 'blockedTime',
        settings,
        location: {
          locationType: 'physicalAddress',
          locationAddress: '123 Main Street',
        },
      }),
    ).toMatchObject({
      locationType: 'none',
      location: undefined,
      locationAddress: undefined,
    })
  })

  it('validates location-type-specific fields', () => {
    const settings = getSettings()

    expect(
      validateSchedulingLocation({
        eventType: 'discoveryCall',
        settings,
        location: { locationType: 'videoMeeting', meetingUrl: 'not-a-url' },
      }),
    ).toMatchObject({ valid: false })
    expect(
      validateSchedulingLocation({
        eventType: 'discoveryCall',
        settings,
        location: { locationType: 'phoneCall' },
      }),
    ).toEqual({ valid: true })
    expect(
      getSchedulingLocationDisplay({
        locationType: 'videoMeeting',
        meetingUrl: 'https://meet.example.com/room',
      }),
    ).toBe('https://meet.example.com/room')
  })

  it('uses custom event-type location metadata', () => {
    const settings = getSettings({
      customEventTypes: [
        {
          id: 'custom-cleaning',
          workspaceId: 'workspace-1',
          key: 'custom.cleaning',
          label: 'Cleaning',
          presetScope: ['commerce'],
          sectionKeys: ['calendar'],
          blocksAvailability: true,
          requiresLinkedRecord: false,
          supportedLinkedRecordTypes: [],
          locationRequirement: 'required',
          allowedLocationTypes: ['customerLocation'],
          defaultLocationType: 'customerLocation',
          allowUndeterminedLocation: false,
          isActive: true,
          isSystem: false,
          sortOrder: 0,
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    })

    expect(
      resolveSchedulingLocationRule({
        eventType: 'custom.cleaning',
        settings,
      }),
    ).toMatchObject({
      requirement: 'required',
      allowedLocationTypes: ['customerLocation'],
      defaultLocationType: 'customerLocation',
      allowUndeterminedLocation: false,
    })
    expect(
      validateSchedulingLocation({
        eventType: 'custom.cleaning',
        settings,
        location: { locationType: 'toBeDetermined' },
      }),
    ).toMatchObject({ valid: false })
  })
})

describe('scheduling linked-record navigation', () => {
  it('builds valid deep links with query parameters before hash', () => {
    const target = getLinkedRecordNavigationTarget({
      workspaceSlug: 'acme',
      recordType: 'lead',
      recordId: 'lead-123',
    })

    expect(target).toMatchObject({
      route: '/dashboard/acme/leads',
      sectionAnchor: 'leads-workspace',
      queryParam: 'leadId',
      recordId: 'lead-123',
    })
    expect(target?.href).toBe(
      '/dashboard/acme/leads?leadId=lead-123&recordType=lead#leads-workspace',
    )
  })

  it('uses exact record-id query parameters for CRM drawers', () => {
    expect(
      getLinkedRecordNavigationTarget({
        workspaceSlug: 'acme',
        recordType: 'opportunity',
        recordId: 'opp-1',
      })?.href,
    ).toBe(
      '/dashboard/acme/opportunities?opportunityId=opp-1&recordType=opportunity#opportunities-workspace',
    )
    expect(
      getLinkedRecordNavigationTarget({
        workspaceSlug: 'acme',
        recordType: 'sale',
        recordId: 'sale-1',
      })?.href,
    ).toBe(
      '/dashboard/acme/sales-pipeline?dealId=sale-1&recordType=sale#sales-pipeline-workspace',
    )
    expect(
      getLinkedRecordNavigationTarget({
        workspaceSlug: 'acme',
        recordType: 'client',
        recordId: 'client-1',
      })?.href,
    ).toBe(
      '/dashboard/acme/clients?clientId=client-1&recordType=client#client-relationships',
    )
  })

  it('does not create links for blank record ids', () => {
    expect(
      getLinkedRecordNavigationTarget({
        workspaceSlug: 'acme',
        recordType: 'lead',
        recordId: ' ',
      }),
    ).toBeNull()
  })
})
