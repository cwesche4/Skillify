import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { StageRail } from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'

describe('Opportunity StageRail presentation', () => {
  it('removes numbered badges while preserving stage labels, values, counts, and clicks', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      React.createElement(StageRail, {
        selectedLabel: 'Scoping',
        onSelect,
        data: [
          {
            label: 'Discovery',
            value: '$12K',
            helper: '2 opportunities',
          },
          {
            label: 'Scoping',
            value: '$8K',
            helper: '1 opportunity',
            description:
              'Define the exact work, requirements, materials, labor, and solution before preparing the proposal.',
          },
          {
            label: 'Proposal Sent',
            value: '$5K',
            helper: '1 opportunity',
          },
        ],
      }),
    )

    expect(screen.queryByText('01')).toBeNull()
    expect(screen.queryByText('02')).toBeNull()
    expect(screen.getByText('Discovery')).toBeTruthy()
    expect(screen.getByText('Scoping')).toBeTruthy()
    expect(screen.getByText('$8K')).toBeTruthy()
    expect(screen.getAllByText('1 opportunity').length).toBeGreaterThan(0)
    expect(screen.getByText(/Define the exact work/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Scoping/i }))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Scoping' }),
    )
  })
})
