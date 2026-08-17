'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import {
  createWorkflowDebugReport,
  exportWorkflowRunJson,
  exportWorkflowRunLogs,
  groupWorkflowRunHistory,
  searchWorkflowRunHistory,
  workflowRunKindLabel,
  type WorkflowRunHistoryItem,
  type WorkflowRunHistoryStats,
} from '@/lib/workflows/runHistory'

type ReplayState = {
  runId: string
  stepIndex: number
  playing: boolean
} | null

type RunHistoryDebuggerPanelProps = {
  open: boolean
  runs: WorkflowRunHistoryItem[]
  stats: WorkflowRunHistoryStats
  replay: ReplayState
  onClose: () => void
  onReplay: (run: WorkflowRunHistoryItem) => void
  onStep: (direction: 'previous' | 'next') => void
  onTogglePlay: () => void
  onRestartReplay: () => void
  onSelectNode: (nodeId: string) => void
  currentNodeCount: number
  currentEdgeCount: number
  currentWorkflowFingerprint: string
}

const statusClass: Record<WorkflowRunHistoryItem['status'], string> = {
  completed: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  failed: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
  stopped: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  cancelled: 'border-slate-700 bg-slate-900/70 text-slate-300',
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value)
}

function relativeOffset(run: WorkflowRunHistoryItem, timestamp?: string) {
  if (!timestamp) return '0 ms'
  const offset = Math.max(0, Date.parse(timestamp) - Date.parse(run.timestamp))
  return `${offset} ms`
}

