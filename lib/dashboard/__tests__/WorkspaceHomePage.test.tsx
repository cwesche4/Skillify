import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findProfile: vi.fn(),
  findWorkspace: vi.fn(),
  findAutomations: vi.fn(),
  getSettings: vi.fn(),
  loadOperationalDashboard: vi.fn(),
  buildCommandCenter: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mocks.findProfile },
    workspace: { findFirst: mocks.findWorkspace },
    automation: { findMany: mocks.findAutomations },
  },
}))
vi.mock('@/lib/scheduling/services/schedulingService', () => ({
  getPersistedSchedulingSettings: mocks.getSettings,
}))
vi.mock('@/lib/dashboard/operationalDashboard', () => ({
  loadOperationalDashboard: mocks.loadOperationalDashboard,
}))
vi.mock('@/lib/dashboard/workspaceCommandData', () => ({
  buildWorkspaceCommandCenterData: mocks.buildCommandCenter,
}))
vi.mock('@/lib/workspaces/getWorkspaceCapabilities', () => ({
  getWorkspaceCapabilities: () => ({ scheduling: { enabled: true } }),
}))
vi.mock('@/components/dashboard/DashboardShell', () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))
vi.mock('@/components/dashboard/operations/OperationalDashboard', () => ({
  OperationalDashboard: ({ data }: { data: { mode: string } }) => (
    <div>Operational dashboard: {data.mode}</div>
  ),
}))
vi.mock('@/components/dashboard/command-center/WorkspaceCommandCenter', () => ({
  WorkspaceCommandCenter: () => <div>Legacy command center</div>,
}))
vi.mock('@/components/workspaces/WorkspaceSetup', () => ({
  WorkspaceSetup: () => null,
}))
vi.mock('@/components/upsell/BuildRequestCallout', () => ({
  BuildRequestCallout: () => null,
}))

import WorkspaceHomePage from '@/app/dashboard/[workspaceSlug]/page'

function workspace(businessModel = 'SIMPLE_SERVICE_BUSINESS', role = 'MEMBER') {
  return {
    id: 'workspace-a',
    name: 'Acme',
    businessName: 'Acme Services',
    slug: 'acme',
    industry: 'Home services',
    businessModel,
    members: [{ id: 'member-a', userId: 'user-a', role }],
  }
}

describe('workspace home dashboard authorization and model routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-a' })
    mocks.findProfile.mockResolvedValue({ id: 'user-a' })
    mocks.getSettings.mockResolvedValue({ timezone: 'America/Chicago' })
    mocks.loadOperationalDashboard.mockResolvedValue({ mode: 'member' })
    mocks.buildCommandCenter.mockReturnValue({})
  })

  it('scopes the workspace read to the authenticated membership before rendering', async () => {
    mocks.findWorkspace.mockResolvedValue(null)

    const result = await WorkspaceHomePage({
      params: { workspaceSlug: 'foreign-workspace' },
    })

    expect(result).toBeNull()
    expect(mocks.findWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'foreign-workspace',
          members: { some: { userId: 'user-a' } },
        },
      }),
    )
    expect(mocks.loadOperationalDashboard).not.toHaveBeenCalled()
  })

  it('uses the role-aware operational dashboard only for Simple Service', async () => {
    mocks.findWorkspace.mockResolvedValue(workspace())

    render(await WorkspaceHomePage({ params: { workspaceSlug: 'acme' } }))

    expect(screen.getByText('Operational dashboard: member')).toBeTruthy()
    expect(mocks.loadOperationalDashboard).toHaveBeenCalledWith({
      workspaceId: 'workspace-a',
      workspaceSlug: 'acme',
      workspaceName: 'Acme Services',
      workspaceMemberId: 'member-a',
      role: 'MEMBER',
      timezone: 'America/Chicago',
    })
    expect(mocks.findAutomations).not.toHaveBeenCalled()
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'passes authenticated %s membership authority to the Simple Service loader',
    async (role) => {
      mocks.findWorkspace.mockResolvedValue(
        workspace('SIMPLE_SERVICE_BUSINESS', role),
      )
      mocks.loadOperationalDashboard.mockResolvedValue({ mode: 'management' })

      render(await WorkspaceHomePage({ params: { workspaceSlug: 'acme' } }))

      expect(screen.getByText('Operational dashboard: management')).toBeTruthy()
      expect(mocks.loadOperationalDashboard).toHaveBeenCalledWith(
        expect.objectContaining({ role, workspaceMemberId: 'member-a' }),
      )
    },
  )

  it('retains the existing command center for management in other workspace models', async () => {
    mocks.findWorkspace.mockResolvedValue(workspace('DIRECT_SALES', 'MANAGER'))
    mocks.findAutomations.mockResolvedValue([])

    render(await WorkspaceHomePage({ params: { workspaceSlug: 'acme' } }))

    expect(screen.getByText('Legacy command center')).toBeTruthy()
    expect(mocks.loadOperationalDashboard).not.toHaveBeenCalled()
    expect(mocks.findAutomations).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'workspace-a' } }),
    )
  })

  it('does not load generic Automation history for a Member command center', async () => {
    mocks.findWorkspace.mockResolvedValue(workspace('DIRECT_SALES', 'MEMBER'))

    render(await WorkspaceHomePage({ params: { workspaceSlug: 'acme' } }))

    expect(screen.getByText('Legacy command center')).toBeTruthy()
    expect(mocks.findAutomations).not.toHaveBeenCalled()
    expect(mocks.buildCommandCenter).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({ automations: [] }),
        runs: [],
      }),
    )
  })
})
