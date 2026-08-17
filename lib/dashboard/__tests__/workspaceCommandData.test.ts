import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { buildWorkspaceCommandCenterData } from '@/lib/dashboard/workspaceCommandData'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

const baseWorkspace = {
  id: 'workspace-commerce',
  name: 'Commerce Co',
  slug: 'commerce-co',
  members: [],
  automations: [],
}

describe('workspace command center data', () => {
  it('uses commerce KPIs without relabeling service CRM data', () => {
    const data = buildWorkspaceCommandCenterData({
      workspace: baseWorkspace,
      runs: [],
      capabilities: getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
      }),
    })

    expect(data.dataMode).toBe('empty')
    expect(data.commerceEnabled).toBe(true)
    expect(data.summary).toContain('Track products, customers, orders')
    expect(data.kpis.map((kpi) => kpi.label)).toEqual([
      'Customers',
      'Products',
      'Orders',
      'Revenue',
      'Gross Profit',
      'Fulfillment',
      'Active automations',
      'Failed runs',
    ])
    expect(data.kpis.find((kpi) => kpi.label === 'Customers')?.value).toBe('0')
    expect(data.kpis.find((kpi) => kpi.label === 'Products')?.helper).toBe(
      'Add products to build your catalog.',
    )
    expect(data.kpis.map((kpi) => kpi.label)).not.toContain('New leads')
    expect(data.kpis.map((kpi) => kpi.label)).not.toContain(
      'Open opportunities',
    )
    expect(data.summary).not.toContain('Phase 5')
    expect(data.leads).toEqual([])
    expect(data.recentClients).toEqual([])
    expect(data.tasksDue).toEqual([])
    expect(data.openServiceRequests).toEqual([])
    expect(data.opportunityStages).toEqual([])
    expect(data.leadSources).toEqual([])
  })

  it('builds a Service Business dashboard with customer and job terminology and no sales or opportunity entries', () => {
    const data = buildWorkspaceCommandCenterData({
      workspace: baseWorkspace,
      runs: [],
      capabilities: getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      }),
    })

    const labels = data.kpis.map((kpi) => kpi.label)
    const hrefs = data.kpis.map((kpi) => kpi.href ?? '')

    expect(data.modules).toMatchObject({
      leads: true,
      opportunities: false,
      sales: false,
      clients: true,
      serviceRequests: true,
      tasks: true,
    })
    expect(data.terminology).toMatchObject({
      customerPlural: 'Customers',
      serviceRequestPlural: 'Jobs',
      taskPlural: 'Job Steps',
    })
    expect(data.taskMetricScope).toBe('serviceRequestChildren')
    expect(labels).toEqual([
      'New Leads',
      'Active Customers',
      'Jobs',
      'Job Steps',
      'Active Automations',
      'Failed Runs',
    ])
    expect(labels).not.toContain('Open opportunities')
    expect(labels).not.toContain('Won opportunities')
    expect(labels).not.toContain('Sales')
    expect(hrefs.join(' ')).not.toContain('/opportunities')
    expect(hrefs.join(' ')).not.toContain('/sales-pipeline')
    expect(data.opportunityStages).toEqual([])
    expect(data.serviceTypes.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Service Call',
        'Follow-Up',
        'Repair',
        'Maintenance',
      ]),
    )
    expect(data.serviceRequestStatus.length).toBeGreaterThan(0)
    expect(data.serviceRequestSchedule.length).toBeGreaterThan(0)
    expect(data.revenueInsights.map((insight) => insight.label)).toContain(
      'Recognized revenue',
    )
    expect(data.revenueInsights.map((insight) => insight.label)).not.toContain(
      'Open pipeline',
    )
  })

  it('builds a Direct Sales dashboard with Sales but without Opportunities', () => {
    const data = buildWorkspaceCommandCenterData({
      workspace: baseWorkspace,
      runs: [],
      capabilities: getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      }),
    })

    const labels = data.kpis.map((kpi) => kpi.label)
    const hrefs = data.kpis.map((kpi) => kpi.href ?? '')

    expect(labels).toContain('New leads')
    expect(labels).toContain('Sales')
    expect(labels).toContain('Service Requests')
    expect(labels).toContain('Tasks due')
    expect(labels).not.toContain('Open opportunities')
    expect(labels).not.toContain('Won opportunities')
    expect(hrefs.join(' ')).toContain('/sales-pipeline')
    expect(hrefs.join(' ')).not.toContain('/opportunities')
    expect(data.opportunityStages).toEqual([])
  })

  it('preserves the full Consultative dashboard with Leads, Opportunities, Sales, and Clients', () => {
    const data = buildWorkspaceCommandCenterData({
      workspace: baseWorkspace,
      runs: [],
      capabilities: getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      }),
    })

    expect(data.kpis.map((kpi) => kpi.label)).toContain('New leads')
    expect(data.kpis.map((kpi) => kpi.label)).toContain('Open opportunities')
    expect(data.kpis.map((kpi) => kpi.label)).toContain('Sales')
    expect(data.modules?.opportunities).toBe(true)
    expect(data.modules?.sales).toBe(true)
    expect(data.opportunityStages.length).toBeGreaterThan(0)
  })

  it('wires the Analytics route through workspace capability resolution', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'app',
        'dashboard',
        '[workspaceSlug]',
        'analytics',
        'page.tsx',
      ),
      'utf8',
    )

    expect(source).toContain('getWorkspaceCapabilities')
    expect(source).toContain('businessModel: workspace.businessModel')
    expect(source).toContain('capabilities,')
    expect(source).not.toContain('description="Understand revenue, pipeline')
  })

  it('renders pipeline analytics only when opportunities are enabled', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'components',
        'dashboard',
        'command-center',
        'WorkspaceCommandCenter.tsx',
      ),
      'utf8',
    )

    expect(source).toContain('showPipeline={modules.opportunities}')
    expect(source).toContain('{modules.opportunities ? (')
    expect(source).not.toContain('modules.opportunities || modules.sales')
  })
})
