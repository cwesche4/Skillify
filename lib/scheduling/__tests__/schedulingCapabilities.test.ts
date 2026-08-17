import { describe, expect, it } from 'vitest'

import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import {
  getWorkspaceSchedulingCapabilities,
  canAccessSchedulingSection,
  canRouteToSchedulingSection,
} from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import { getCreateOptionsForCapabilities } from '@/lib/scheduling/schedulingFixtures'
import {
  getSchedulingSectionDefinition,
  getSchedulingSectionLabel,
} from '@/lib/scheduling/schedulingPresetRegistry'
import { buildWorkspaceNavigation } from '@/lib/workspaces/workspaceNavigation'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

function capabilitiesFor(model: WorkspaceBusinessModel, settings?: any) {
  return getWorkspaceSchedulingCapabilities({
    businessModel: model,
    settings,
  })
}

function navigationLabels(model: WorkspaceBusinessModel, settings?: any) {
  const capabilities = {
    ...getWorkspaceCapabilities({ businessModel: model }),
    scheduling: capabilitiesFor(model, settings),
  }
  return buildWorkspaceNavigation({
    capabilities,
    workspaceSlug: 'acme',
    role: 'owner',
    canViewSalesPipeline: true,
    canViewServiceRequests: true,
    schedulingSettings: settings,
  }).flatMap((group) => group.items.map((item) => item.label))
}

