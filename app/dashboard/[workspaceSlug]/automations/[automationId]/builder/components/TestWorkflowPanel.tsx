'use client'

import { X } from 'lucide-react'
import React, { type ReactNode } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { WorkflowExecution } from '@/lib/workflows/types'

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  succeeded: 'Completed',
  failed: 'Failed',
  skipped: 'Skipped',
}

export default function TestWorkflowPanel({
  execution,
  freshness = 'none',
  staleState,
  currentValidation,
  dataFlowSummary,
  runHistoryCount = 0,
  onRestart,
  onStepClick,
  renderIssueActions,
  onClose,
}: {
  execution: WorkflowExecution | null
  freshness?: 'none' | 'current' | 'out_of_date'
  staleState?: {
    freshness?: 'out_of_date'
    previewStatus?: WorkflowExecution['status']
    currentReadinessLabel?: string
    currentErrorCount?: number
    currentWarningCount?: number
    resolvedCount: number
    remainingCount: number
    remainingIssues: string[]
  } | null
  currentValidation?: {
    label: string
    errors: number
    warnings: number
  }
  dataFlowSummary?: {
    created: number
    consumed: number
    remaining: number
    unused: number
    broken: number
    branches?: number
    selectedPaths?: number
    skippedPaths?: number
    fallbackPaths?: number
  }
  runState?: 'idle' | 'running' | 'paused' | 'stopped'
  runHistoryCount?: number
  onPause?: () => void
  onResume?: () => void
  onStop?: () => void
  onRestart?: () => void
  onStepClick?: (nodeId: string) => void
  renderIssueActions?: (issueId: string, nodeId: string) => ReactNode
  onClose: () => void
}) {
  if (!execution) return null

  const isPreflightFailure =
    execution.status === 'failed' &&
    execution.triggerSource === 'Cannot preview'

  return (
    <aside className="bg-slate-950/92 pointer-events-auto absolute right-4 top-16 z-40 flex max-h-[72vh] w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-slate-800/80 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Preview Run</p>
            <Badge
              size="xs"
              variant={freshness === 'out_of_date' ? 'yellow' : 'green'}
            >
              {freshness === 'out_of_date' ? 'Out of date' : 'Current'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Preview execution only. No external actions were sent.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-900 hover:text-slate-100"
          aria-label="Close preview run panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {staleState ? (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-50">
            <p className="font-semibold">Preview is out of date</p>
            <p className="mt-1 text-amber-100/80">
              Workflow changed since this preview was run. This{' '}
              {staleState.previewStatus ?? execution.status} result belongs to a
              previous workflow revision.
            </p>
            {staleState.remainingIssues.length ? (
              <ul className="mt-2 space-y-1 text-amber-100/80">
                {staleState.remainingIssues.map((message) => (
                  <li key={message}>• {message}</li>
                ))}
              </ul>
            ) : null}
            <Button size="xs" className="mt-3" onClick={onRestart}>
              Run Preview Again
            </Button>
          </div>
        ) : null}

        {currentValidation ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-100">
                Current validation
              </span>
              <Badge
                size="xs"
                variant={
                  currentValidation.errors
                    ? 'red'
                    : currentValidation.warnings
                      ? 'yellow'
                      : 'green'
                }
              >
                {currentValidation.label}
              </Badge>
            </div>
            <p className="mt-2 text-slate-400">
              {currentValidation.errors
                ? `${currentValidation.errors} error${currentValidation.errors === 1 ? '' : 's'} remain`
                : currentValidation.warnings
                  ? `${currentValidation.warnings} warning${currentValidation.warnings === 1 ? '' : 's'} remain`
                  : 'Ready'}
            </p>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {isPreflightFailure ? 'Cannot preview' : 'Execution summary'}
            </span>
            <Badge
              size="xs"
              variant={execution.status === 'failed' ? 'red' : 'green'}
            >
              {statusLabel[execution.status] ?? execution.status}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-100">
            {execution.triggerSource}
          </p>
          {execution.summary ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">Completed</p>
                <p className="mt-1 text-slate-100">
                  {execution.summary.completed}
                </p>
              </div>
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">
                  {isPreflightFailure ? 'Affected' : 'Failed'}
                </p>
                <p className="mt-1 text-slate-100">
                  {execution.summary.failed}
                </p>
              </div>
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">Skipped</p>
                <p className="mt-1 text-slate-100">
                  {execution.summary.skipped}
                </p>
              </div>
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">Runtime</p>
                <p className="mt-1 text-slate-100">
                  {execution.summary.executionTimeMs}ms
                </p>
              </div>
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">Dynamic Values</p>
                <p className="mt-1 text-slate-100">
                  {execution.summary.variablesCreated}
                </p>
              </div>
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">Warnings</p>
                <p className="mt-1 text-slate-100">
                  {execution.summary.warnings}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <span className="self-center text-[11px] text-slate-500">
            Local runs {runHistoryCount}
          </span>
        </div>

        {dataFlowSummary ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-3">
            <p className="text-xs font-semibold text-slate-100">
              Workflow Data
            </p>
            <div className="mt-3 grid grid-cols-5 gap-2 text-[11px]">
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">Created</p>
                <p className="mt-1 text-slate-100">{dataFlowSummary.created}</p>
              </div>
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">Consumed</p>
                <p className="mt-1 text-slate-100">
                  {dataFlowSummary.consumed}
                </p>
              </div>
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">Remaining</p>
                <p className="mt-1 text-slate-100">
                  {dataFlowSummary.remaining}
                </p>
              </div>
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">Unused</p>
                <p className="mt-1 text-slate-100">{dataFlowSummary.unused}</p>
              </div>
              <div className="rounded-md bg-slate-950/50 p-2">
                <p className="text-slate-500">Broken</p>
                <p className="mt-1 text-slate-100">{dataFlowSummary.broken}</p>
              </div>
            </div>
            {dataFlowSummary.branches ? (
              <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-md bg-slate-950/50 p-2">
                  <p className="text-slate-500">Branches</p>
                  <p className="mt-1 text-slate-100">
                    {dataFlowSummary.branches}
                  </p>
                </div>
                <div className="rounded-md bg-slate-950/50 p-2">
                  <p className="text-slate-500">Selected</p>
                  <p className="mt-1 text-slate-100">
                    {dataFlowSummary.selectedPaths ?? 0}
                  </p>
                </div>
                <div className="rounded-md bg-slate-950/50 p-2">
                  <p className="text-slate-500">Skipped</p>
                  <p className="mt-1 text-slate-100">
                    {dataFlowSummary.skippedPaths ?? 0}
                  </p>
                </div>
                <div className="rounded-md bg-slate-950/50 p-2">
                  <p className="text-slate-500">Fallback</p>
                  <p className="mt-1 text-slate-100">
                    {dataFlowSummary.fallbackPaths ?? 0}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          {execution.steps.map((step) => (
            <button
              type="button"
              key={step.id}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/45 p-3 text-left transition hover:border-slate-700 hover:bg-slate-900/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              onClick={() => {
                if (step.nodeId !== 'workflow') onStepClick?.(step.nodeId)
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {step.label}
                  </p>
                  <p className="text-[11px] text-slate-500">{step.nodeType}</p>
                </div>
                <Badge
                  size="xs"
                  variant={
                    step.status === 'failed'
                      ? 'red'
                      : step.status === 'skipped'
                        ? 'yellow'
                        : 'green'
                  }
                >
                  {statusLabel[step.status] ?? step.status}
                </Badge>
              </div>
              {Array.isArray(
                (step.output as Record<string, unknown>).__branchPaths,
              ) ? (
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                  {(
                    (step.output as Record<string, unknown>)
                      .__branchPaths as Array<{
                      pathKey: string
                      pathLabel: string
                      status: string
                    }>
                  ).map((path) => (
                    <span
                      key={path.pathKey}
                      className={[
                        'rounded-full border px-2 py-0.5',
                        path.status === 'selected'
                          ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                          : path.status === 'skipped'
                            ? 'border-slate-700/70 bg-slate-950/50 text-slate-400'
                            : 'border-amber-300/30 bg-amber-300/10 text-amber-100',
                      ].join(' ')}
                    >
                      {path.pathLabel}: {path.status.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              ) : null}
              {isPreflightFailure && step.logs.length > 1 ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {step.logs.map((log) => (
                    <li key={log.id} className="space-y-1">
                      <button
                        type="button"
                        className="text-left transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (step.nodeId !== 'workflow')
                            onStepClick?.(step.nodeId)
                        }}
                      >
                        • {log.message}
                      </button>
                      {log.issueId ? (
                        <div className="flex flex-wrap gap-1">
                          {renderIssueActions?.(log.issueId, step.nodeId)}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : step.logs.at(-1)?.message ? (
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  <p>{step.logs.at(-1)?.message}</p>
                  {step.logs.at(-1)?.issueId ? (
                    <div className="flex flex-wrap gap-1">
                      {renderIssueActions?.(
                        step.logs.at(-1)!.issueId!,
                        step.nodeId,
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {step.output?.__durationMs ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Duration {String(step.output.__durationMs)}ms
                </p>
              ) : null}
            </button>
          ))}
        </div>

        {execution.error ? (
          <div className="rounded-lg border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-100">
            {execution.error}
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-800/80 p-3">
        <Button size="sm" variant="subtle" className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </aside>
  )
}
