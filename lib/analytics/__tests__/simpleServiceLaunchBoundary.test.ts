import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('Simple Service controlled-launch reporting boundary', () => {
  it('hides Analytics navigation and enforces direct server-route redirects', () => {
    const navigation = source('lib/workspaces/workspaceNavigation.ts')
    const analyticsLayout = source(
      'app/dashboard/[workspaceSlug]/analytics/layout.tsx',
    )
    const reportsPage = source('app/dashboard/[workspaceSlug]/reports/page.tsx')

    const simpleServiceBranch = navigation.slice(
      navigation.indexOf('case WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS'),
      navigation.indexOf('case WorkspaceBusinessModel.PRODUCT_COMMERCE'),
    )
    expect(simpleServiceBranch).not.toContain('analyticsGroup(workspaceSlug)')
    expect(analyticsLayout).toContain(
      "workspace.businessModel === 'SIMPLE_SERVICE_BUSINESS'",
    )
    expect(analyticsLayout).toContain(
      'redirect(`/dashboard/${params.workspaceSlug}`)',
    )
    expect(reportsPage).toContain(
      "workspace.businessModel === 'SIMPLE_SERVICE_BUSINESS'",
    )
    expect(reportsPage).toContain('redirect(`/dashboard/${workspace.slug}`)')
  })

  it('does not add a revenue write path to the launch boundary', () => {
    const changedBoundary = [
      source('app/dashboard/[workspaceSlug]/analytics/layout.tsx'),
      source('app/dashboard/[workspaceSlug]/reports/page.tsx'),
      source('lib/workspaces/workspaceNavigation.ts'),
    ].join('\n')
    expect(changedBoundary).not.toMatch(
      /revenueTransaction\.(create|upsert|update)/,
    )
  })
})
