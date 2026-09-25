import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn(),
  findProfile: vi.fn(),
  findWorkspace: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mocks.findProfile },
    workspace: { findUnique: mocks.findWorkspace },
  },
}))
vi.mock('@/components/dashboard/leads/DurableLeadsClient', () => ({
  DurableLeadsClient: ({ workspaceId }: { workspaceId: string }) => (
    <div>Durable Leads: {workspaceId}</div>
  ),
}))
vi.mock('@/components/dashboard/sales/LeadsClient', () => ({
  LeadsClient: () => <div>Legacy Leads</div>,
}))

import LeadsPage from '@/app/dashboard/[workspaceSlug]/leads/page'

function workspace(model: string, role = 'OWNER') {
  return {
    id: 'ws-a',
    slug: 'acme',
    businessModel: model,
    timezone: 'America/New_York',
    members: [
      {
        id: 'member-a',
        userId: 'user-a',
        role,
        user: { fullName: 'Alex User', email: 'alex@example.com' },
      },
    ],
  }
}

describe('Leads route workspace-model branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-a' })
    mocks.findProfile.mockResolvedValue({ id: 'user-a' })
    mocks.redirect.mockImplementation((location: string) => {
      throw new Error(`REDIRECT:${location}`)
    })
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'renders durable Simple Service Leads for %s',
    async (role) => {
      mocks.findWorkspace.mockResolvedValue(
        workspace('SIMPLE_SERVICE_BUSINESS', role),
      )
      render(await LeadsPage({ params: { workspaceSlug: 'acme' } }))
      expect(screen.getByText('Durable Leads: ws-a')).toBeTruthy()
      expect(screen.queryByText('Legacy Leads')).toBeNull()
    },
  )

  it('redirects a Simple Service Member', async () => {
    mocks.findWorkspace.mockResolvedValue(
      workspace('SIMPLE_SERVICE_BUSINESS', 'MEMBER'),
    )
    await expect(
      LeadsPage({ params: { workspaceSlug: 'acme' } }),
    ).rejects.toThrow('REDIRECT:/dashboard/acme')
  })

  it.each(['DIRECT_SALES', 'CONSULTATIVE_SALES'])(
    'preserves legacy Leads for %s',
    async (model) => {
      mocks.findWorkspace.mockResolvedValue(workspace(model, 'MEMBER'))
      render(await LeadsPage({ params: { workspaceSlug: 'acme' } }))
      expect(screen.getByText('Legacy Leads')).toBeTruthy()
      expect(screen.queryByText(/Durable Leads/)).toBeNull()
    },
  )

  it('leaves Product & Commerce outside the Leads route', async () => {
    mocks.findWorkspace.mockResolvedValue(workspace('PRODUCT_COMMERCE'))
    await expect(
      LeadsPage({ params: { workspaceSlug: 'acme' } }),
    ).rejects.toThrow('REDIRECT:/dashboard/acme')
  })
})
