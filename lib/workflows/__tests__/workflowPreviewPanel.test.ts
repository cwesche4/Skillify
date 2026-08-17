import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import TestWorkflowPanel from '@/app/dashboard/[workspaceSlug]/automations/[automationId]/builder/components/TestWorkflowPanel'
import type { WorkflowExecution } from '@/lib/workflows/types'

function execution(
  status: WorkflowExecution['status'] = 'failed',
): WorkflowExecution {
  return {
    id: 'preview-1',
    workflowId: 'workflow-1',
    workspaceId: 'workspace-1',
    status,
    triggerSource:
      status === 'failed' ? 'Cannot preview' : 'Preview trigger fired',
    startedAt: '2026-07-29T12:00:00.000Z',
    finishedAt: '2026-07-29T12:00:01.000Z',
    steps: [
      {
        id: 'step-1',
        runId: 'preview-1',
        nodeId: 'sms',
        nodeType: 'validation',
        label: 'Send SMS — Failed',
        status: status === 'failed' ? 'failed' : 'succeeded',
        startedAt: '2026-07-29T12:00:00.000Z',
        finishedAt: '2026-07-29T12:00:00.000Z',
        error:
          status === 'failed'
            ? 'Send SMS: Recipient Phone is empty.'
            : undefined,
        logs: [
          {
            id: 'log-1',
            timestamp: '2026-07-29T12:00:00.000Z',
            level: status === 'failed' ? 'error' : 'info',
            message:
              status === 'failed'
                ? 'Send SMS: Recipient Phone is empty.'
                : 'Send SMS completed.',
            nodeId: 'sms',
            issueId:
              status === 'failed'
                ? 'missing-required-field:sms:phone'
                : undefined,
          },
        ],
        output: {},
      },
    ],
    logs: [],
    error:
      status === 'failed' ? 'Send SMS: Recipient Phone is empty.' : undefined,
    mode: 'preview',
    runKind: 'preview',
    workflowFingerprint: 'old-fingerprint',
    validation: {
      status: status === 'failed' ? 'blocked' : 'passed',
      readinessState: status === 'failed' ? 'cannot-publish' : 'ready',
      readinessLabel: status === 'failed' ? 'Cannot publish' : 'Ready',
      errorCount: status === 'failed' ? 1 : 0,
      warningCount: 0,
      infoCount: 0,
      issueIds: ['missing-required-field:sms:phone'],
      blockingIssueIds:
        status === 'failed' ? ['missing-required-field:sms:phone'] : [],
    },
    summary: {
      workflow: 'workflow-1',
      completed: status === 'failed' ? 0 : 1,
      failed: status === 'failed' ? 1 : 0,
      skipped: 0,
      executionTimeMs: 0,
      variablesCreated: 0,
      variablesUsed: 0,
      nodesExecuted: 1,
      warnings: 0,
      errors: status === 'failed' ? 1 : 0,
      branchCount: 0,
      estimatedRuntimeMs: 0,
    },
  }
}

describe('workflow preview panel freshness', () => {
  it('shows current preview state when the latest preview matches the workflow', () => {
    render(
      React.createElement(TestWorkflowPanel, {
        execution: execution('succeeded'),
        freshness: 'current',
        currentValidation: { label: 'Ready', errors: 0, warnings: 0 },
        onClose: vi.fn(),
      }),
    )

    expect(screen.getByText('Preview Run')).toBeTruthy()
    expect(screen.getByText('Current')).toBeTruthy()
    expect(screen.queryByText('Preview is out of date')).toBeNull()
    expect(screen.getByText('Current validation')).toBeTruthy()
  })

  it('shows stale preview banner, rerun action, old failure, and current validation separately', () => {
    const onRestart = vi.fn()
    render(
      React.createElement(TestWorkflowPanel, {
        execution: execution('failed'),
        freshness: 'out_of_date',
        staleState: {
          freshness: 'out_of_date',
          previewStatus: 'failed',
          currentReadinessLabel: 'Ready',
          currentErrorCount: 0,
          currentWarningCount: 0,
          resolvedCount: 1,
          remainingCount: 0,
          remainingIssues: [],
        },
        currentValidation: { label: 'Ready', errors: 0, warnings: 0 },
        onRestart,
        onClose: vi.fn(),
      }),
    )

    expect(screen.getByText('Preview is out of date')).toBeTruthy()
    expect(screen.getByText(/previous workflow revision/i)).toBeTruthy()
    expect(
      screen.getAllByText('Send SMS: Recipient Phone is empty.').length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Current validation')).toBeTruthy()
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('Run Preview Again'))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })
})
