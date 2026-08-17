'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RunTimelineData } from '@/lib/runs/types'

type Tone = 'hybrid' | 'strict' | 'casual'

type SummarySettings = {
  showOnSelection: boolean
  showOnMulti: boolean
  showOnAICoach: boolean
  tone: Tone
  baselineMode: 'auto' | 'pinned'
  pinnedBaselineId?: string
}

type RunDelta = {
  nodeId: string
  durationDelta: number
  statusDelta?: string
  confidence: number
  confidenceLabel: 'high' | 'medium' | 'low'
}

export interface RunTimelineSummaryProps {
  runs: RunTimelineData[]
  selectedRunId?: string | null
  aiCoachHasInsights?: boolean
  workspaceId: string
  userId?: string
}

const defaultSettings: SummarySettings = {
  showOnSelection: true,
  showOnMulti: true,
  showOnAICoach: true,
  tone: 'hybrid',
  baselineMode: 'auto',
}

const toneSubtitle: Record<Tone, string> = {
  hybrid: 'Quick read on what changed, what matters, and how confident we are.',
  strict: 'Summary of run deltas and confidence.',
  casual: 'Here’s what changed and how sure we are.',
}

const confidenceLabel = (v: number): 'high' | 'medium' | 'low' => {
  if (v >= 0.75) return 'high'
  if (v >= 0.45) return 'medium'
  return 'low'
}

function pickBestBaseline(runs: RunTimelineData[], pinnedId?: string) {
  if (!runs.length) return null
  if (pinnedId) {
    const pinned = runs.find((r) => r.runId === pinnedId)
    if (pinned) return pinned
  }
  const statusRank = (s?: string) => {
    switch (s) {
      case 'SUCCESS':
        return 0
      case 'PARTIAL':
        return 1
      case 'RUNNING':
        return 2
      case 'FAILED':
        return 3
      default:
        return 4
    }
  }
  return [...runs].sort((a, b) => {
    const durA = a.segments.reduce((m, s) => Math.max(m, s.end), 0)
    const durB = b.segments.reduce((m, s) => Math.max(m, s.end), 0)
    const failedA = a.segments.filter((s) => s.status === 'FAILED').length
    const failedB = b.segments.filter((s) => s.status === 'FAILED').length
    const sr = statusRank(a.runStatus) - statusRank(b.runStatus)
    if (sr !== 0) return sr
    if (durA !== durB) return durA - durB
    if (failedA !== failedB) return failedA - failedB
    return 0
  })[0]
}

