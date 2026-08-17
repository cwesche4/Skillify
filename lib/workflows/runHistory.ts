import type {
  WorkflowExecution,
  WorkflowExecutionLog,
  WorkflowExecutionStep,
  WorkflowRunKind,
  WorkflowRunStatus,
} from '@/lib/workflows/types'
import type {
  WorkflowExecutionGraph,
  WorkflowExecutionReport,
} from '@/lib/workflows/executionEngine'

export type WorkflowRunHistoryStatus =
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'cancelled'

export type WorkflowRunHistoryItem = {
  id: string
  workflowId: string
  workspaceId: string
  workflowVersion: string
  timestamp: string
  durationMs: number
  status: WorkflowRunHistoryStatus
  rawStatus: WorkflowRunStatus
  triggerSource: string
  runKind: WorkflowRunKind
  workflowFingerprint?: string
  nodeCount: number
  warningCount: number
  errorCount: number
  steps: WorkflowExecutionStep[]
  variables: Record<string, unknown>
  outputs: Record<string, Record<string, unknown>>
  errors: string[]
  warnings: string[]
  logs: WorkflowExecutionLog[]
  graph?: WorkflowExecutionGraph
  validation?: WorkflowExecution['validation']
  execution: WorkflowExecutionReport
}

export type WorkflowRunHistoryStats = {
  total: number
  runsToday: number
  runsThisWeek: number
  successRate: number
  failureRate: number
  averageRuntimeMs: number
  mostCommonError: string
}

const STORAGE_PREFIX = 'skillify.workflowRunHistory'
const MAX_RUNS_PER_WORKFLOW = 50

