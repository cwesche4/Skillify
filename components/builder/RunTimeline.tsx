'use client'

import { useMemo, useState } from 'react'
import type { RunTimelineData, RunStatus, RunSegment } from '@/lib/runs/types'
import { totalDuration } from '@/lib/runs/timeline'
import type { RunSettings } from '@/lib/runs/runSettings'
import { saveRunSettings } from '@/lib/runs/runSettings'

interface RunTimelineProps {
  runs: RunTimelineData[]
  currentTime: number
  onSeek: (time: number) => void
  className?: string
  selectedRunId?: string
  onSelectRun?: (runId: string) => void
  enableGrouping?: boolean
  enableCompare?: boolean
  compareRunIds?: string[]
  showHeatOverlay?: boolean
  showInsights?: boolean
  showExecutiveSummary?: boolean
  canToggleInsights?: boolean
  aiCoachHasInsights?: boolean
  runSettings?: RunSettings
  isAdmin?: boolean
  workspaceId?: string
  userId?: string
}

type DerivedRun = {
  runId: string
  runLabel: string
  segments: RunSegment[]
  start: number
  end: number
  status: RunStatus
  startedAt?: number | string | Date
}

const statusColor: Record<RunStatus, string> = {
  SUCCESS: '#22c55e',
  FAILED: '#ef4444',
  RUNNING: '#eab308',
  PARTIAL: '#38bdf8',
}

const computeRunStatus = (segments: RunSegment[]): RunStatus => {
  if (!segments.length) return 'PARTIAL'
  const hasFailed = segments.some((s) => s.status === 'FAILED')
  const hasRunning = segments.some((s) => s.status === 'RUNNING')
  const allSuccess = segments.every((s) => s.status === 'SUCCESS')
  if (hasFailed) return 'FAILED'
  if (hasRunning) return 'RUNNING'
  if (allSuccess) return 'SUCCESS'
  return 'PARTIAL'
}

type RunGroup = {
  id: string
  label: string
  runs: DerivedRun[]
}

type ChipProps = {
  label: string
  active: boolean
  disabled?: boolean
  onClick?: () => void
}

function Chip({ label, active, disabled, onClick }: ChipProps) {
  return (
    <button
      type="button"
      className={[
        'rounded-full px-2 py-1 text-[10px] transition-colors',
        active
          ? 'bg-cyan-500/30 text-cyan-100'
          : 'bg-slate-800/70 text-slate-300',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-800',
      ].join(' ')}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? 'Controlled by workspace settings' : undefined}
    >
      {label}
    </button>
  )
}

