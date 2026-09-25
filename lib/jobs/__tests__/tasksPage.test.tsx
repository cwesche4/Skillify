import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findProfile: vi.fn(),
  findWorkspace: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mocks.findProfile },
    workspace: { findUnique: mocks.findWorkspace },
  },
}))
vi.mock('@/components/dashboard/todos/TodosClient', () => ({
  TodosClient: () => <h1>My To-Dos</h1>,
}))
vi.mock('@/components/dashboard/tasks/TasksClient', () => ({
  TasksClient: () => <h1>Legacy Tasks</h1>,
}))

import TasksPage from '@/app/dashboard/[workspaceSlug]/tasks/page'

describe('Simple Service tasks route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-a' })
    mocks.findProfile.mockResolvedValue({ id: 'user-a' })
  })

  it('renders the durable My To-Dos experience for Simple Service Business', async () => {
    mocks.findWorkspace.mockResolvedValue({
      id: 'ws-a',
      slug: 'acme',
      businessModel: 'SIMPLE_SERVICE_BUSINESS',
      members: [
        {
          id: 'member-a',
          userId: 'user-a',
          role: 'OWNER',
          user: { fullName: 'Alex Owner', email: 'alex@example.com' },
        },
      ],
    })

    render(await TasksPage({ params: { workspaceSlug: 'acme' } }))
    expect(screen.getByRole('heading', { name: 'My To-Dos' })).toBeTruthy()
    expect(screen.queryByText('Legacy Tasks')).toBeNull()
  })

  it('preserves the existing Tasks experience for other workspace models', async () => {
    mocks.findWorkspace.mockResolvedValue({
      id: 'ws-a',
      slug: 'acme',
      businessModel: 'DIRECT_SALES',
      members: [
        {
          id: 'member-a',
          userId: 'user-a',
          role: 'OWNER',
          user: { fullName: 'Alex Owner', email: 'alex@example.com' },
        },
      ],
    })

    render(await TasksPage({ params: { workspaceSlug: 'acme' } }))
    expect(screen.getByRole('heading', { name: 'Legacy Tasks' })).toBeTruthy()
    expect(screen.queryByText('My To-Dos')).toBeNull()
  })
})