function storageKey(workspaceId: string, workflowId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}:${workflowId}`
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function normalizeStatus(status: WorkflowRunStatus): WorkflowRunHistoryStatus {
  if (status === 'succeeded') return 'completed'
  if (status === 'failed') return 'failed'
  if (status === 'skipped') return 'stopped'
  return 'cancelled'
}

function normalizeRunKind(execution: WorkflowExecutionReport): WorkflowRunKind {
  if (execution.runKind) return execution.runKind
  return execution.mode === 'preview' ? 'preview' : 'live'
}

export function workflowRunKindLabel(kind: WorkflowRunKind) {
  if (kind === 'test') return 'Test Run'
  if (kind === 'live') return 'Live Run'
  return 'Preview Run'
}

function errorMessages(execution: WorkflowExecutionReport) {
  return [
    execution.error,
    ...execution.logs
      .filter((log) => log.level === 'error')
      .map((log) => log.message),
    ...execution.steps.map((step) => step.error).filter(Boolean),
  ].filter(Boolean) as string[]
}

function warningMessages(execution: WorkflowExecutionReport) {
  return execution.logs
    .filter((log) => log.level === 'warning')
    .map((log) => log.message)
}

export function createWorkflowRunHistoryItem(
  execution: WorkflowExecutionReport,
): WorkflowRunHistoryItem {
  const durationMs =
    execution.summary?.executionTimeMs ??
    (execution.finishedAt
      ? Math.max(
          0,
          Date.parse(execution.finishedAt) - Date.parse(execution.startedAt),
        )
      : 0)
  const errors = errorMessages(execution)
  const warnings = warningMessages(execution)
  return {
    id: execution.id,
    workflowId: execution.workflowId,
    workspaceId: execution.workspaceId,
    workflowVersion: execution.replay?.workflowVersion ?? 'preview-local',
    timestamp: execution.startedAt,
    durationMs,
    status: normalizeStatus(execution.status),
    rawStatus: execution.status,
    triggerSource: execution.triggerSource,
    runKind: normalizeRunKind(execution),
    workflowFingerprint: execution.workflowFingerprint,
    nodeCount: execution.steps.filter((step) => step.nodeId !== 'workflow')
      .length,
    warningCount: warnings.length,
    errorCount: errors.length,
    steps: execution.steps,
    variables: execution.replay?.variables ?? {},
    outputs: execution.replay?.outputs ?? {},
    errors,
    warnings,
    logs: execution.logs,
    graph: execution.graph as WorkflowExecutionGraph | undefined,
    validation: execution.validation,
    execution,
  }
}

export function loadWorkflowRunHistory(
  workspaceId: string,
  workflowId: string,
): WorkflowRunHistoryItem[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId, workflowId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.map((run) => ({
          ...run,
          runKind:
            run.runKind ??
            (run.execution?.mode === 'preview' ? 'preview' : 'live'),
          workflowFingerprint:
            run.workflowFingerprint ?? run.execution?.workflowFingerprint,
        }))
      : []
  } catch {
    return []
  }
}

export function saveWorkflowRunHistory(
  workspaceId: string,
  workflowId: string,
  runs: WorkflowRunHistoryItem[],
) {
  if (!canUseStorage()) return
  window.localStorage.setItem(
    storageKey(workspaceId, workflowId),
    JSON.stringify(runs.slice(0, MAX_RUNS_PER_WORKFLOW)),
  )
}

export function recordWorkflowRunHistory(
  execution: WorkflowExecutionReport,
): WorkflowRunHistoryItem[] {
  const item = createWorkflowRunHistoryItem(execution)
  const existing = loadWorkflowRunHistory(item.workspaceId, item.workflowId)
  const next = [item, ...existing.filter((run) => run.id !== item.id)].slice(
    0,
    MAX_RUNS_PER_WORKFLOW,
  )
  saveWorkflowRunHistory(item.workspaceId, item.workflowId, next)
  return next
}

export function clearWorkflowRunHistory(
  workspaceId: string,
  workflowId: string,
) {
  if (!canUseStorage()) return
  window.localStorage.removeItem(storageKey(workspaceId, workflowId))
}

export function searchWorkflowRunHistory(
  runs: WorkflowRunHistoryItem[],
  query: string,
) {
  const q = query.trim().toLowerCase()
  if (!q) return runs
  return runs.filter((run) => {
    const haystack = [
      run.id,
      run.workflowId,
      run.status,
      run.timestamp,
      run.triggerSource,
      run.runKind,
      run.validation?.readinessState,
      run.workflowFingerprint,
      ...run.errors,
      ...run.warnings,
      ...run.steps.map(
        (step) => `${step.label} ${step.nodeType} ${step.error ?? ''}`,
      ),
      ...Object.keys(run.variables),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function groupWorkflowRunHistory(runs: WorkflowRunHistoryItem[]) {
  const now = new Date()
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000
  return {
    Today: runs.filter((run) => Date.parse(run.timestamp) >= todayStart),
    Yesterday: runs.filter((run) => {
      const time = Date.parse(run.timestamp)
      return time >= yesterdayStart && time < todayStart
    }),
    'This Week': runs.filter((run) => {
      const time = Date.parse(run.timestamp)
      return time >= weekStart && time < yesterdayStart
    }),
    Earlier: runs.filter((run) => Date.parse(run.timestamp) < weekStart),
  }
}

export function getWorkflowRunHistoryStats(
  runs: WorkflowRunHistoryItem[],
): WorkflowRunHistoryStats {
  const now = new Date()
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000
  const completed = runs.filter((run) => run.status === 'completed').length
  const failed = runs.filter((run) => run.status === 'failed').length
  const errorCounts = new Map<string, number>()
  for (const run of runs) {
    for (const error of run.errors) {
      errorCounts.set(error, (errorCounts.get(error) ?? 0) + 1)
    }
  }
  const mostCommonError =
    [...errorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'None'
  return {
    total: runs.length,
    runsToday: runs.filter((run) => Date.parse(run.timestamp) >= todayStart)
      .length,
    runsThisWeek: runs.filter((run) => Date.parse(run.timestamp) >= weekStart)
      .length,
    successRate: runs.length ? Math.round((completed / runs.length) * 100) : 0,
    failureRate: runs.length ? Math.round((failed / runs.length) * 100) : 0,
    averageRuntimeMs: runs.length
      ? Math.round(
          runs.reduce((sum, run) => sum + run.durationMs, 0) / runs.length,
        )
      : 0,
    mostCommonError,
  }
}

export function exportWorkflowRunJson(run: WorkflowRunHistoryItem) {
  return JSON.stringify(run, null, 2)
}

export function exportWorkflowRunLogs(run: WorkflowRunHistoryItem) {
  return run.logs
    .map(
      (log) =>
        `[${log.timestamp}] ${log.level.toUpperCase()} ${log.nodeId ?? 'workflow'}: ${log.message}`,
    )
    .join('\n')
}

export function createWorkflowDebugReport(run: WorkflowRunHistoryItem) {
  return [
    `Run: ${run.id}`,
    `Workflow: ${run.workflowId}`,
    `Status: ${run.status}`,
    `Kind: ${workflowRunKindLabel(run.runKind)}`,
    `Readiness: ${run.validation?.readinessLabel ?? 'Unknown'}`,
    `Revision: ${run.workflowFingerprint ?? 'Unknown'}`,
    `Runtime: ${run.durationMs}ms`,
    `Nodes: ${run.nodeCount}`,
    `Warnings: ${run.warningCount}`,
    `Errors: ${run.errorCount}`,
    '',
    'Errors',
    run.errors.length
      ? run.errors.map((item) => `- ${item}`).join('\n')
      : '- None',
    '',
    'Timeline',
    run.steps
      .map(
        (step) =>
          `- ${step.label}: ${step.status} (${step.startedAt ?? 'n/a'} -> ${step.finishedAt ?? 'n/a'})`,
      )
      .join('\n'),
  ].join('\n')
}
