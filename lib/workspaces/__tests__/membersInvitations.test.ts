import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MemberList from '@/app/dashboard/[workspaceSlug]/settings/members/MemberList'
import {
  PendingInvitationsList,
  type PendingInviteRow,
} from '@/app/dashboard/[workspaceSlug]/settings/members/PendingInvitationsList'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('members and pending invitations organization', () => {
  it('renders active members separately from pending invitations with shared role labels', () => {
    const invites: PendingInviteRow[] = [
      {
        id: 'invite-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        status: 'pending',
        expiresAt: '2026-08-10T00:00:00.000Z',
        createdAt: '2026-08-03T00:00:00.000Z',
      },
    ]

    render(
      React.createElement(
        'div',
        null,
        React.createElement(MemberList, {
          workspaceId: 'workspace-1',
          workspaceSlug: 'acme',
          currentRole: 'OWNER',
          members: [
            {
              id: 'member-owner',
              role: 'OWNER',
              userId: 'user-owner',
              fullName: 'Owner User',
              email: 'owner@example.com',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            {
              id: 'member-manager',
              role: 'MANAGER',
              userId: 'user-manager',
              fullName: 'Morgan Manager',
              email: 'manager@example.com',
              createdAt: '2026-02-01T00:00:00.000Z',
            },
          ],
        }),
        React.createElement(PendingInvitationsList, {
          workspaceId: 'workspace-1',
          currentRole: 'OWNER',
          invites,
        }),
      ),
    )

    const active = screen.getByRole('heading', { name: /active members/i })
      .parentElement?.parentElement
    const pending = screen.getByRole('heading', {
      name: /pending invitations/i,
    }).parentElement?.parentElement

    expect(within(active as HTMLElement).getByText(/2 active/i)).toBeTruthy()
    expect(screen.getByText('Morgan Manager')).toBeTruthy()
    expect(screen.getByDisplayValue('Manager')).toBeTruthy()
    expect(within(pending as HTMLElement).getByText(/1 pending/i)).toBeTruthy()
    expect(screen.getByText('admin@example.com')).toBeTruthy()
    expect(screen.queryByText(/token/i)).toBeNull()
    expect(screen.queryByText(/secret/i)).toBeNull()
  })

  it('uses real workspace-scoped APIs for invitation resend, role change, and cancel', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const onChanged = vi.fn()
    const user = userEvent.setup()

    render(
      React.createElement(PendingInvitationsList, {
        workspaceId: 'workspace-1',
        currentRole: 'OWNER',
        onChanged,
        invites: [
          {
            id: 'invite-1',
            email: 'manager@example.com',
            role: 'MANAGER',
            status: 'pending',
            expiresAt: '2026-08-10T00:00:00.000Z',
            createdAt: '2026-08-03T00:00:00.000Z',
          },
        ],
      }),
    )

    await user.click(screen.getByRole('button', { name: /resend/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/workspaces/workspace-1/invite',
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      email: 'manager@example.com',
      role: 'MANAGER',
    })

    await user.selectOptions(
      screen.getByLabelText(/change invited role/i),
      'ADMIN',
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/workspaces/workspace-1/invite',
    )
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      inviteId: 'invite-1',
      role: 'ADMIN',
    })

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[2][0]).toBe(
      '/api/workspaces/workspace-1/invites?inviteId=invite-1',
    )
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE')
  })

  it('hides invitation management controls for unauthorized members', () => {
    render(
      React.createElement(PendingInvitationsList, {
        workspaceId: 'workspace-1',
        currentRole: 'MANAGER',
        invites: [
          {
            id: 'invite-1',
            email: 'member@example.com',
            role: 'MEMBER',
            status: 'pending',
            expiresAt: '2026-08-10T00:00:00.000Z',
            createdAt: '2026-08-03T00:00:00.000Z',
          },
        ],
      }),
    )

    expect(screen.queryByRole('button', { name: /resend/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
    expect(screen.queryByLabelText(/change invited role/i)).toBeNull()
    expect(screen.getByText('Member')).toBeTruthy()
  })
})
