import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AddNodeModal from '@/app/dashboard/[workspaceSlug]/automations/[automationId]/builder/components/AddNodeModal'

function renderModal(
  props: Partial<React.ComponentProps<typeof AddNodeModal>> = {},
) {
  return render(
    React.createElement(AddNodeModal, {
      open: true,
      plan: 'elite',
      onClose: () => {},
      onAddNode: () => {},
      ...props,
    }),
  )
}

describe('AddNodeModal discovery UX', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows primary type filters and secondary domain filters', () => {
    renderModal()

    expect(
      screen
        .getByRole('tab', { name: 'Triggers' })
        .getAttribute('aria-selected'),
    ).toBe('false')
    expect(
      screen
        .getByRole('tab', { name: 'Scheduling' })
        .getAttribute('aria-selected'),
    ).toBe('false')
    expect(screen.getByText(/Browsing all workflow steps/i)).toBeTruthy()
  })

  it('uses primary node types as top-level groups for All Types + Scheduling', async () => {
    const user = userEvent.setup()
    renderModal({ initialCategory: 'Scheduling' })

    expect(
      screen
        .getByRole('tab', { name: 'Scheduling' })
        .getAttribute('aria-selected'),
    ).toBe('true')
    expect(screen.getByText(/Browsing Scheduling/i)).toBeTruthy()
    const triggers = screen.getByRole('button', { name: /^Triggers \d+$/i })
    const actions = screen.getByRole('button', { name: /^Actions \d+$/i })
    expect(triggers.getAttribute('aria-expanded')).toBe('true')
    expect(actions.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: /Event Triggers/i })).toBeNull()
    expect(screen.getByText('Events')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Add Event Created' }),
    ).toBeTruthy()

    await user.click(actions)
    expect(actions.getAttribute('aria-expanded')).toBe('true')
    expect(
      screen.getByRole('button', { name: 'Add Create Event' }),
    ).toBeTruthy()
  })

  it('uses primary node types as top-level groups for All Types + All Domains', () => {
    renderModal()

    const triggers = screen.getByRole('button', { name: /^Triggers \d+$/i })
    expect(triggers.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByText('Scheduling').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Business / CRM').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Event Triggers/i })).toBeNull()
  })

  it('uses concise Scheduling concepts when a specific type is selected', async () => {
    const user = userEvent.setup()
    renderModal({ initialCategory: 'Scheduling' })

    await user.click(screen.getByRole('tab', { name: 'Triggers' }))
    expect(screen.getByText(/Browsing Scheduling triggers/i)).toBeTruthy()
    const events = screen.getByRole('button', { name: /^Events \d+$/i })
    expect(events.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('button', { name: /Event Triggers/i })).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    expect(screen.getByRole('button', { name: /^Events \d+$/i })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /^Recurring Events \d+$/i }),
    ).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Conditions' }))
    expect(
      screen.getByRole('button', { name: /^Availability \d+$/i }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /^Conflicts \d+$/i }),
    ).toBeTruthy()
  })

  it('collapses and expands group panels without treating focus as expanded', async () => {
    const user = userEvent.setup()
    renderModal({ initialCategory: 'Scheduling' })

    const triggers = screen.getByRole('button', { name: /^Triggers \d+$/i })
    const actions = screen.getByRole('button', { name: /^Actions \d+$/i })
    expect(
      screen.getByRole('button', { name: 'Add Event Created' }),
    ).toBeTruthy()
    expect(actions.getAttribute('aria-expanded')).toBe('false')
    actions.focus()
    expect(actions.getAttribute('aria-expanded')).toBe('false')
    expect(
      screen.queryByRole('button', { name: 'Add Create Event' }),
    ).toBeNull()

    await user.click(triggers)
    expect(triggers.getAttribute('aria-expanded')).toBe('false')
    expect(
      screen.queryByRole('button', { name: 'Add Event Created' }),
    ).toBeNull()
    await user.click(actions)
    expect(actions.getAttribute('aria-expanded')).toBe('true')
    expect(
      screen.getByRole('button', { name: 'Add Create Event' }),
    ).toBeTruthy()
  })

  it('filters Scheduling actions with deterministic search and does not show CRM matches', async () => {
    const user = userEvent.setup()
    renderModal({ initialCategory: 'Scheduling' })

    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    await user.type(
      screen.getByPlaceholderText(/Search triggers, actions, conditions/i),
      'assign',
    )

    expect(screen.getByText(/Search results for "assign"/i)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Add Assign Member' }),
    ).toBeTruthy()
    expect(screen.getByText(/Assign Team/i)).toBeTruthy()
    expect(screen.queryByText('Create Task')).toBeNull()
  })

  it('keeps pointer hover transient and separate from keyboard-active state', async () => {
    const user = userEvent.setup()
    renderModal({ initialCategory: 'Scheduling' })

    const eventCard = screen.getByRole('button', { name: 'Add Event Created' })
    expect(eventCard.getAttribute('data-node-card-state')).toBe('default')
    expect(eventCard.getAttribute('data-keyboard-active')).toBe('false')

    await user.hover(eventCard)
    expect(eventCard.getAttribute('data-node-card-state')).toBe('default')
    await user.unhover(eventCard)
    expect(eventCard.getAttribute('data-node-card-state')).toBe('default')

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(
      screen
        .getAllByRole('button', { name: /^Add / })
        .some(
          (button) => button.getAttribute('data-keyboard-active') === 'true',
        ),
    ).toBe(true)

    await user.hover(eventCard)
    expect(
      screen
        .getAllByRole('button', { name: /^Add / })
        .some(
          (button) => button.getAttribute('data-keyboard-active') === 'true',
        ),
    ).toBe(false)
  })

  it('uses context-aware card metadata without repeating active filters and groups', async () => {
    const user = userEvent.setup()
    renderModal({ initialCategory: 'Scheduling' })

    const allTypesSchedulingCard = screen.getByRole('button', {
      name: 'Add Event Created',
    })
    expect(within(allTypesSchedulingCard).getByText('Trigger')).toBeTruthy()
    expect(within(allTypesSchedulingCard).queryByText('Scheduling')).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Triggers' }))
    const specificCard = screen.getByRole('button', {
      name: 'Add Event Created',
    })
    expect(within(specificCard).getByText('Event trigger')).toBeTruthy()
    expect(
      within(specificCard).queryByText(/Triggers · Event Triggers/i),
    ).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'All Domains' }))
    const allDomainCard = screen.getByRole('button', {
      name: 'Add Event Created',
    })
    expect(within(allDomainCard).getByText('Scheduling')).toBeTruthy()
    expect(within(allDomainCard).queryByText('Trigger')).toBeNull()
  })

  it('uses browse/search wording and singular result counts correctly', async () => {
    const user = userEvent.setup()
    renderModal({ initialCategory: 'Scheduling' })

    await user.click(screen.getByRole('tab', { name: 'Conditions' }))
    expect(screen.getByText(/Browsing Scheduling conditions/i)).toBeTruthy()

    await user.type(
      screen.getByPlaceholderText(/Search triggers, actions, conditions/i),
      'workspace_calendar_approved',
    )
    expect(
      screen.getByText(/Search results for "workspace_calendar_approved"/i),
    ).toBeTruthy()
    expect(screen.getByText('1 result')).toBeTruthy()

    await user.clear(
      screen.getByPlaceholderText(/Search triggers, actions, conditions/i),
    )
    expect(screen.getByText(/Browsing Scheduling conditions/i)).toBeTruthy()
    expect(screen.getByText(/\d+ steps/i)).toBeTruthy()
  })

  it('does not select a node when toggling favorite and persists the favorite', async () => {
    const user = userEvent.setup()
    const onAddNode = vi.fn()
    const { unmount } = renderModal({ onAddNode })

    await user.type(
      screen.getByPlaceholderText(/Search triggers, actions, conditions/i),
      'Send Email',
    )
    await user.click(
      screen.getByRole('button', { name: 'Add Send Email to favorites' }),
    )
    expect(onAddNode).not.toHaveBeenCalled()

    unmount()
    renderModal({ onAddNode })

    const favorites = screen.getByRole('button', { name: /^Favorites 1$/i })
    expect(favorites.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Add Send Email' })).toBeTruthy()
  })

  it('activates cards once through pointer, Enter, and Space while disabled nodes do not add', async () => {
    const user = userEvent.setup()
    const onAddNode = vi.fn()
    const { unmount } = renderModal({
      onAddNode,
      initialCategory: 'Scheduling',
    })

    await user.click(screen.getByRole('button', { name: 'Add Event Created' }))
    expect(onAddNode).toHaveBeenCalledTimes(1)

    unmount()
    onAddNode.mockClear()
    renderModal({ onAddNode, initialCategory: 'Scheduling' })
    const eventCard = screen.getByRole('button', { name: 'Add Event Created' })
    eventCard.focus()
    fireEvent.keyDown(eventCard, { key: 'Enter' })
    expect(onAddNode).toHaveBeenCalledTimes(1)

    onAddNode.mockClear()
    fireEvent.keyDown(eventCard, { key: ' ' })
    expect(onAddNode).toHaveBeenCalledTimes(1)

    onAddNode.mockClear()
    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    await user.type(
      screen.getByPlaceholderText(/Search triggers, actions, conditions/i),
      'assign team',
    )
    const comingSoon = screen
      .getByText('Assign Team')
      .closest('[role="button"]') as HTMLElement
    expect(comingSoon.getAttribute('aria-disabled')).toBe('true')
    await user.click(comingSoon)
    expect(onAddNode).not.toHaveBeenCalled()
  })

  it('lets requires-auth nodes remain selectable while showing their badge', async () => {
    const user = userEvent.setup()
    const onAddNode = vi.fn()
    renderModal({ onAddNode, initialCategory: 'Scheduling' })

    await user.click(screen.getByRole('tab', { name: 'Integrations' }))
    await user.type(
      screen.getByPlaceholderText(/Search triggers, actions, conditions/i),
      'connect calendar',
    )
    expect(screen.getByText('Requires auth')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Add Connect Calendar' }),
    )
    expect(onAddNode).toHaveBeenCalledWith(
      'crm-action',
      'scheduling.action.connect_calendar',
    )
  })

  it('keeps favorite star activation independent from parent card activation and focus', async () => {
    const user = userEvent.setup()
    const onAddNode = vi.fn()
    renderModal({ onAddNode })

    await user.type(
      screen.getByPlaceholderText(/Search triggers, actions, conditions/i),
      'Send Email',
    )
    const star = screen.getByRole('button', {
      name: 'Add Send Email to favorites',
    })
    star.focus()
    fireEvent.keyDown(star, { key: 'Enter' })
    await user.click(star)
    expect(onAddNode).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Remove Send Email from favorites' }),
    ).toBeTruthy()
  })

  it('records recent nodes and selects through the same Add Step callback', async () => {
    const user = userEvent.setup()
    const onAddNode = vi.fn()
    const { unmount } = renderModal({ onAddNode })

    await user.type(
      screen.getByPlaceholderText(/Search triggers, actions, conditions/i),
      'Create Task',
    )
    await user.click(screen.getByRole('button', { name: 'Add Create Task' }))
    expect(onAddNode).toHaveBeenCalledWith('crm-action', 'task.create')

    unmount()
    renderModal({ onAddNode })

    const recentSection = screen.getByRole('button', { name: /Recent/i })
    expect(recentSection.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Add Create Task' })).toBeTruthy()
  })

  it('shows no-result recovery actions under active filters', async () => {
    const user = userEvent.setup()
    renderModal({ initialCategory: 'Scheduling' })

    await user.click(screen.getByRole('tab', { name: 'Conditions' }))
    await user.type(
      screen.getByPlaceholderText(/Search triggers, actions, conditions/i),
      'not-a-real-step',
    )

    expect(screen.getByText(/No matching scheduling conditions/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Search all types' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Search all domains' }),
    ).toBeTruthy()
  })

  it('keeps controls outside the dedicated results scroll body', () => {
    renderModal({ initialCategory: 'Scheduling' })

    const scrollBody = screen.getByTestId('add-step-results-scroll')
    expect(scrollBody.className).toContain('overflow-y-auto')
    expect(scrollBody.className).toContain('min-h-0')
    expect(scrollBody.className).toContain('pb-6')
    expect(
      scrollBody.contains(
        screen.getByRole('button', { name: /^Triggers \d+$/i }),
      ),
    ).toBe(true)
    expect(
      scrollBody.contains(
        screen.getByPlaceholderText(/Search triggers, actions, conditions/i),
      ),
    ).toBe(false)
    expect(
      scrollBody.contains(screen.getByRole('tab', { name: 'Actions' })),
    ).toBe(false)
  })

  it('keeps expanded group styling separate from focus-visible semantics', () => {
    renderModal({ initialCategory: 'Scheduling' })

    const triggers = screen.getByRole('button', { name: /^Triggers \d+$/i })
    const panelId = triggers.getAttribute('aria-controls')
    expect(triggers.getAttribute('aria-expanded')).toBe('true')
    expect(panelId).toBeTruthy()
    expect(document.getElementById(panelId!)).toBeTruthy()
    expect(triggers.className).toContain('bg-slate-900/85')
    expect(triggers.className).toContain('focus-visible:ring')

    const actions = screen.getByRole('button', { name: /^Actions \d+$/i })
    expect(actions.getAttribute('aria-expanded')).toBe('false')
    expect(actions.className).not.toContain('bg-slate-900/75')
  })
})