export default function RunTimeline({
  runs,
  currentTime,
  onSeek,
  className,
  selectedRunId,
  onSelectRun,
  enableGrouping = false,
  enableCompare = false,
  compareRunIds = [],
  showHeatOverlay = false,
  showInsights = false,
  showExecutiveSummary = false,
  canToggleInsights = true,
  aiCoachHasInsights = false,
  runSettings,
  isAdmin = false,
  workspaceId,
  userId,
}: RunTimelineProps) {
  const shouldDefaultInsights = !!(
    selectedRunId ||
    runs.length > 1 ||
    aiCoachHasInsights ||
    showInsights ||
    showExecutiveSummary ||
    runSettings?.showSummaryDefault
  )

  const [localGrouping, setLocalGrouping] = useState(false)
  const [localCompare, setLocalCompare] = useState(false)
  const [localHeat, setLocalHeat] = useState(false)
  const [localInsights, setLocalInsights] = useState(shouldDefaultInsights)
  const [whyDismissed, setWhyDismissed] = useState(false)
  const summaryDisabled: boolean = !!(
    !localInsights &&
    !canToggleInsights &&
    runSettings !== undefined &&
    runSettings.allowUserToggleSummary === false &&
    !isAdmin
  )

  const normalizedRuns = useMemo<DerivedRun[]>(() => {
    return runs.map((run, idx) => {
      const runId = run.runId || `run-${idx}`
      const runLabel = run.runLabel || `Run ${runId}`
      const segments = run.segments || []
      const start = segments.reduce(
        (m, s) => (s.start < m ? s.start : m),
        segments.length ? segments[0].start : 0,
      )
      const end = segments.reduce(
        (m, s) => (s.end > m ? s.end : m),
        segments.length ? segments[0].end : 0,
      )
      const status = run.runStatus || computeRunStatus(segments)
      return {
        runId,
        runLabel,
        segments,
        start,
        end,
        status,
        startedAt: run.startedAt,
      }
    })
  }, [runs])

  const duration = useMemo(
    () => totalDuration(normalizedRuns),
    [normalizedRuns],
  )
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  const groupedRuns = useMemo<RunGroup[]>(() => {
    if (!localGrouping)
      return [{ id: 'all', label: 'Runs', runs: normalizedRuns }]
    const groups: Record<string, RunGroup> = {}
    for (const run of normalizedRuns) {
      const startedAt = run.startedAt
      let label = 'Earlier'
      if (startedAt) {
        const date = new Date(startedAt)
        const now = new Date()
        const sameDay =
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === now.getDate()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const isYesterday =
          date.getFullYear() === yesterday.getFullYear() &&
          date.getMonth() === yesterday.getMonth() &&
          date.getDate() === yesterday.getDate()
        if (sameDay) label = 'Today'
        else if (isYesterday) label = 'Yesterday'
      }
      const id = label.toLowerCase()
      if (!groups[id]) groups[id] = { id, label, runs: [] }
      groups[id].runs.push(run)
    }
    return Object.values(groups)
  }, [localGrouping, normalizedRuns])

  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({})

  const maxSegDuration = useMemo(() => {
    let max = 0
    normalizedRuns.forEach((run) =>
      run.segments.forEach((s: RunSegment) => {
        max = Math.max(max, s.end - s.start)
      }),
    )
    return max
  }, [normalizedRuns])

  return (
    <div
      className={`pointer-events-auto flex w-full min-w-[280px] max-w-[min(620px,calc(100vw-32px))] flex-col gap-2 rounded-xl border border-slate-800/70 bg-slate-950/90 p-3 text-slate-100 shadow-lg backdrop-blur ${className ?? ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>Run Timeline</span>
        <span className="flex items-center gap-2">
          {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
          {workspaceId && (
            <button
              type="button"
              className="rounded-md px-1 text-slate-300 transition hover:text-cyan-200"
              title="Run Insights Settings"
              onClick={() => {
                window.location.href = `/dashboard/${workspaceId}/settings/run-insights`
              }}
            >
              ⚙️
            </button>
          )}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <Chip
          label="Summary"
          active={localInsights}
          disabled={summaryDisabled}
          onClick={() => {
            if (
              !localInsights &&
              !canToggleInsights &&
              runSettings &&
              !runSettings.allowUserToggleSummary &&
              !isAdmin
            )
              return
            const next = !localInsights
            setLocalInsights(next)
            if (runSettings && workspaceId) {
              saveRunSettings(workspaceId, {
                ...runSettings,
                showSummaryDefault: next,
              })
            }
          }}
        />
        <Chip
          label="Compare"
          active={localCompare}
          disabled={
            (runSettings ? !runSettings.allowCompare && !isAdmin : false) ||
            runs.length < 2
          }
          onClick={() => {
            if (
              (runSettings && !runSettings.allowCompare && !isAdmin) ||
              runs.length < 2
            )
              return
            setLocalCompare((v) => !v)
          }}
        />
        <Chip
          label="Group"
          active={localGrouping}
          onClick={() => setLocalGrouping((v) => !v)}
        />
        <Chip
          label="Heat"
          active={localHeat}
          disabled={runSettings ? !runSettings.allowHeatmap && !isAdmin : false}
          onClick={() => {
            if (runSettings && !runSettings.allowHeatmap && !isAdmin) return
            setLocalHeat((v) => !v)
          }}
        />
      </div>
      {localInsights && showInsights && !whyDismissed && (
        <div className="flex items-start justify-between rounded-md bg-slate-900/60 px-2 py-1 text-[10px] text-slate-400 transition duration-150 ease-out motion-reduce:transition-none">
          <span>
            You’re seeing this because
            {selectedRunId ? ' a run is selected' : ''}
            {!selectedRunId && normalizedRuns.length > 1
              ? ' multiple runs exist'
              : ''}
            {!selectedRunId && normalizedRuns.length <= 1 && aiCoachHasInsights
              ? ' AI Coach has insights'
              : ''}
            .
          </span>
          <button
            type="button"
            className="text-[10px] text-cyan-300 underline"
            onClick={() => setWhyDismissed(true)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-900/80">
        <div
          className="h-full bg-cyan-400/80 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration)}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="accent-cyan-400"
      />

      <div className="flex gap-1 text-[10px] text-slate-500">
        <span>Segments:</span>
        <span>{normalizedRuns.reduce((n, r) => n + r.segments.length, 0)}</span>
      </div>

      <div className="relative mt-1 flex flex-col gap-3">
        <div
          className="pointer-events-none absolute inset-y-0 w-[1px] bg-cyan-400/70"
          style={{
            left: `${pct}%`,
          }}
        />
        {groupedRuns.map((group) => (
          <div
            key={group.id}
            className="flex flex-col gap-2"
            style={{
              rowGap: normalizedRuns.length > 8 ? '6px' : undefined,
            }}
          >
            {localGrouping && (
              <button
                type="button"
                className="flex items-center justify-between rounded-md bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300"
                onClick={() =>
                  setCollapsedGroups((prev) => ({
                    ...prev,
                    [group.id]: !prev[group.id],
                  }))
                }
                aria-expanded={!collapsedGroups[group.id]}
              >
                <span>{group.label}</span>
                <span className="text-slate-500">
                  {group.runs.length} run{group.runs.length === 1 ? '' : 's'}
                </span>
              </button>
            )}
            {!collapsedGroups[group.id] &&
              group.runs.map((run) => {
                const isSelected = selectedRunId && selectedRunId === run.runId
                const isCompare =
                  localCompare && compareRunIds.includes(run.runId)
                return (
                  <button
                    key={run.runId}
                    type="button"
                    onClick={() => onSelectRun?.(run.runId)}
                    className={[
                      'group flex items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors',
                      isSelected
                        ? 'bg-slate-800/60'
                        : isCompare
                          ? 'bg-slate-800/30'
                          : 'bg-transparent',
                    ].join(' ')}
                    title={`Run ${run.runId} — ${run.status} — duration ${(run.end - run.start).toFixed(2)}s`}
                  >
                    <div className="flex min-w-0 max-w-[160px] flex-1 items-center gap-2 text-[10px] text-slate-300">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: statusColor[run.status] }}
                      />
                      <span className="truncate">{run.runLabel}</span>
                      <span className="rounded-full bg-slate-800 px-2 py-[2px] text-[9px] text-slate-200">
                        {run.status.toLowerCase()}
                      </span>
                    </div>
                    <div className="relative h-2 min-w-[140px] flex-[2] overflow-hidden rounded-full bg-slate-900/70">
                      {run.segments.map((seg: RunSegment) => {
                        const segStartPct = duration
                          ? (seg.start / duration) * 100
                          : 0
                        const segWidthPct = duration
                          ? ((seg.end - seg.start) / duration) * 100
                          : 0
                        const durationMs = seg.end - seg.start
                        const heat =
                          localHeat && maxSegDuration > 0
                            ? Math.max(
                                0.25,
                                Math.min(1, durationMs / maxSegDuration),
                              )
                            : 1
                        return (
                          <div
                            key={seg.id}
                            className="absolute top-0 h-full rounded-full"
                            style={{
                              left: `${segStartPct}%`,
                              width: `${segWidthPct}%`,
                              backgroundColor: statusColor[seg.status],
                              opacity:
                                seg.status === 'RUNNING'
                                  ? 0.8
                                  : localHeat
                                    ? heat
                                    : 1,
                              boxShadow: localHeat
                                ? `0 0 0 1px rgba(255,255,255,0.08)`
                                : undefined,
                            }}
                            title={`Node ${seg.nodeId ?? seg.id} — ${seg.status}
Start: ${seg.start.toFixed(2)}s
End: ${seg.end.toFixed(2)}s
Duration: ${(seg.end - seg.start).toFixed(2)}s`}
                          />
                        )
                      })}
                    </div>
                  </button>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
