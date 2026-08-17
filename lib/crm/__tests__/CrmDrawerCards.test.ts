import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock(
  '@/components/dashboard/workspace-insights/WorkspaceInsightCharts',
  () => ({
    RecordTimeline: ({
      events,
    }: {
      events: Array<{ id: string; title: string; description: string }>
    }) =>
      React.createElement(
        'div',
        {},
        events.map((event) =>
          React.createElement(
            'article',
            { key: event.id },
            React.createElement('h4', {}, event.title),
            React.createElement('p', {}, event.description),
          ),
        ),
      ),
  }),
)

import {
  CompactActivityTimeline,
  NotesCard,
} from '@/components/crm/CrmDrawerCards'

describe('CRM drawer cards', () => {
  it('renders notes compactly and enters edit mode from content or edit button', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      React.createElement(NotesCard, {
        title: 'Client Notes',
        description: 'Shared throughout the customer relationship.',
        value: 'Prefers text messages.',
        onSave,
      }),
    )

    expect(screen.getByText('Client Notes')).toBeTruthy()
    expect(
      screen.getByText('Shared throughout the customer relationship.'),
    ).toBeTruthy()
    await user.click(screen.getByText('Prefers text messages.'))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Prefers text messages.',
    )

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await user.click(
      screen.getByLabelText('Edit Client Notes', { selector: 'button' }),
    )
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('shows empty note copy, saves edits, and preserves drafts after failed saves', async () => {
    const user = userEvent.setup()
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('Nope'))
      .mockResolvedValue(undefined)
    render(
      React.createElement(NotesCard, {
        title: 'Lead Notes',
        description: 'Only for qualifying and following up with this Lead.',
        value: '',
        onSave,
      }),
    )

    expect(screen.getByText('Click to add notes.')).toBeTruthy()
    await user.click(screen.getByText('Click to add notes.'))
    await user.type(screen.getByRole('textbox'), 'Needs follow-up.')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/could not save notes/i)).toBeTruthy()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Needs follow-up.',
    )

    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
  })

  it('limits compact activity to three items until expanded', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(CompactActivityTimeline, {
        events: [1, 2, 3, 4].map((item) => ({
          id: `event-${item}`,
          title: `Activity ${item}`,
          description: `Detail ${item}`,
          timestamp: `2026-07-2${item}T10:00:00.000Z`,
          category: 'Client Activity',
        })),
      }),
    )

    expect(screen.getByText('Activity 4')).toBeTruthy()
    expect(screen.getByText('Activity 2')).toBeTruthy()
    expect(screen.queryByText('Activity 1')).toBeNull()

    await user.click(screen.getByRole('button', { name: /view all activity/i }))
    expect(screen.getByText('Activity 1')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: /show less activity/i }),
    )
    expect(screen.queryByText('Activity 1')).toBeNull()
  })
})
