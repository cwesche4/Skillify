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
vi.mock('@/components/dashboard/jobs/JobsClient', () => ({
  JobsClient: ({
    currentMemberId,
    canManage,
    durableCustomersEnabled,
  }: {
    currentMemberId: string
    canManage: boolean
    durableCustomersEnabled: boolean
  }) => (
    <div>
      <h1>Jobs</h1>
      <span>Member: {currentMemberId}</span>
      <span>Can manage: {String(canManage)}</span>
      <span>Durable Customers: {String(durableCustomersEnabled)}</span>
    </div>
  ),
}))

import ServiceRequestsPage from '@/app/dashboard/[workspaceSlug]/service-requests/page'

describe('Simple Service Jobs page authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-member' })
    mocks.findProfile.mockResolvedValue({ id: 'user-a', role: 'user' })
    mocks.redirect.mockImplementation((location: string) => {
      throw new Error(`REDIRECT:${location}`)
    })
  })

  it('allows a Simple Service Member into read/execute Jobs with durable membership identity', async () => {
    mocks.findWorkspace.mockResolvedValue({
      id: 'ws-a',
      slug: 'acme',
      businessModel: 'SIMPLE_SERVICE_BUSINESS',
      members: [
        {
          id: 'member-a',
          userId: 'user-a',
          role: 'MEMBER',
          user: { fullName: 'Alex Member', email: 'alex@example.com' },
        },
      ],
    })

    render(await ServiceRequestsPage({ params: { workspaceSlug: 'acme' } }))

    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeTruthy()
    expect(screen.getByText('Member: member-a')).toBeTruthy()
    expect(screen.getByText('Can manage: false')).toBeTruthy()
    expect(screen.getByText('Durable Customers: true')).toBeTruthy()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('preserves the legacy Member restriction outside Simple Service workspaces', async () => {
    mocks.findWorkspace.mockResolvedValue({
      id: 'ws-a',
      slug: 'acme',
      businessModel: 'DIRECT_SALES',
      members: [
        {
          id: 'member-a',
          userId: 'user-a',
          role: 'MEMBER',
          user: { fullName: 'Alex Member', email: 'alex@example.com' },
        },
      ],
    })

    await expect(
      ServiceRequestsPage({ params: { workspaceSlug: 'acme' } }),
    ).rejects.toThrow('REDIRECT:/dashboard/acme')
  })

  it('keeps the durable Customer selector disabled for legacy workspace models', async () => {
    mocks.findWorkspace.mockResolvedValue({
      id: 'ws-a',
      slug: 'acme',
      businessModel: 'DIRECT_SALES',
      members: [
        {
          id: 'member-a',
          userId: 'user-a',
          role: 'MANAGER',
          user: { fullName: 'Alex Manager', email: 'alex@example.com' },
        },
      ],
    })

    render(await ServiceRequestsPage({ params: { workspaceSlug: 'acme' } }))

    expect(screen.getByText('Can manage: true')).toBeTruthy()
    expect(screen.getByText('Durable Customers: false')).toBeTruthy()
  })
})
