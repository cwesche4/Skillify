import { afterEach, describe, expect, it, vi } from 'vitest'

import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import type { WorkspaceSchedulingSettings } from '@/lib/scheduling/types'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { buildWorkspaceNavigation } from '@/lib/workspaces/workspaceNavigation'

function labelsFor(model: WorkspaceBusinessModel) {
  return buildWorkspaceNavigation({
    capabilities: getWorkspaceCapabilities({ businessModel: model }),
    workspaceSlug: 'acme',
    role: 'owner',
    canViewSalesPipeline: true,
    canViewServiceRequests: true,
  }).flatMap((group) => group.items.map((item) => item.label))
}

function schedulingItemsFor({
  model,
  schedulingSettings,
}: {
  model: WorkspaceBusinessModel
  schedulingSettings?: Partial<WorkspaceSchedulingSettings>
}) {
  return (
    buildWorkspaceNavigation({
      capabilities: getWorkspaceCapabilities({
        businessModel: model,
        schedulingSettings,
      }),
      workspaceSlug: 'acme',
      role: 'owner',
      canViewSalesPipeline: true,
      canViewServiceRequests: true,
      schedulingSettings,
    }).find((group) => group.section === 'SCHEDULING')?.items ?? []
  )
}

function sectionsFor(model: WorkspaceBusinessModel) {
  return buildWorkspaceNavigation({
    capabilities: getWorkspaceCapabilities({ businessModel: model }),
    workspaceSlug: 'acme',
    role: 'owner',
    canViewSalesPipeline: true,
    canViewServiceRequests: true,
  }).map((group) => group.section)
}

