import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Notifications } from '@/components/ui/Notifications'

const notification = {
  id: 'notification-1',
  title: 'Discovery Call reminder',
  body: 'Discovery Call starts soon.',
  category: 'reminder',
  priority: 'normal',
  actionUrl: '/dashboard/acme/scheduling/calendar?event=event-1',
  readAt: null,
  archivedAt: null,
  createdAt: '2026-07-28T14:00:00.000Z',
  metadata: {
    eventTitle: 'Discovery Call',
    occurrenceId: 'occurrence-1',
    scopeSummary: 'This occurrence',
  },
}

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }),
  )
}

describe('notification center', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('filters notifications and supports detail actions', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/unread-count')) {
        return jsonResponse({ count: 1 })
      }
      if (url.includes('/notifications?')) {
        return jsonResponse({
          notifications: [notification],
          nextCursor: null,
        })
      }
      return jsonResponse({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(React.createElement(Notifications, { workspaceId: 'workspace-1' }))

    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Discovery Call reminder')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Notification status filter'), {
      target: { value: 'unread' },
    })
    fireEvent.change(screen.getByLabelText('Scheduling category filter'), {
      target: { value: 'reminder' },
    })

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('status=unread&category=reminder'),
        ),
      ).toBe(true)
    })

    fireEvent.click(screen.getByText('Discovery Call reminder'))
    expect(await screen.findByText('Notification details')).toBeTruthy()
    expect(screen.getByText('This occurrence')).toBeTruthy()

    fireEvent.click(screen.getByText('Mark unread'))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/notifications/notification-1/unread'),
        ),
      ).toBe(true)
    })

    fireEvent.click(screen.getByText('Archive'))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/notifications/notification-1/archive'),
        ),
      ).toBe(true)
    })
  })
})