function deriveNodeDeltas(
  selected?: RunTimelineData | null,
  baseline?: RunTimelineData | null,
): RunDelta[] {
  if (!selected || !baseline) return []
  const byNode = new Map<
    string,
    { selected: number[]; base: number[]; statusChanges: string[] }
  >()
  const push = (
    map: Map<
      string,
      { selected: number[]; base: number[]; statusChanges: string[] }
    >,
    nodeId: string,
    dur: number,
    status: string,
    key: 'selected' | 'base',
  ) => {
    const entry = map.get(nodeId) ?? {
      selected: [],
      base: [],
      statusChanges: [],
    }
    entry[key].push(dur)
    entry.statusChanges.push(status)
    map.set(nodeId, entry)
  }
  selected.segments.forEach((s) => {
    if (!s.nodeId) return
    push(byNode, s.nodeId, s.end - s.start, s.status, 'selected')
  })
  baseline.segments.forEach((s) => {
    if (!s.nodeId) return
    push(byNode, s.nodeId, s.end - s.start, s.status, 'base')
  })
  const deltas: RunDelta[] = []
  byNode.forEach((entry, nodeId) => {
    if (!entry.selected.length || !entry.base.length) return
    const avgSel =
      entry.selected.reduce((a, b) => a + b, 0) / entry.selected.length
    const avgBase = entry.base.reduce((a, b) => a + b, 0) / entry.base.length
    const delta = avgSel - avgBase
    const varianceSel =
      entry.selected.reduce((acc, v) => acc + Math.pow(v - avgSel, 2), 0) /
      Math.max(1, entry.selected.length)
    const varianceBase =
      entry.base.reduce((acc, v) => acc + Math.pow(v - avgBase, 2), 0) /
      Math.max(1, entry.base.length)
    const stability =
      1 -
      Math.min(
        1,
        (varianceSel + varianceBase) / Math.max(avgBase || 1, avgSel || 1),
      )
    const reliability =
      1 -
      Math.min(
        1,
        entry.statusChanges.filter((s) => s === 'FAILED').length /
          Math.max(1, entry.statusChanges.length),
      )
    const dataCompleteness =
      entry.selected.length > 0 && entry.base.length > 0 ? 1 : 0.5
    const statusStability = entry.statusChanges.every((s) => s === 'SUCCESS')
      ? 1
      : 0.5
    const score = Math.max(
      0,
      Math.min(
        1,
        (stability + reliability + dataCompleteness + statusStability) / 4,
      ),
    )
    const statusChange = (() => {
      const selStatus = entry.statusChanges[0]
      const baseStatus = entry.statusChanges[entry.statusChanges.length - 1]
      if (selStatus !== baseStatus) return `${baseStatus} → ${selStatus}`
      return undefined
    })()
    deltas.push({
      nodeId,
      durationDelta: delta,
      statusDelta: statusChange,
      confidence: score,
      confidenceLabel: confidenceLabel(score),
    })
  })
  return deltas
    .sort((a, b) => Math.abs(b.durationDelta) - Math.abs(a.durationDelta))
    .slice(0, 3)
}