describe('workspace navigation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses simplified customer and operations navigation for Simple Service Business', () => {
    const groups = buildWorkspaceNavigation({
      capabilities: getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      }),
      workspaceSlug: 'acme',
      role: 'owner',
      canViewSalesPipeline: true,
      canViewServiceRequests: true,
    })
    const customers = groups.find((group) => group.section === 'CUSTOMERS')
    const operations = groups.find((group) => group.section === 'OPERATIONS')

    expect(groups.find((group) => group.section === 'SALES')).toBeUndefined()
    expect(customers?.items.map((item) => item.label)).toEqual([
      'Leads',
      'Customers',
    ])
    expect(operations?.items.map((item) => item.label)).toEqual([
      'Jobs',
      'Job Steps',
    ])

    const labels = groups.flatMap((group) =>
      group.items.map((item) => item.label),
    )
    expect(labels).not.toContain('Opportunities')
    expect(labels).not.toContain('Sales')
  })

  it('orders Simple Service groups with Operations before Scheduling and Workflows', () => {
    expect(sectionsFor(WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS)).toEqual(
      [
        'OVERVIEW',
        'CUSTOMERS',
        'OPERATIONS',
        'SCHEDULING',
        'WORKFLOWS',
        'ANALYTICS',
        'TEAM',
        'AI',
        'SETTINGS',
      ],
    )
  })

  it('shows commerce modules and hides service CRM modules for Product Commerce', () => {
    const groups = buildWorkspaceNavigation({
      capabilities: getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
      }),
      workspaceSlug: 'acme',
      role: 'owner',
      canViewSalesPipeline: true,
      canViewServiceRequests: true,
    })
    const labels = labelsFor(WorkspaceBusinessModel.PRODUCT_COMMERCE)

    expect(
      groups
        .find((group) => group.section === 'CUSTOMERS')
        ?.items.map((item) => item.label),
    ).toEqual(['Customers'])
    expect(
      groups
        .find((group) => group.section === 'OPERATIONS')
        ?.items.map((item) => item.label),
    ).toEqual(['Products', 'Orders', 'Fulfillment'])
    expect(labels).toContain('Customers')
    expect(labels).toContain('Products')
    expect(labels).toContain('Orders')
    expect(labels).toContain('Fulfillment')
    expect(labels).not.toContain('Leads')
    expect(labels).not.toContain('Opportunities')
    expect(labels).not.toContain('Orders Pipeline')
    expect(labels).not.toContain('Clients')
    expect(labels).not.toContain('Service Requests')
    expect(labels).not.toContain('Inventory')
    expect(labels).not.toContain('Subscriptions')
  })

  it('orders Commerce groups with Operations before Scheduling and Workflows', () => {
    expect(sectionsFor(WorkspaceBusinessModel.PRODUCT_COMMERCE)).toEqual([
      'OVERVIEW',
      'CUSTOMERS',
      'OPERATIONS',
      'WORKFLOWS',
      'ANALYTICS',
      'TEAM',
      'AI',
      'SETTINGS',
    ])
  })

  it('preserves consultative service navigation', () => {
    const labels = labelsFor(WorkspaceBusinessModel.CONSULTATIVE_SALES)

    expect(labels).toContain('Leads')
    expect(labels).toContain('Opportunities')
    expect(labels).toContain('Sales')
    expect(labels).toContain('Clients')
    expect(labels).not.toContain('Products')
    expect(labels).not.toContain('Orders')
    expect(labels).not.toContain('Fulfillment')
  })

  it('preserves direct sales service navigation without opportunities', () => {
    const labels = labelsFor(WorkspaceBusinessModel.DIRECT_SALES)

    expect(labels).toContain('Leads')
    expect(labels).not.toContain('Opportunities')
    expect(labels).toContain('Sales')
    expect(labels).toContain('Clients')
    expect(labels).not.toContain('Products')
  })

  it('orders sales workspaces with Operations before Scheduling and Workflows', () => {
    expect(sectionsFor(WorkspaceBusinessModel.DIRECT_SALES)).toEqual([
      'OVERVIEW',
      'SALES',
      'OPERATIONS',
      'SCHEDULING',
      'WORKFLOWS',
      'ANALYTICS',
      'TEAM',
      'AI',
      'SETTINGS',
    ])
    expect(sectionsFor(WorkspaceBusinessModel.CONSULTATIVE_SALES)).toEqual([
      'OVERVIEW',
      'SALES',
      'OPERATIONS',
      'SCHEDULING',
      'WORKFLOWS',
      'ANALYTICS',
      'TEAM',
      'AI',
      'SETTINGS',
    ])
  })

  it('uses stable scheduling sidebar routes for optional sections with custom labels', () => {
    const items = schedulingItemsFor({
      model: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      schedulingSettings: {
        visibleSections: [
          'calendar',
          'scheduledJobs',
          'recurringServices',
          'internalMeetings',
        ],
        sectionLabelOverrides: {
          scheduledJobs: 'Field Visits',
          recurringServices: 'Maintenance Plans',
          internalMeetings: 'Team Huddles',
        },
      },
    })

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Field Visits',
          href: '/dashboard/acme/scheduling/jobs',
        }),
        expect.objectContaining({
          label: 'Maintenance Plans',
          href: '/dashboard/acme/scheduling/recurring-services',
        }),
        expect.objectContaining({
          label: 'Team Huddles',
          href: '/dashboard/acme/scheduling/internal-meetings',
        }),
      ]),
    )
  })

  it('shows development tools only outside production for owners and admins', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const developmentGroups = buildWorkspaceNavigation({
      capabilities: getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      }),
      workspaceSlug: 'acme',
      role: 'owner',
      canViewSalesPipeline: true,
      canViewServiceRequests: true,
    })

    expect(
      developmentGroups
        .flatMap((group) => group.items)
        .find((item) => item.label === 'Development Tools'),
    ).toEqual(
      expect.objectContaining({
        href: '/dashboard/acme/admin/dev-tools',
        roles: ['owner', 'admin'],
      }),
    )

    vi.stubEnv('NODE_ENV', 'production')
    const productionLabels = labelsFor(WorkspaceBusinessModel.DIRECT_SALES)
    expect(productionLabels).not.toContain('Development Tools')
  })
})
