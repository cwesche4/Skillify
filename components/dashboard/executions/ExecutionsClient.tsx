'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ClearFiltersButton } from '@/components/ui/ClearFiltersButton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import {
  ChartCard,
  DonutBreakdown,
  InsightBarChart,
  RecommendedActionsCard,
  SavedViewTabs,
  TimelineStrip,
  type InsightBreakdownPoint,
  type InsightSeriesPoint,
} from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'
import type {
  ExecutionStatus,
  ExecutionStep,
  WorkflowExecution,
} from '@/lib/executions/types'
import { useClearFilters } from '@/hooks/useClearFilters'
import { useScrollToQueryTarget } from '@/hooks/useScrollToQueryTarget'

type TimeRange = 'all' | '24h' | '7d' | '30d'
type StatusFilter = 'all' | ExecutionStatus

type OverviewItem = {
  label: string
  value: string
  helper: string
  dotClassName: string
}

const statusOptions: StatusFilter[] = [
  'all',
  'success',
  'failed',
  'pending',
  'running',
]
const statusTabs: StatusFilter[] = [
  'all',
  'failed',
  'running',
  'success',
  'pending',
]

const timeRangeOptions: TimeRange[] = ['all', '24h', '7d', '30d']

const statusVariant: Record<ExecutionStatus, BadgeVariant> = {
  success: 'green',
  failed: 'red',
  pending: 'yellow',
  running: 'blue',
}

const statusDotClassName: Record<ExecutionStatus, string> = {
  success: 'bg-emerald-400',
  failed: 'bg-rose-400',
  pending: 'bg-amber-400',
  running: 'bg-sky-400',
}