describe('scheduling capabilities', () => {
  it('maps direct sales services to the service scheduling preset', () => {
    const capabilities = capabilitiesFor(WorkspaceBusinessModel.DIRECT_SALES)
    expect(capabilities.preset).toBe('service')
    expect(capabilities.visibleSections).toContain('scheduledJobs')
    expect(capabilities.visibleSections).toContain('recurringServices')
  })

  it('maps consultative sales to the consultative scheduling preset', () => {
    const capabilities = capabilitiesFor(
      WorkspaceBusinessModel.CONSULTATIVE_SALES,
    )
    expect(capabilities.preset).toBe('consultative')
    expect(capabilities.visibleSections).toContain('crmMeetings')
    expect(capabilities.supportsOpportunityLinks).toBe(true)
  })

  it('maps product commerce to the commerce scheduling preset', () => {
    const capabilities = capabilitiesFor(
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
    )
    expect(capabilities.preset).toBe('commerce')
    expect(capabilities.visibleSections).toContain('pickupDelivery')
    expect(capabilities.supportsOrderLinks).toBe(true)
  })

  it('does not expose CRM meetings by default for commerce', () => {
    const capabilities = capabilitiesFor(
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
    )
    expect(capabilities.visibleSections).not.toContain('crmMeetings')
    expect(capabilities.supportedSections).not.toContain('crmMeetings')
  })

  it('does not expose recurring services for commerce', () => {
    const capabilities = capabilitiesFor(
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
    )
    expect(capabilities.supportedSections).not.toContain('recurringServices')
    expect(capabilities.supportedSections).toContain('recurringDeliveries')
  })

  it('does not expose recurring deliveries for service workspaces', () => {
    const capabilities = capabilitiesFor(WorkspaceBusinessModel.DIRECT_SALES)
    expect(capabilities.supportedSections).not.toContain('recurringDeliveries')
    expect(capabilities.supportedSections).toContain('recurringServices')
  })

  it('removes unsupported sections from saved visibility settings', () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
      settings: {
        preset: 'commerce',
        visibleSections: [
          'calendar',
          'crmMeetings',
          'recurringServices',
          'pickupDelivery',
        ],
      } as any,
    })
    expect(settings.visibleSections).toEqual(['calendar', 'pickupDelivery'])
  })

  it('preserves valid hidden-section preferences', () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      settings: {
        preset: 'service',
        visibleSections: ['calendar', 'appointments'],
      },
    })
    expect(settings.visibleSections).toEqual(['calendar', 'appointments'])
    expect(settings.visibleSections).not.toContain('scheduledJobs')
  })

  it('gives older workspaces default settings', () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
    })
    expect(settings.preset).toBe('consultative')
    expect(settings.visibleSections).toContain('calendar')
    expect(settings.visibleSections).toContain('crmMeetings')
  })

  it('resolves crmMeetings as Sales Meetings while keeping the stable backend key', () => {
    const definition = getSchedulingSectionDefinition('crmMeetings')

    expect(definition.key).toBe('crmMeetings')
    expect(definition.route).toBe('/scheduling/crm-meetings')
    expect(getSchedulingSectionLabel({ sectionKey: 'crmMeetings' })).toBe(
      'Sales Meetings',
    )
  })

  it('normalizes section label overrides without changing visibility or route identity', () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settings: {
        preset: 'consultative',
        visibleSections: ['calendar', 'appointments'],
        sectionLabelOverrides: {
          crmMeetings: 'Client Consultations',
          scheduledJobs: '!!!',
          calendar: 'Calendar',
          pickupDelivery: 'Commerce Pickup',
        } as any,
      },
    })

    expect(settings.visibleSections).toEqual(['calendar', 'appointments'])
    expect(settings.sectionLabelOverrides).toEqual({
      crmMeetings: 'Client Consultations',
    })
    expect(
      getSchedulingSectionLabel({ sectionKey: 'crmMeetings', settings }),
    ).toBe('Client Consultations')
    expect(getSchedulingSectionDefinition('crmMeetings').route).toBe(
      '/scheduling/crm-meetings',
    )
  })

  it('removes hidden sections from navigation', () => {
    const labels = navigationLabels(WorkspaceBusinessModel.DIRECT_SALES, {
      preset: 'service',
      enabled: true,
      visibleSections: ['calendar', 'appointments'],
    })
    expect(labels).toContain('Calendar')
    expect(labels).toContain('Appointments')
    expect(labels).not.toContain('Jobs')
  })

  it('uses section label overrides in navigation and keeps overrides workspace scoped', () => {
    const labels = navigationLabels(WorkspaceBusinessModel.CONSULTATIVE_SALES, {
      preset: 'consultative',
      enabled: true,
      visibleSections: ['calendar', 'crmMeetings'],
      sectionLabelOverrides: { crmMeetings: 'Client Consultations' },
    })
    const defaultLabels = navigationLabels(
      WorkspaceBusinessModel.CONSULTATIVE_SALES,
      {
        preset: 'consultative',
        enabled: true,
        visibleSections: ['calendar', 'crmMeetings'],
      },
    )

    expect(labels).toContain('Client Consultations')
    expect(labels).not.toContain('Sales Meetings')
    expect(defaultLabels).toContain('Sales Meetings')
    expect(defaultLabels).not.toContain('Client Consultations')
  })

  it('guards hidden or unsupported sections', () => {
    const capabilities = capabilitiesFor(
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
      {
        preset: 'commerce',
        enabled: true,
        visibleSections: ['calendar', 'pickupDelivery'],
      },
    )
    expect(canAccessSchedulingSection(capabilities, 'pickupDelivery')).toBe(
      true,
    )
    expect(canAccessSchedulingSection(capabilities, 'crmMeetings')).toBe(false)
    expect(
      canAccessSchedulingSection(capabilities, 'installationService'),
    ).toBe(false)
  })

  it('allows supported specialized routes without requiring server-visible settings', () => {
    const capabilities = capabilitiesFor(WorkspaceBusinessModel.DIRECT_SALES, {
      preset: 'service',
      enabled: true,
      visibleSections: ['calendar'],
    })

    expect(canAccessSchedulingSection(capabilities, 'scheduledJobs')).toBe(
      false,
    )
    expect(canRouteToSchedulingSection(capabilities, 'scheduledJobs')).toBe(
      true,
    )
    expect(canRouteToSchedulingSection(capabilities, 'recurringServices')).toBe(
      true,
    )
    expect(canRouteToSchedulingSection(capabilities, 'internalMeetings')).toBe(
      true,
    )
    expect(canRouteToSchedulingSection(capabilities, 'pickupDelivery')).toBe(
      false,
    )
  })

  it('does not change business model when visible sections change', () => {
    const capabilities = {
      ...getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      }),
      scheduling: capabilitiesFor(WorkspaceBusinessModel.DIRECT_SALES, {
        preset: 'service',
        visibleSections: ['calendar'],
      }),
    }
    expect(capabilities.businessModel).toBe(WorkspaceBusinessModel.DIRECT_SALES)
  })

  it('hides the Scheduling navigation group when disabled', () => {
    const labels = navigationLabels(WorkspaceBusinessModel.DIRECT_SALES, {
      preset: 'service',
      enabled: false,
      visibleSections: ['calendar'],
    })
    expect(labels).not.toContain('Calendar')
    expect(labels).not.toContain('Scheduling Settings')
  })

  it('limits event creation options to supported preset event types', () => {
    const capabilities = capabilitiesFor(
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
    )
    const labels = getCreateOptionsForCapabilities(capabilities).map(
      (option) => option.label,
    )
    expect(labels).toContain('Customer Pickup')
    expect(labels).toContain('Delivery Window')
    expect(labels).not.toContain('Discovery Call')
    expect(labels).not.toContain('Recurring Service Visit')
  })

  it('keeps commerce record selectors commerce-focused by capability', () => {
    const capabilities = capabilitiesFor(
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
    )
    expect(capabilities.supportsCustomerLinks).toBe(true)
    expect(capabilities.supportsOrderLinks).toBe(true)
    expect(capabilities.supportsFulfillmentLinks).toBe(true)
    expect(capabilities.supportsProductLinks).toBe(true)
    expect(capabilities.supportsLeadLinks).toBe(false)
    expect(capabilities.supportsOpportunityLinks).toBe(false)
    expect(capabilities.supportsSaleLinks).toBe(false)
    expect(capabilities.supportsClientLinks).toBe(false)
  })
})
