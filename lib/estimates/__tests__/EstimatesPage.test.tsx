import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn(),
  findProfile: vi.fn(),
  findWorkspace: vi.fn(),
  findMembers: vi.fn(),
  findTeams: vi.fn(),
  getSchedulingSettings: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mocks.findProfile },
    workspace: { findUnique: mocks.findWorkspace },
    workspaceMember: { findMany: mocks.findMembers },
    workspaceTeam: { findMany: mocks.findTeams },
  },
}))
vi.mock('@/lib/scheduling/services/schedulingService', () => ({
  getPersistedSchedulingSettings: mocks.getSchedulingSettings,
}))
vi.mock('@/components/dashboard/DashboardShell', () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/dashboard/estimates/EstimatesClient', () => ({
  EstimatesClient: ({ workspaceId }: { workspaceId: string }) => (
    <h1>Estimates for {workspaceId}</h1>
  ),
}))

import EstimatesPage from '@/app/dashboard/[workspaceSlug]/estimates/page'

describe('Estimate page authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-user' })
    mocks.findProfile.mockResolvedValue({ id: 'profile-user' })
    mocks.findMembers.mockResolvedValue([])
    mocks.findTeams.mockResolvedValue([])
    mocks.getSchedulingSettings.mockResolvedValue({ timezone: 'UTC' })
    mocks.redirect.mockImplementation((location: string) => {
      throw new Error(`REDIRECT:${location}`)
    })
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'allows a Simple Service %s to open the management list',
    async (role) => {
      mocks.findWorkspace.mockResolvedValue({
        id: 'ws-a',
        slug: 'acme',
        businessModel: 'SIMPLE_SERVICE_BUSINESS',
        members: [{ role }],
      })

      render(
        await EstimatesPage({
          params: { workspaceSlug: 'acme' },
          searchParams: {},
        }),
      )

      expect(
        screen.getByRole('heading', { name: 'Estimates for ws-a' }),
      ).toBeTruthy()
      expect(mocks.redirect).not.toHaveBeenCalled()
    },
  )

  it.each(['MEMBER', 'UNKNOWN'])(
    'fails closed for %s without rendering commercial data',
    async (role) => {
      mocks.findWorkspace.mockResolvedValue({
        id: 'ws-a',
        slug: 'acme',
        businessModel: 'SIMPLE_SERVICE_BUSINESS',
        members: [{ role }],
      })

      await expect(
        EstimatesPage({
          params: { workspaceSlug: 'acme' },
          searchParams: {},
        }),
      ).rejects.toThrow('REDIRECT:/dashboard/acme')
    },
  )
})