export function ExecutionsClient({
  executions,
  workflows,
  workspaceSlug,
  hasRealExecutions,
}: {
  executions: WorkflowExecution[]
  workflows: string[]
  workspaceSlug: string
  hasRealExecutions: boolean
}) {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [workflow, setWorkflow] = useState('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [search, setSearch] = useState('')
  const [slowRunsOnly, setSlowRunsOnly] = useState(false)
  const [activeSavedViewId, setActiveSavedViewId] = useState('all')
  const [selectedExecution, setSelectedExecution] =
    useState<WorkflowExecution | null>(executions[0] ?? null)

  const scrollTarget =
    searchParams.get('view') === 'slow-runs'
      ? 'runtime-chart'
      : searchParams.get('view') ||
          searchParams.get('status') ||
          searchParams.get('executionId')
        ? 'execution-history'
        : null

  const slowRunThreshold = useMemo(() => {
    const durations = executions
      .map((execution) => execution.durationMs)
      .filter((duration): duration is number => typeof duration === 'number')
    if (durations.length === 0) return null
    return Math.round(
      durations.reduce((total, duration) => total + duration, 0) /
        durations.length,
    )
  }, [executions])

  const filteredExecutions = useMemo(() => {
    const now = Date.now()
    const rangeMs =
      timeRange === 'all'
        ? null
        : timeRange === '24h'
          ? 24 * 60 * 60 * 1000
          : timeRange === '7d'
            ? 7 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000
    const query = search.trim().toLowerCase()

    return executions.filter((execution) => {
      const startedAt = execution.startedAt
        ? new Date(execution.startedAt).getTime()
        : null

      if (status !== 'all' && execution.status !== status) return false
      if (
        slowRunsOnly &&
        (execution.durationMs == null ||
          slowRunThreshold == null ||
          execution.durationMs <= slowRunThreshold)
      ) {
        return false
      }
      if (workflow !== 'all' && execution.workflowName !== workflow)
        return false
      if (
        rangeMs != null &&
        startedAt &&
        now - startedAt > rangeMs &&
        !execution.isMock
      ) {
        return false
      }
      if (
        query &&
        !execution.workflowName.toLowerCase().includes(query) &&
        !execution.id.toLowerCase().includes(query)
      ) {
        return false
      }

      return true
    })
  }, [
    executions,
    search,
    slowRunThreshold,
    slowRunsOnly,
    status,
    timeRange,
    workflow,
  ])

  useScrollToQueryTarget(
    scrollTarget,
    `${filteredExecutions.length}:${selectedExecution?.id ?? ''}`,
  )

  const applySavedView = (viewId: string) => {
    setActiveSavedViewId(viewId)
    setWorkflow('all')
    setTimeRange('all')
    setSearch('')
    setSlowRunsOnly(false)
    if (viewId === 'failed') setStatus('failed')
    else if (viewId === 'running') setStatus('running')
    else if (viewId === 'success') setStatus('success')
    else if (viewId === 'pending') setStatus('pending')
    else if (viewId === 'slow-runs') {
      setStatus('all')
      setSlowRunsOnly(true)
    } else setStatus('all')
  }

  useEffect(() => {
    const view = searchParams.get('view')
    const statusParam = searchParams.get('status') as StatusFilter | null
    const executionId = searchParams.get('executionId')

    if (view) applySavedView(view)
    if (statusParam && statusOptions.includes(statusParam)) {
      setSlowRunsOnly(false)
      setStatus(statusParam)
    }
    if (executionId) {
      const execution = executions.find((record) => record.id === executionId)
      if (execution) setSelectedExecution(execution)
    }
  }, [executions, searchParams])

  const metrics = useMemo(() => {
    const source = hasRealExecutions
      ? executions.filter((execution) => !execution.isMock)
      : executions
    const total = source.length
    const successful = source.filter((run) => run.status === 'success').length
    const failed = source.filter((run) => run.status === 'failed').length
    const pending = source.filter((run) => run.status === 'pending').length
    const running = source.filter((run) => run.status === 'running').length
    const completed = successful + failed
    const successRate =
      completed > 0 ? Math.round((successful / completed) * 100) : 0
    const durations = source
      .map((run) => run.durationMs)
      .filter((duration): duration is number => typeof duration === 'number')
    const averageDuration =
      durations.length > 0
        ? Math.round(
            durations.reduce((sum, duration) => sum + duration, 0) /
              durations.length,
          )
        : null

    return {
      total,
      successful,
      failed,
      pending,
      running,
      completed,
      successRate,
      averageDuration,
    }
  }, [executions, hasRealExecutions])

  const overview: OverviewItem[] = useMemo(() => {
    return [
      {
        label: 'Total runs',
        value: metrics.total.toString(),
        helper: 'All executions',
        dotClassName: 'bg-cyan-300',
      },
      {
        label: 'Successful',
        value: metrics.successful.toString(),
        helper: 'Completed normally',
        dotClassName: statusDotClassName.success,
      },
      {
        label: 'Success Rate',
        value: metrics.completed > 0 ? `${metrics.successRate}%` : '-',
        helper:
          metrics.completed > 0
            ? `${metrics.successful}/${metrics.completed} completed runs`
            : 'No completed runs',
        dotClassName: 'bg-violet-300',
      },
      {
        label: 'Failed',
        value: metrics.failed.toString(),
        helper: metrics.failed > 0 ? 'Needs attention' : 'No failed runs',
        dotClassName: statusDotClassName.failed,
      },
      {
        label: 'Pending',
        value: metrics.pending.toString(),
        helper: metrics.pending > 0 ? 'Awaiting start' : 'No pending runs',
        dotClassName: statusDotClassName.pending,
      },
      {
        label: 'Average duration',
        value:
          metrics.averageDuration == null
            ? '-'
            : formatDuration(metrics.averageDuration),
        helper: 'Across completed runs',
        dotClassName: statusDotClassName.running,
      },
    ]
  }, [metrics])

  const executionVisuals = useMemo(() => {
    const source = hasRealExecutions
      ? executions.filter((execution) => !execution.isMock)
      : executions
    const byStatus: InsightBreakdownPoint[] = statusOptions
      .filter((option): option is ExecutionStatus => option !== 'all')
      .map((option) => ({
        label: titleCase(option),
        value: source.filter((execution) => execution.status === option).length,
        color:
          option === 'success'
            ? '#34d399'
            : option === 'failed'
              ? '#fb7185'
              : option === 'running'
                ? '#22d3ee'
                : '#f59e0b',
      }))
      .filter((item) => item.value > 0)
    const runsOverTime: InsightSeriesPoint[] = [
      {
        label: 'Jun 24',
        value: Math.max(metrics.total - 4, 0),
        secondary: Math.max(metrics.failed - 1, 0),
      },
      {
        label: 'Jun 25',
        value: Math.max(metrics.total - 3, 0),
        secondary: Math.max(metrics.failed - 1, 0),
      },
      {
        label: 'Jun 26',
        value: Math.max(metrics.total - 2, 0),
        secondary: metrics.failed,
      },
      {
        label: 'Jun 27',
        value: Math.max(metrics.total - 1, 0),
        secondary: metrics.failed,
      },
      { label: 'Today', value: metrics.total, secondary: metrics.failed },
    ]
    const runtimeByWorkflow: InsightBreakdownPoint[] = source
      .map((execution) => ({
        label: execution.workflowName,
        value: execution.durationMs ?? 0,
        helper:
          execution.status === 'failed'
            ? (execution.errorMessage ?? 'Failed run')
            : execution.trigger,
        color: execution.status === 'failed' ? '#fb7185' : '#22d3ee',
      }))
      .filter((item) => item.value > 0)
      .slice(0, 6)

    return {
      byStatus,
      runtimeByWorkflow,
      runsOverTime,
    }
  }, [executions, hasRealExecutions, metrics])

  const healthStatus =
    metrics.failed > 0
      ? 'Attention Required'
      : metrics.running > 0
        ? 'Running'
        : 'Healthy'
  const healthBody =
    metrics.failed > 0
      ? metrics.failed === 1
        ? 'Most automations are operating normally. One execution requires attention.'
        : `Most automations are operating normally. ${metrics.failed} executions require attention.`
      : metrics.total > 0
        ? 'Automations are operating normally with no failed executions in this view.'
        : 'Executions will be monitored here once automations begin running.'

  const resetFilters = () => {
    setActiveSavedViewId('all')
    setStatus('all')
    setWorkflow('all')
    setTimeRange('all')
    setSearch('')
  }
  const expectedStatusForView = statusOptions.includes(
    activeSavedViewId as StatusFilter,
  )
    ? (activeSavedViewId as StatusFilter)
    : 'all'
  const expectedSlowRunsOnly = activeSavedViewId === 'slow-runs'
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      status: status === expectedStatusForView ? '' : status,
      slowRunsOnly: slowRunsOnly === expectedSlowRunsOnly ? false : true,
      workflow: workflow === 'all' ? '' : workflow,
      timeRange: timeRange === 'all' ? '' : timeRange,
      search,
    },
    onClear: () => {
      setStatus(expectedStatusForView)
      setSlowRunsOnly(expectedSlowRunsOnly)
      setWorkflow('all')
      setTimeRange('all')
      setSearch('')
    },
  })

  const focusFailures = () => {
    setStatus('failed')
  }

  const firstFailedExecution = executions.find(
    (execution) => execution.status === 'failed',
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {overview.map((item) => (
          <Card key={item.label} className="p-3.5">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.dotClassName}`} />
              <p className="text-neutral-text-secondary text-xs font-medium">
                {item.label}
              </p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-neutral-100">
              {item.value}
            </p>
            <p className="text-neutral-text-secondary mt-1 text-xs">
              {item.helper}
            </p>
          </Card>
        ))}
      </div>

      <Card className="border-amber-400/20 bg-amber-400/[0.04] p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-100">
                Execution Health
              </h2>
              <Badge variant={metrics.failed > 0 ? 'yellow' : 'green'}>
                {healthStatus}
              </Badge>
              {!hasRealExecutions ? <Badge>Preview</Badge> : null}
            </div>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              {healthBody}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={focusFailures}
              disabled={metrics.failed === 0}
            >
              View failures
            </Button>
            {firstFailedExecution?.workflowHref &&
            !firstFailedExecution.isMock ? (
              <Link
                href={firstFailedExecution.workflowHref}
                className="border-brand-primary/70 hover:bg-brand-primary/90 inline-flex h-8 items-center rounded-xl border bg-brand-primary px-3 text-xs font-medium text-white transition-colors"
              >
                Open workflow
              </Link>
            ) : (
              <Button type="button" size="sm" variant="subtle" disabled>
                Open workflow
              </Button>
            )}
          </div>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <ChartCard
          title="Execution reliability strip"
          description="Run density by day with failed periods highlighted."
        >
          <TimelineStrip
            data={executionVisuals.runsOverTime.map((point) => ({
              label: point.label,
              value: point.value,
              failed: point.secondary,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Run status mix"
          description={`${metrics.successRate}% success rate across completed runs.`}
        >
          <DonutBreakdown
            data={executionVisuals.byStatus}
            centerValue={
              metrics.completed > 0 ? `${metrics.successRate}%` : '-'
            }
            centerLabel="Success"
          />
        </ChartCard>
      </section>

      <div id="runtime-chart" className="scroll-mt-28">
        <ChartCard
          title="Average runtime by workflow"
          description="Preview of runtime pressure points for workflow monitoring."
        >
          <InsightBarChart
            data={executionVisuals.runtimeByWorkflow}
            valueSuffix="ms"
          />
        </ChartCard>
      </div>

      <RecommendedActionsCard
        description="Use execution signals to debug failures and protect automation reliability."
        actions={[
          {
            title: 'Review failed executions',
            detail:
              'Failed runs are the fastest path to improving automation reliability.',
            tone: 'rose',
            cta: 'View failures',
            onClick: focusFailures,
          },
          {
            title: 'Inspect slow workflows',
            detail:
              'Longer runtimes can point to bottlenecks or third-party delays.',
            tone: 'amber',
            cta: 'Review runtime chart',
            onClick: () => setTimeRange('30d'),
          },
          {
            title: 'Open workflow builder',
            detail:
              'Workflow-level debugging will connect to real run details when available.',
            tone: 'cyan',
            cta: 'Open workflow',
          },
        ]}
      />

      <SavedViewTabs
        activeViewId={activeSavedViewId}
        onSelect={applySavedView}
        views={[
          { id: 'all', label: 'All Runs', count: executions.length },
          {
            id: 'failed',
            label: 'Failed Runs',
            count: executions.filter(
              (execution) => execution.status === 'failed',
            ).length,
            tone: 'rose',
          },
          {
            id: 'running',
            label: 'Running',
            count: executions.filter(
              (execution) => execution.status === 'running',
            ).length,
            tone: 'cyan',
          },
          {
            id: 'success',
            label: 'Successful',
            count: executions.filter(
              (execution) => execution.status === 'success',
            ).length,
            tone: 'green',
          },
          {
            id: 'pending',
            label: 'Pending',
            count: executions.filter(
              (execution) => execution.status === 'pending',
            ).length,
            tone: 'amber',
          },
          {
            id: 'slow-runs',
            label: 'Slow Runs',
            count:
              slowRunThreshold == null
                ? 0
                : executions.filter(
                    (execution) =>
                      execution.durationMs != null &&
                      execution.durationMs > slowRunThreshold,
                  ).length,
            tone: 'purple',
          },
        ]}
        trailingAction={
          <ClearFiltersButton
            count={activeFilterCount}
            onClear={clearFilters}
          />
        }
      />

      <Card className="p-3.5">
        <div className="mb-3 flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setSlowRunsOnly(false)
                setStatus(tab)
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                status === tab
                  ? 'border-brand-primary/70 bg-brand-primary/15 text-cyan-100'
                  : 'text-neutral-text-secondary hover:border-brand-primary/40 border-neutral-border bg-slate-950/30 hover:text-neutral-100'
              }`}
            >
              {tab === 'all' ? 'All' : titleCase(tab)}
            </button>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.5fr]">
          <FilterSelect
            label="Status"
            value={status}
            onChange={(value) => {
              setSlowRunsOnly(false)
              setStatus(value as StatusFilter)
            }}
            options={statusOptions.map((option) => ({
              label: option === 'all' ? 'All' : titleCase(option),
              value: option,
            }))}
          />
          <FilterSelect
            label="Workflow"
            value={workflow}
            onChange={setWorkflow}
            options={[
              { label: 'All workflows', value: 'all' },
              ...workflows.map((name) => ({ label: name, value: name })),
            ]}
          />
          <FilterSelect
            label="Time range"
            value={timeRange}
            onChange={(value) => setTimeRange(value as TimeRange)}
            options={timeRangeOptions.map((option) => ({
              label: option === 'all' ? 'All time' : option,
              value: option,
            }))}
          />
          <label className="block">
            <span className="text-neutral-text-secondary text-xs font-medium">
              Search
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workflow or execution ID"
              className="focus:border-brand-primary/70 focus:ring-brand-primary/20 mt-2 h-10 w-full rounded-xl border border-neutral-border bg-slate-950/50 px-3 text-sm text-neutral-100 outline-none transition focus:ring-2"
            />
          </label>
        </div>
      </Card>

      <div
        id="execution-history"
        className="grid scroll-mt-28 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="border-b border-neutral-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-100">
                    Execution History
                  </h2>
                  <p className="text-neutral-text-secondary mt-1 text-xs">
                    {hasRealExecutions
                      ? 'Recent workflow runs across this workspace.'
                      : 'Preview rows show the future execution data shape.'}
                  </p>
                </div>
                {!hasRealExecutions ? <Badge>Preview data</Badge> : null}
              </div>
            </div>

            <Table>
              <THead>
                <TR>
                  <TH>Status</TH>
                  <TH>Workflow</TH>
                  <TH>Trigger</TH>
                  <TH>Started</TH>
                  <TH>Duration</TH>
                  <TH>Steps</TH>
                  <TH>Error</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filteredExecutions.length === 0 ? (
                  <TR>
                    <TD colSpan={8} className="py-10 text-center">
                      <p className="text-sm font-medium text-neutral-100">
                        No executions match your current filters.
                      </p>
                      <p className="text-neutral-text-secondary mx-auto mt-1 max-w-md text-xs">
                        Try changing the status, workflow, time range, or search
                        query.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={resetFilters}
                        className="mt-4"
                      >
                        Reset filters
                      </Button>
                    </TD>
                  </TR>
                ) : (
                  filteredExecutions.map((execution) => (
                    <TR key={execution.id}>
                      <TD>
                        <Badge variant={statusVariant[execution.status]}>
                          {titleCase(execution.status)}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="min-w-44">
                          <p className="font-medium text-neutral-100">
                            {execution.workflowName}
                          </p>
                          <p className="text-neutral-text-secondary font-mono text-[11px]">
                            {execution.id}
                          </p>
                        </div>
                      </TD>
                      <TD className="text-neutral-text-secondary">
                        {execution.trigger}
                      </TD>
                      <TD className="text-neutral-text-secondary">
                        {formatDate(execution.startedAt)}
                      </TD>
                      <TD>{formatDuration(execution.durationMs)}</TD>
                      <TD>
                        {execution.stepsCompleted}/{execution.stepsTotal}
                      </TD>
                      <TD className="max-w-52">
                        <span className="text-neutral-text-secondary line-clamp-2 text-xs">
                          {execution.errorMessage ?? '-'}
                        </span>
                      </TD>
                      <TD>
                        <div className="flex min-w-48 flex-wrap gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => setSelectedExecution(execution)}
                          >
                            View details
                          </Button>
                          {execution.status === 'failed' ? (
                            <Button
                              type="button"
                              size="xs"
                              variant="subtle"
                              disabled
                              title="Retry will be connected to the execution engine later."
                            >
                              Retry
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => setSelectedExecution(execution)}
                          >
                            View Logs
                          </Button>
                          {execution.workflowHref && !execution.isMock ? (
                            <Link
                              href={execution.workflowHref}
                              className="text-neutral-text-primary inline-flex h-7 items-center rounded-xl border border-slate-700 bg-transparent px-2 text-[11px] font-medium transition-colors hover:bg-slate-900/60"
                            >
                              Open workflow
                            </Link>
                          ) : (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled
                            >
                              Open workflow
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </Card>

          <RecentExecutionTimeline executions={executions} />
        </div>

        <div className="space-y-4">
          <ExecutionDetailCard execution={selectedExecution} />
        </div>
      </div>

      {!hasRealExecutions ? (
        <div className="flex justify-center">
          <Link
            href={`/dashboard/${workspaceSlug}/automations`}
            className="border-brand-primary/80 hover:bg-brand-primary/90 inline-flex h-9 items-center rounded-xl border bg-brand-primary px-3.5 text-sm font-medium text-white transition-colors"
          >
            Create automation
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
}) {
  return (
    <label className="block">
      <span className="text-neutral-text-secondary text-xs font-medium">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus:border-brand-primary/70 focus:ring-brand-primary/20 mt-2 h-10 w-full rounded-xl border border-neutral-border bg-slate-950/50 px-3 text-sm text-neutral-100 outline-none transition focus:ring-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function RecentExecutionTimeline({
  executions,
}: {
  executions: WorkflowExecution[]
}) {
  const timeline = executions.slice(0, 4)

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Recent execution activity
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Latest workflow status signals.
          </p>
        </div>
        <Badge size="xs">Recent</Badge>
      </div>

      <div className="mt-4 space-y-3">
        {timeline.length > 0 ? (
          timeline.map((execution) => (
            <div key={execution.id} className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${statusDotClassName[execution.status]}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-text-secondary text-[10px] font-semibold uppercase tracking-[0.12em]">
                    {execution.status}
                  </span>
                </div>
                <p className="truncate text-sm font-medium text-neutral-100">
                  {execution.workflowName}
                </p>
                <p className="text-neutral-text-secondary text-xs">
                  {formatDate(execution.startedAt)} ·{' '}
                  {formatRelativeTime(execution.startedAt)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-neutral-text-secondary text-sm">
            Execution activity will appear here after workflows run.
          </p>
        )}
      </div>
    </Card>
  )
}

function ExecutionDetailCard({
  execution,
}: {
  execution: WorkflowExecution | null
}) {
  if (!execution) {
    return (
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-neutral-100">
          Execution Details
        </h2>
        <p className="text-neutral-text-secondary mt-2 text-sm">
          Select a run to inspect its steps, logs, and error details.
        </p>
      </Card>
    )
  }

  const steps = buildSteps(execution)

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Execution Details
          </h2>
          <p className="text-neutral-text-secondary mt-1 font-mono text-[11px]">
            {execution.id}
          </p>
        </div>
        <Badge variant={statusVariant[execution.status]}>
          {titleCase(execution.status)}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <DetailRow label="Workflow" value={execution.workflowName} />
        <DetailRow label="Trigger" value={execution.trigger} />
        <DetailRow label="Started" value={formatDate(execution.startedAt)} />
        <DetailRow
          label="Duration"
          value={formatDuration(execution.durationMs)}
        />
        <DetailRow
          label="Steps"
          value={`${execution.stepsCompleted}/${execution.stepsTotal}`}
        />
      </div>

      {execution.status === 'failed' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="xs" variant="subtle" disabled>
            Retry
          </Button>
          <Button type="button" size="xs" variant="outline" disabled>
            View Logs
          </Button>
          {execution.workflowHref && !execution.isMock ? (
            <Link
              href={execution.workflowHref}
              className="text-neutral-text-primary inline-flex h-7 items-center rounded-xl border border-slate-700 bg-transparent px-2 text-[11px] font-medium transition-colors hover:bg-slate-900/60"
            >
              Open workflow
            </Link>
          ) : (
            <Button type="button" size="xs" variant="outline" disabled>
              Open workflow
            </Button>
          )}
        </div>
      ) : null}

      <div className="mt-5">
        <h3 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
          Step timeline
        </h3>
        <div className="mt-3 space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="flex gap-3">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  step.status === 'success'
                    ? 'bg-emerald-400'
                    : step.status === 'failed'
                      ? 'bg-rose-400'
                      : step.status === 'running'
                        ? 'bg-sky-400'
                        : 'bg-amber-400'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-neutral-100">
                  {step.name}
                </p>
                <p className="text-neutral-text-secondary text-xs">
                  {step.message ?? titleCase(step.status)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
          Logs
        </h3>
        <div className="mt-3 max-h-44 overflow-auto rounded-xl border border-neutral-border bg-slate-950/50 p-3">
          {execution.logs.length > 0 ? (
            <pre className="text-neutral-text-secondary whitespace-pre-wrap text-xs leading-5">
              {execution.logs.join('\n')}
            </pre>
          ) : (
            <p className="text-neutral-text-secondary text-xs">
              No logs recorded for this execution.
            </p>
          )}
        </div>
      </div>

      {execution.errorMessage ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {execution.errorMessage}
        </div>
      ) : null}
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-border bg-slate-950/35 px-3 py-2">
      <span className="text-neutral-text-secondary text-xs">{label}</span>
      <span className="text-right text-xs font-medium text-neutral-100">
        {value}
      </span>
    </div>
  )
}

function buildSteps(execution: WorkflowExecution): ExecutionStep[] {
  if (execution.status === 'failed') {
    const failedDefaults = [
      'Trigger received',
      'Contact lookup',
      execution.errorMessage ?? 'Missing phone number',
      'Failed',
    ]

    return failedDefaults.map((name, index) => ({
      id: `${execution.id}-failed-step-${index}`,
      name,
      status: index >= failedDefaults.length - 2 ? 'failed' : 'success',
      timestamp: execution.startedAt,
      message:
        index === failedDefaults.length - 2 ? execution.errorMessage : null,
    }))
  }

  if (execution.logs.length > 0) {
    const labels = [
      'Trigger received',
      'Contact found',
      'SMS prepared',
      'SMS sent',
      'Completed',
    ]

    return execution.logs.slice(0, 5).map((log, index) => ({
      id: `${execution.id}-log-${index}`,
      name: labels[index] ?? `Step ${index + 1}`,
      status:
        execution.status === 'running' && index === execution.logs.length - 1
          ? 'running'
          : 'success',
      timestamp: execution.startedAt,
      message: log,
    }))
  }

  const defaults = [
    'Trigger received',
    'Contact found',
    'SMS sent',
    'Task created',
    'Completed',
  ]

  return defaults
    .slice(0, Math.max(1, execution.stepsTotal))
    .map((name, index) => ({
      id: `${execution.id}-step-${index}`,
      name,
      status:
        index < execution.stepsCompleted
          ? 'success'
          : execution.status === 'failed'
            ? 'failed'
            : execution.status,
      timestamp: execution.startedAt,
      message: null,
    }))
}

function formatDate(value: string | null) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatRelativeTime(value: string | null) {
  if (!value) return 'not started'

  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.round(diffMs / 60000))

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) return '-'
  if (durationMs < 1000) return `${Math.max(0, durationMs)} ms`

  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
