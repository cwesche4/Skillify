import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const guardedRoutes = [
  'app/api/automations/[automationId]/route.ts',
  'app/api/automations/[automationId]/flow/route.ts',
  'app/api/automations/[automationId]/heatmap/route.ts',
  'app/api/automations/[automationId]/runs/route.ts',
  'app/api/automations/[automationId]/runs/[runId]/route.ts',
  'app/api/automations/[automationId]/runs/[runId]/events/route.ts',
  'app/api/automations/[automationId]/runs/[runId]/json/route.ts',
  'app/api/workspaces/[workspaceId]/activity/route.ts',
  'app/api/workspaces/[workspaceId]/automations/[automationId]/versions/route.ts',
  'app/api/workspaces/[workspaceId]/automations/[automationId]/versions/[versionId]/route.ts',
  'app/api/workspaces/[workspaceId]/automations/[automationId]/collab/snapshot/route.ts',
  'app/api/workspaces/[workspaceId]/automations/[automationId]/presence/route.ts',
  'app/api/dashboard/summary/route.ts',
  'app/api/ai-coach/anomalies/route.ts',
  'app/api/ai-coach/cost/route.ts',
  'app/api/ai-coach/flow/route.ts',
  'app/api/ai/heatmap-insights/route.ts',
  'app/api/analytics/stream/route.ts',
  'app/api/workspaces/[workspaceId]/coach/live/route.ts',
  'app/api/workspaces/[workspaceId]/coach/live/stream/route.ts',
]

const managementScopedQueryRoutes = [
  'app/api/automations/route.ts',
  'app/api/ai/alerts/route.ts',
  'app/api/ai/explain/[runId]/route.ts',
  'app/api/command-center/search/route.ts',
  'app/dashboard/[workspaceSlug]/automations/advanced/page.tsx',
  'components/automations/AdvancedExecutionsPage.tsx',
  'app/dashboard/[workspaceSlug]/automations/[automationId]/compare/page.tsx',
  'app/dashboard/[workspaceSlug]/automations/[automationId]/runs/page.tsx',
  'app/dashboard/[workspaceSlug]/ai-coach/page.tsx',
]

describe('generic Automation history controlled-launch authorization', () => {
  it.each(guardedRoutes)('requires management access in %s', (relativePath) => {
    const contents = fs.readFileSync(
      path.join(process.cwd(), relativePath),
      'utf8',
    )
    expect(contents).toContain("access: 'manage'")
    expect(contents).not.toContain("access: 'view'")
  })

  it.each(managementScopedQueryRoutes)(
    'database-scopes generic Automation data to management roles in %s',
    (relativePath) => {
      const contents = fs.readFileSync(
        path.join(process.cwd(), relativePath),
        'utf8',
      )
      expect(contents).toContain('AUTOMATION_MANAGEMENT_ROLES')
      expect(contents).toContain(
        'role: { in: [...AUTOMATION_MANAGEMENT_ROLES] }',
      )
    },
  )

  it('authorizes Command Center automation metrics before loading workspace data', () => {
    const contents = fs.readFileSync(
      path.join(process.cwd(), 'app/api/command-center/ai/route.ts'),
      'utf8',
    )
    const authorization = contents.indexOf('authorizeWorkspaceAccess({')
    const automationQuery = contents.indexOf('prisma.automation.count({')
    const runQuery = contents.indexOf('prisma.automationRun.findMany({')

    expect(contents).toContain("access: 'manage'")
    expect(authorization).toBeGreaterThan(-1)
    expect(authorization).toBeLessThan(automationQuery)
    expect(authorization).toBeLessThan(runQuery)
  })

  it('bounds legacy Automation configuration history reads', () => {
    const automationRoute = fs.readFileSync(
      path.join(process.cwd(), 'app/api/automations/[automationId]/route.ts'),
      'utf8',
    )
    const versionsRoute = fs.readFileSync(
      path.join(
        process.cwd(),
        'app/api/workspaces/[workspaceId]/automations/[automationId]/versions/route.ts',
      ),
      'utf8',
    )
    const liveCoach = fs.readFileSync(
      path.join(process.cwd(), 'lib/analytics/liveCoach.ts'),
      'utf8',
    )

    expect(automationRoute).toContain('take: 100')
    expect(versionsRoute).toContain('take: 100')
    expect(liveCoach).toContain('take: 1000')
  })

  it.each([
    'app/dashboard/[workspaceSlug]/automations/[automationId]/page.tsx',
    'app/dashboard/[workspaceSlug]/automations/[automationId]/runs/[runId]/page.tsx',
    'app/dashboard/[workspaceSlug]/analytics/layout.tsx',
    'app/dashboard/[workspaceSlug]/page.tsx',
  ])('applies the management policy before rendering history in %s', (file) => {
    const contents = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
    expect(contents).toContain('canManageAutomations')
  })
})
