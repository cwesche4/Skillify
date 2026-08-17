import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  WorkspaceKnowledgeManager,
  type WorkspaceKnowledgeManagerItem,
} from '@/components/settings/WorkspaceKnowledgeManager'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

const baseItem: WorkspaceKnowledgeManagerItem = {
  id: 'knowledge-1',
  category: 'Assignment Rule',
  title: 'VIP jobs require senior technicians',
  description: 'Use experienced staff for VIP commercial work.',
  structuredValue: {
    statement: 'VIP jobs require senior technicians',
    scope: { type: 'scheduling', label: 'Scheduling' },
    metadata: {
      effectiveDate: '2026-08-04',
      relatedModule: 'Scheduling',
    },
  },
  sourceSummary: null,
  confidence: 'high',
  approvalStatus: 'APPROVED',
  createdById: 'user-owner',
  approvedById: 'user-owner',
  approvedAt: '2026-08-04T10:00:00.000Z',
  reason: null,
  tags: ['scheduling'],
  version: 1,
  isArchived: false,
  supersededById: null,
  createdAt: '2026-08-04T10:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
  source: {
    id: 'source-1',
    type: 'Owner instruction',
    label: 'Owner instruction',
    domain: 'scheduling',
    recordType: null,
    recordId: null,
    referenceId: null,
  },
  revisions: [
    {
      id: 'revision-1',
      version: 1,
      revisionType: 'APPROVED',
      title: 'VIP jobs require senior technicians',
      changeSummary: 'Approved workspace knowledge.',
      createdAt: '2026-08-04T10:00:00.000Z',
    },
  ],
  approvals: [],
  corrections: [],
}

function renderManager(items: WorkspaceKnowledgeManagerItem[] = [baseItem]) {
  return render(
    <WorkspaceKnowledgeManager
      workspaceId="workspace-1"
      workspaceSlug="acme"
      userRole="owner"
      initialItems={items}
      auditEvents={[]}
      knowledgeGaps={[]}
      recommendationHistory={[]}
      confidence={{
        level: 'medium',
        score: 72,
        known: ['Approved assignment policy'],
        unknown: [],
        missingData: [],
        recommendedNextIntegrations: [],
      }}
      selectorTargets={{
        teams: [{ id: 'team-1', label: 'Office Team', type: 'team' }],
        locations: [
          { id: 'location-1', label: 'Main Office', type: 'location' },
        ],
        serviceTypes: [],
        customerSegments: [],
      }}
    />,
  )
}

describe('WorkspaceKnowledgeManager', () => {
  beforeEach(() => {
    refresh.mockReset()
    vi.unstubAllGlobals()
    window.history.replaceState(
      null,
      '',
      '/dashboard/acme/settings/workspace-knowledge',
    )
  })

  it('opens Add Knowledge and validates required customer-facing fields after submit', async () => {
    renderManager()

    fireEvent.click(screen.getByRole('button', { name: /\+ add knowledge/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))

    expect(
      await screen.findByText(/complete the highlighted fields/i),
    ).toBeTruthy()
    expect(screen.getByText('Knowledge statement is required.')).toBeTruthy()
    expect(screen.getByText('Category is required.')).toBeTruthy()
    expect(screen.getByText('Scope is required.')).toBeTruthy()
  })

  it('submits a governed pending proposal without auto-approval', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            item: {
              ...baseItem,
              id: 'knowledge-2',
              approvalStatus: 'PENDING_REVIEW',
            },
          }),
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderManager()

    fireEvent.click(screen.getByRole('button', { name: /\+ add knowledge/i }))
    fireEvent.change(screen.getByLabelText(/knowledge statement/i), {
      target: { value: 'All emergency customer calls require manager review' },
    })
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: 'Customer Policy' },
    })
    fireEvent.change(screen.getByLabelText(/scope/i), {
      target: { value: 'clients' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const firstCall = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(JSON.parse(String(firstCall[1].body))).toMatchObject({
      category: 'Customer Policy',
      title: 'All emergency customer calls require manager review',
      scope: {
        type: 'clients',
        label: 'Clients',
      },
    })
  })

  it('opens approved knowledge in a governed details drawer', () => {
    renderManager()

    fireEvent.click(
      screen.getByRole('button', {
        name: /vip jobs require senior technicians/i,
      }),
    )

    expect(
      screen.getByRole('dialog', { name: /workspace knowledge/i }),
    ).toBeTruthy()
    expect(screen.getByText('Runtime eligibility')).toBeTruthy()
    expect(screen.getByText('Eligible for Workspace AI')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /edit replacement/i }),
    ).toBeTruthy()
  })

  it('filters the knowledge library by status and category', () => {
    renderManager([
      baseItem,
      {
        ...baseItem,
        id: 'knowledge-2',
        title: 'Escalations need owner review',
        category: 'Escalation Rule',
        approvalStatus: 'PENDING_REVIEW',
        approvedAt: null,
        approvedById: null,
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: /knowledge library/i }))
    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: 'PENDING_REVIEW' },
    })

    expect(screen.getByText('Escalations need owner review')).toBeTruthy()
    expect(screen.queryByText('VIP jobs require senior technicians')).toBeNull()
  })

  it('opens AI-proposed URL drafts in the Add Knowledge form without approval', async () => {
    window.history.replaceState(
      null,
      '',
      '/dashboard/acme/settings/workspace-knowledge?knowledgeStatement=AI%20should%20prefer%20owner%20approved%20answers&knowledgeExplanation=Generated%20from%20playground',
    )

    renderManager([])

    expect(
      await screen.findByRole('dialog', { name: /workspace knowledge/i }),
    ).toBeTruthy()
    expect(
      screen.getByDisplayValue('AI should prefer owner approved answers'),
    ).toBeTruthy()
    expect(screen.getByDisplayValue('AI Proposal')).toBeTruthy()
    expect(
      screen.queryByText(/it will not approve knowledge automatically/i),
    ).toBeNull()
  })
})
