import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  InspectorHeader,
  computeInspectorOptionsMenuPosition,
} from '@/lib/builder/inspector/components/InspectorHeader'

const baseProps = {
  meta: {
    label: 'Send Email',
    category: 'Communication',
    description: 'Prepares an email message.',
    planLabel: 'Free',
    canBeAction: true,
  },
  planLabel: 'Pro',
  hasErrors: false,
  layoutVariant: 'standard',
  workMode: 'build' as const,
  onWorkModeChange: vi.fn(),
  settings: {
    enableInspectorAI: true,
    enableSuggestions: true,
    enableAutoFix: true,
    enableWalkthroughs: true,
    enableTelemetry: false,
  },
  onToggleSetting: vi.fn(),
}

describe('InspectorHeader', () => {
  it('renders the Options menu through a body portal', () => {
    const { container } = render(
      React.createElement(
        'div',
        { 'data-testid': 'inspector-overflow', className: 'overflow-hidden' },
        React.createElement(InspectorHeader, baseProps),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Options' }))

    const menu = screen.getByTestId('inspector-options-menu')
    expect(menu).toBeTruthy()
    expect(container.contains(menu)).toBe(false)
    expect(document.body.contains(menu)).toBe(true)
  })

  it('flips the Options menu left near the right viewport edge', () => {
    const position = computeInspectorOptionsMenuPosition({
      triggerRect: {
        left: 760,
        right: 820,
        top: 100,
        bottom: 124,
      },
      viewportWidth: 840,
      viewportHeight: 700,
      menuWidth: 288,
      menuHeight: 320,
    })

    expect(position.left).toBeLessThan(760)
    expect(position.left + position.width).toBeLessThanOrEqual(828)
  })

  it('keeps the Options menu inside viewport bounds', () => {
    const position = computeInspectorOptionsMenuPosition({
      triggerRect: {
        left: 4,
        right: 52,
        top: 660,
        bottom: 684,
      },
      viewportWidth: 360,
      viewportHeight: 700,
      menuWidth: 288,
      menuHeight: 320,
    })

    expect(position.left).toBeGreaterThanOrEqual(12)
    expect(position.top).toBeGreaterThanOrEqual(12)
    expect(position.top + 320).toBeLessThanOrEqual(688)
  })

  it('shows Needs review for warning-only nodes', () => {
    render(
      React.createElement(InspectorHeader, {
        ...baseProps,
        hasWarnings: true,
        warningCount: 2,
      }),
    )

    expect(screen.getByText('Needs review')).toBeTruthy()
    expect(screen.queryByText('Needs attention')).toBeNull()
  })

  it('keeps blocking nodes on the existing Needs attention state', () => {
    render(
      React.createElement(InspectorHeader, {
        ...baseProps,
        hasErrors: true,
        hasWarnings: true,
        warningCount: 2,
      }),
    )

    expect(screen.getByText('Needs attention')).toBeTruthy()
    expect(screen.queryByText('Needs review')).toBeNull()
  })
})