export default function RunHistoryDebuggerPanel({
  open,
  runs,
  stats,
  replay,
  onClose,
  onReplay,
  onStep,
  onTogglePlay,
  onRestartReplay,
  onSelectNode,
  currentNodeCount,
  currentEdgeCount,
  currentWorkflowFingerprint,
}: RunHistoryDebuggerPanelProps) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | WorkflowRunHistoryItem['status']
  >('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>(
    'all',
  )
  const filteredRuns = useMemo(() => {
    const now = Date.now()
    const searched = searchWorkflowRunHistory(runs, query)
    return searched.filter((run) => {
      if (statusFilter !== 'all' && run.status !== statusFilter) return false
      const time = Date.parse(run.timestamp)
      if (dateFilter === 'today') {
        const today = new Date()
        const start = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        ).getTime()
        return time >= start
      }
      if (dateFilter === '7d') return now - time <= 7 * 24 * 60 * 60 * 1000
      if (dateFilter === '30d') return now - time <= 30 * 24 * 60 * 60 * 1000
      return true
    })
  }, [dateFilter, query, runs, statusFilter])
  const grouped = useMemo(
    () => groupWorkflowRunHistory(filteredRuns),
    [filteredRuns],
  )
  const activeRun = replay
    ? (runs.find((run) => run.id === replay.runId) ?? null)
    : null
  const activeStep =
    activeRun && replay ? (activeRun.steps[replay.stepIndex] ?? null) : null
  const previousStep =
    activeRun && replay ? (activeRun.steps[replay.stepIndex - 1] ?? null) : null
  const historicalEdgeCount = activeRun?.graph
    ? Object.values(activeRun.graph.adjacency).reduce(
        (count, targets) => count + targets.length,
        0,
      )
    : 0
  const variablesByGroup = activeRun
    ? Object.entries(activeRun.variables).reduce<
        Record<string, Array<[string, unknown]>>
      >((groups, entry) => {
        const group = entry[0].split('.')[0] || 'temporary'
        groups[group] = groups[group] ?? []
        groups[group].push(entry)
        return groups
      }, {})
    : {}

  if (!open) return null

  return (
    <aside className="pointer-events-auto absolute right-4 top-16 z-50 flex max-h-[78vh] w-[420px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/45 backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 p-4">
        <div>
          <p className="text-sm font-semibold">Run History</p>
          <p className="mt-1 text-xs text-slate-400">
            Preview, test, and live run snapshots with replay and validation
            context.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close run history"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-900 hover:text-slate-100"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-2">
            <p className="text-slate-500">Success</p>
            <p className="mt-1 text-slate-100">{stats.successRate}%</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-2">
            <p className="text-slate-500">Avg runtime</p>
            <p className="mt-1 text-slate-100">{stats.averageRuntimeMs}ms</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-2">
            <p className="text-slate-500">Runs today</p>
            <p className="mt-1 text-slate-100">{stats.runsToday}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-2">
            <p className="text-slate-500">Failure</p>
            <p className="mt-1 text-slate-100">{stats.failureRate}%</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-2">
            <p className="text-slate-500">This week</p>
            <p className="mt-1 text-slate-100">{stats.runsThisWeek}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-2">
            <p className="text-slate-500">Common error</p>
            <p className="mt-1 truncate text-slate-100">
              {stats.mostCommonError}
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/35 p-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search run ID, status, node, error, variable..."
            className="h-8 w-full rounded-md border border-slate-800 bg-slate-950 px-2 text-[12px] text-slate-100 placeholder:text-slate-600"
          />
          <div className="flex flex-wrap gap-2">
            {(
              ['all', 'completed', 'failed', 'stopped', 'cancelled'] as const
            ).map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-full border px-2 py-0.5 text-[10px] ${
                  statusFilter === value
                    ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-100'
                    : 'border-slate-800 text-slate-400'
                }`}
                onClick={() => setStatusFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'today', '7d', '30d'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-full border px-2 py-0.5 text-[10px] ${
                  dateFilter === value
                    ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-100'
                    : 'border-slate-800 text-slate-400'
                }`}
                onClick={() => setDateFilter(value)}
              >
                {value === '7d'
                  ? 'Last 7 Days'
                  : value === '30d'
                    ? 'Last 30 Days'
                    : value}
              </button>
            ))}
          </div>
        </div>

        {activeRun ? (
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-[11px] text-cyan-50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Replay</p>
                <p className="mt-1 text-cyan-100/75">
                  {activeStep?.label ?? 'Finished'} · Step{' '}
                  {(replay?.stepIndex ?? 0) + 1}/{activeRun.steps.length}
                </p>
              </div>
              <span className="rounded-full border border-cyan-300/30 px-2 py-0.5">
                {replay?.playing ? 'Auto Play' : 'Paused'}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="xs"
                variant="secondary"
                onClick={() => onStep('previous')}
              >
                Previous Step
              </Button>
              <Button
                size="xs"
                variant="secondary"
                onClick={() => onStep('next')}
              >
                Next Step
              </Button>
              <Button size="xs" variant="secondary" onClick={onTogglePlay}>
                {replay?.playing ? 'Pause' : 'Auto Play'}
              </Button>
              <Button size="xs" variant="secondary" onClick={onRestartReplay}>
                Restart
              </Button>
            </div>
            <div className="mt-3 space-y-1">
              {activeRun.steps.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition ${
                    index === replay?.stepIndex
                      ? 'bg-cyan-300/15 text-cyan-50'
                      : 'text-cyan-100/75 hover:bg-cyan-300/10'
                  }`}
                  onClick={() => onSelectNode(step.nodeId)}
                >
                  <span>{step.label}</span>
                  <span>{relativeOffset(activeRun, step.startedAt)}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-cyan-300/20 pt-3">
              <div className="rounded-lg border border-cyan-300/20 bg-cyan-950/20 p-2">
                <p className="font-semibold">Runtime Diff</p>
                <p className="mt-1 text-cyan-100/75">
                  Nodes {currentNodeCount - activeRun.nodeCount >= 0 ? '+' : ''}
                  {currentNodeCount - activeRun.nodeCount}
                </p>
                <p className="text-cyan-100/75">
                  Connections{' '}
                  {currentEdgeCount - historicalEdgeCount >= 0 ? '+' : ''}
                  {currentEdgeCount - historicalEdgeCount}
                </p>
              </div>
              <div className="rounded-lg border border-cyan-300/20 bg-cyan-950/20 p-2">
                <p className="font-semibold">Last Transfer</p>
                <p className="mt-1 truncate text-cyan-100/75">
                  {previousStep ? previousStep.label : 'Workflow start'} →{' '}
                  {activeStep?.label ?? 'Finished'}
                </p>
                <p className="truncate text-cyan-100/75">
                  {previousStep?.output
                    ? Object.keys(previousStep.output)
                        .filter((key) => !key.startsWith('__'))
                        .join(', ') || 'No mapped fields'
                    : 'No source output yet'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {Object.entries(grouped).map(([group, groupRuns]) => (
            <section key={group}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group}
              </p>
              <div className="space-y-2">
                {groupRuns.length ? (
                  groupRuns.map((run) => (
                    <div
                      key={run.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/45 p-3 text-[11px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-slate-100">
                              {workflowRunKindLabel(run.runKind)}
                            </p>
                            <span className="rounded-full border border-slate-700 bg-slate-950/50 px-2 py-0.5 text-[10px] text-slate-400">
                              {run.workflowFingerprint ===
                              currentWorkflowFingerprint
                                ? 'Current revision'
                                : 'Previous workflow revision'}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-slate-500">
                            {run.id}
                          </p>
                          <p className="mt-1 text-slate-500">
                            {new Date(run.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 capitalize ${statusClass[run.status]}`}
                        >
                          {run.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-slate-400">
                        <span>{run.durationMs}ms</span>
                        <span>{run.nodeCount} nodes</span>
                        <span>{run.warningCount} warnings</span>
                        <span>{run.errorCount} errors</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
                        <span className="rounded-full border border-slate-800 bg-slate-950/40 px-2 py-0.5">
                          {run.validation?.readinessLabel ??
                            'Readiness unknown'}
                        </span>
                        <span className="rounded-full border border-slate-800 bg-slate-950/40 px-2 py-0.5">
                          {run.validation?.status ?? 'validation unknown'}
                        </span>
                      </div>
                      {run.errors[0] ? (
                        <p className="mt-2 rounded-md border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-rose-100">
                          {run.errors[0]}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => onReplay(run)}
                        >
                          Replay
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => copyText(exportWorkflowRunJson(run))}
                        >
                          Export JSON
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => copyText(exportWorkflowRunLogs(run))}
                        >
                          Export Logs
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            copyText(createWorkflowDebugReport(run))
                          }
                        >
                          Copy Debug Report
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-slate-800 bg-slate-900/35 p-3 text-[11px] text-slate-500">
                    No runs in this group.
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-3 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-300">Variables</p>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {Object.entries(variablesByGroup).map(([group, entries]) => (
              <details
                key={group}
                open={['client', 'lead', 'automation'].includes(group)}
              >
                <summary className="cursor-pointer rounded-md px-2 py-1 capitalize text-slate-300 hover:bg-slate-800/70">
                  {group}
                </summary>
                <div className="mt-1 space-y-1">
                  {entries.map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left hover:bg-slate-800/70"
                      onClick={() => {
                        const producer = activeRun?.steps.find((step) =>
                          Object.prototype.hasOwnProperty.call(
                            step.output ?? {},
                            key,
                          ),
                        )
                        if (producer) onSelectNode(producer.nodeId)
                      }}
                    >
                      <span className="truncate text-slate-200">{key}</span>
                      <span className="max-w-[160px] truncate text-slate-500">
                        {String(value)}
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            ))}
            {!activeRun ? (
              <p className="text-slate-500">
                Start replay to inspect workflow variables and highlight
                producers.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  )
}
