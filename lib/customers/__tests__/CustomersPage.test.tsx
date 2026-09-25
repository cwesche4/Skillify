import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn(),
  findProfile: vi.fn(),
  findWorkspace: vi.fn(),
  createMockClients: vi.fn(() => []),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mocks.findProfile },
    workspace: { findUnique: mocks.findWorkspace },
  },
}))
vi.mock('@/lib/clients/mockClients', () => ({
  createMockWorkspaceClients: mocks.createMockClients,
}))
vi.mock('@/lib/tasks/demoTasks', () => ({ createMockWorkspaceTasks: () => [] }))
vi.mock('@/lib/service-requests/mockServiceRequests', () => ({
  createMockServiceRequests: () => [],
}))
vi.mock('@/components/dashboard/customers/CustomersClient', () => ({
  CustomersClient: ({ workspaceId }: { workspaceId: string }) => (
    <div>Durable Customers: {workspaceId}</div>
  ),
}))
vi.mock('@/components/dashboard/clients/ClientsClient', () => ({
  ClientsClient: () => <div>Legacy Clients</div>,
}))

import ClientsPage from '@/app/dashboard/[workspaceSlug]/clients/page'

function workspace(model: string, role = 'OWNER') {
  return {
    id: 'ws-a',
    slug: 'acme',
    businessModel: model,
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

describe('Customers route workspace-model branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-a' })
    mocks.findProfile.mockResolvedValue({ id: 'user-a' })
    mocks.redirect.mockImplementation((location: string) => {
      throw new Error(`REDIRECT:${location}`)
    })
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'renders durable Simple Service Customers for %s',
    async (role) => {
      mocks.findWorkspace.mockResolvedValue(
        workspace('SIMPLE_SERVICE_BUSINESS', role),
      )
      render(await ClientsPage({ params: { workspaceSlug: 'acme' } }))

      expect(screen.getByText('Durable Customers: ws-a')).toBeTruthy()
      expect(screen.queryByText('Legacy Clients')).toBeNull()
      expect(mocks.createMockClients).not.toHaveBeenCalled()
    },
  )

  it('redirects a Simple Service Member before rendering durable Customers', async () => {
    mocks.findWorkspace.mockResolvedValue(
      workspace('SIMPLE_SERVICE_BUSINESS', 'MEMBER'),
    )
    await expect(
      ClientsPage({ params: { workspaceSlug: 'acme' } }),
    ).rejects.toThrow('REDIRECT:/dashboard/acme')
    expect(mocks.createMockClients).not.toHaveBeenCalled()
  })

  it.each(['DIRECT_SALES', 'CONSULTATIVE_SALES'])(
    'preserves the legacy Client UI for %s',
    async (model) => {
      mocks.findWorkspace.mockResolvedValue(workspace(model))
      render(await ClientsPage({ params: { workspaceSlug: 'acme' } }))

      expect(screen.getByText('Legacy Clients')).toBeTruthy()
      expect(screen.queryByText(/Durable Customers/)).toBeNull()
      expect(mocks.createMockClients).toHaveBeenCalledWith('ws-a')
    },
  )

  it('does not route Product & Commerce through the service Customer page', async () => {
    mocks.findWorkspace.mockResolvedValue(workspace('PRODUCT_COMMERCE'))

    await expect(
      ClientsPage({ params: { workspaceSlug: 'acme' } }),
    ).rejects.toThrow('REDIRECT:/dashboard/acme')
    expect(mocks.createMockClients).not.toHaveBeenCalled()
  })
})