export default function RunTimelineSummary({
  runs,
  selectedRunId,
  aiCoachHasInsights = false,
  workspaceId,
  userId = 'local-user',
}: RunTimelineSummaryProps) {
  const hasMulti = runs.length > 1
  const selectedRun = runs.find((r) => r.runId === selectedRunId) ?? runs[0]

  const storageKey = `builderRunSummary:${workspaceId}:${userId}`
  const adminKey = `builderRunSummaryAdmin:${workspaceId}:enabled`
  const [settings, setSettings] = useState<SummarySettings>(defaultSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [adminEnabled, setAdminEnabled] = useState(true)
  const isWorkspaceAdmin = false // TODO: wire real roles when available

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) setSettings({ ...defaultSettings, ...JSON.parse(raw) })
      const adminRaw = window.localStorage.getItem(adminKey)
      if (adminRaw !== null) setAdminEnabled(adminRaw === 'true')
    } catch {
      // ignore
    }
  }, [storageKey, adminKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings))
    } catch {
      // ignore
    }
  }, [settings, storageKey])

  const baseline = useMemo(
    () =>
      pickBestBaseline(
        runs,
        settings.baselineMode === 'pinned'
          ? settings.pinnedBaselineId
          : undefined,
      ),
    [runs, settings.baselineMode, settings.pinnedBaselineId],
  )

  const deltas = useMemo(
    () => deriveNodeDeltas(selectedRun, baseline ?? runs[0]),
    [baseline, runs, selectedRun],
  )

  const headlineConfidence = deltas[0]?.confidenceLabel ?? 'low'

  const shouldShow =
    adminEnabled || isWorkspaceAdmin
      ? (settings.showOnSelection && !!selectedRunId) ||
        (settings.showOnMulti && hasMulti) ||
        (settings.showOnAICoach && aiCoachHasInsights)
      : false

  if (!shouldShow || !selectedRun) return null

  const durationMs = (run: RunTimelineData) =>
    run.segments.reduce((m, s) => Math.max(m, s.end), 0) * 1000

  const selectedDur = durationMs(selectedRun)
  const baselineDur = baseline ? durationMs(baseline) : selectedDur
  const deltaDur = selectedDur - baselineDur

  const subtitle = toneSubtitle[settings.tone]

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-slate-800/70 bg-slate-950/80 p-3 text-[12px] text-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Run Insights</div>
          <div className="text-[11px] text-slate-400">{subtitle}</div>
          {!adminEnabled && !isWorkspaceAdmin && (
            <div className="text-[10px] text-amber-400">Admin-only</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
        >
          Settings
        </button>
      </div>

      {settingsOpen && (
        <div className="rounded-lg border border-slate-800/70 bg-slate-900/80 p-2 text-[11px] text-slate-200">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showOnSelection}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    showOnSelection: e.target.checked,
                  }))
                }
              />
              Show when a run is selected
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showOnMulti}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, showOnMulti: e.target.checked }))
                }
              />
              Show when multiple runs exist
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showOnAICoach}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    showOnAICoach: e.target.checked,
                  }))
                }
              />
              Show when AI Coach has insights
            </label>
            <div className="flex items-center gap-2">
              <span>Tone</span>
              <select
                className="rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-200"
                value={settings.tone}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, tone: e.target.value as Tone }))
                }
              >
                <option value="hybrid">Hybrid</option>
                <option value="strict">Strict</option>
                <option value="casual">Casual</option>
              </select>
            </div>
            {runs.length > 1 && (
              <div className="flex flex-col gap-1">
                <div className="text-[10px] text-slate-400">Baseline mode</div>
                <select
                  className="rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  value={settings.baselineMode}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      baselineMode: e.target
                        .value as SummarySettings['baselineMode'],
                    }))
                  }
                >
                  <option value="auto">Auto (best run)</option>
                  <option value="pinned">Pin baseline…</option>
                </select>
                {settings.baselineMode === 'pinned' && (
                  <select
                    className="rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-200"
                    value={settings.pinnedBaselineId ?? ''}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        pinnedBaselineId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select run…</option>
                    {runs.map((r) => (
                      <option key={r.runId} value={r.runId}>
                        {r.runLabel ?? r.runId}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 text-[11px] text-slate-200 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="text-slate-400">Baseline</div>
          <div>
            {baseline
              ? `Best Run: ${baseline.runLabel ?? baseline.runId} • ${baseline.runStatus ?? 'UNKNOWN'} • ${(baselineDur / 1000).toFixed(2)}s`
              : 'Auto-selected baseline'}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-slate-400">Selected</div>
          <div>
            {`${selectedRun.runLabel ?? selectedRun.runId} • ${selectedRun.runStatus ?? 'UNKNOWN'} • ${(selectedDur / 1000).toFixed(2)}s`}
          </div>
        </div>
      </div>

      <div className="text-[11px] text-slate-200">
        {deltaDur < -0.01
          ? `Faster by ${Math.abs(deltaDur / 1000).toFixed(2)}s vs baseline. Confidence: ${headlineConfidence.toUpperCase()}.`
          : deltaDur > 0.01
            ? `Slower by ${(deltaDur / 1000).toFixed(2)}s vs baseline. Confidence: ${headlineConfidence.toUpperCase()}.`
            : `No meaningful duration change vs baseline. Confidence: ${headlineConfidence.toUpperCase()}.`}
      </div>

      {deltas.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-slate-200">
            Top changes
          </div>
          <ul className="mt-1 list-disc space-y-[2px] pl-4 text-[11px] text-slate-200">
            {deltas.map((d) => (
              <li key={d.nodeId}>
                {d.nodeId}: {d.durationDelta >= 0 ? '+' : ''}
                {(d.durationDelta / 1000).toFixed(2)}s
                {d.statusDelta ? ` and ${d.statusDelta}` : ''}
                {` (Confidence: ${d.confidenceLabel})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-[11px] font-semibold text-slate-200">AI Coach</div>
        <div className="text-[11px] text-slate-300">
          {aiCoachHasInsights
            ? 'AI Coach has notes for this run. Open AI Coach for details.'
            : 'No AI Coach notes for this run.'}
        </div>
      </div>
    </div>
  )
}
