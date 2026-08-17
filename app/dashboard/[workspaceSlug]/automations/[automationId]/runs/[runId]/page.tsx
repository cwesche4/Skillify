// app/dashboard/[workspaceSlug]/automations/[automationId]/runs/[runId]/page.tsx

import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/Badge'
import { prisma } from '@/lib/db'

interface PageProps {
  params: { workspaceSlug: string; automationId: string; runId: string }
}

interface RunRecord {
  id: string
  status: string
  log: string | null
  startedAt: Date
  finishedAt: Date | null
  durationMs: number | null
  automation: {
    id: string
    name: string
    flow: unknown
  }
  workspace: {
    id: string
    name: string
    slug: string
  }
  events: Array<{
    id: string
    nodeId: string
    nodeType: string
    status: string
    message: string | null
    path: string | null
    createdAt: Date
  }>
}

function formatDate(date: Date | null) {
  if (!date) return '—'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatDuration(
  run: Pick<RunRecord, 'durationMs' | 'startedAt' | 'finishedAt'>,
) {
  const durationMs =
    typeof run.durationMs === 'number'
      ? run.durationMs
      : run.finishedAt
        ? run.finishedAt.getTime() - run.startedAt.getTime()
        : null

  if (durationMs == null) return '—'
  if (durationMs < 1000) return `${Math.max(0, durationMs)} ms`

  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) return `${seconds} sec`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes} min ${remainingSeconds} sec`
}

type FlowNodeSummary = {
  id: string
  label?: string
  name?: string
  type?: string
  data?: {
    label?: string
    name?: string
    title?: string
    stepLabel?: string
  }
}

function getFlowNodes(flow: unknown): FlowNodeSummary[] {
  if (!flow || typeof flow !== 'object') return []

  const nodes = (flow as { nodes?: unknown }).nodes
  if (!Array.isArray(nodes)) return []

  return nodes.filter((node): node is FlowNodeSummary =>
    Boolean(
      node &&
      typeof node === 'object' &&
      typeof (node as { id?: unknown }).id === 'string',
    ),
  )
}

function getNodeLabel(node?: FlowNodeSummary) {
  if (!node) return null

  return (
    node.data?.label ??
    node.data?.name ??
    node.data?.title ??
    node.label ??
    node.name ??
    null
  )
}

function summarizeLog(log: string | null) {
  if (!log?.trim()) return 'No error log recorded.'

  const lines = log
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const likelyError =
    lines.find((line) => /error|failed|exception|timeout/i.test(line)) ??
    lines[lines.length - 1]

  return likelyError ?? 'No error log recorded.'
}

export default async function RunDetailsPage({ params }: PageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: {
      id: true,
      role: true,
      memberships: {
        where: {
          workspace: {
            slug: params.workspaceSlug,
          },
        },
        select: {
          id: true,
        },
      },
    },
  })
  if (!profile) redirect('/sign-in')

  const isGlobalAdmin = profile?.role === 'admin'
  const hasWorkspaceAccess = profile.memberships.length > 0 || isGlobalAdmin

  if (!hasWorkspaceAccess) {
    redirect('/dashboard')
  }

  // Fetch run details
  const run: RunRecord | null = await prisma.automationRun.findFirst({
    where: {
      id: params.runId,
      automationId: params.automationId,
      workspace: {
        slug: params.workspaceSlug,
      },
    },
    select: {
      id: true,
      status: true,
      log: true,
      startedAt: true,
      finishedAt: true,
      durationMs: true,
      automation: {
        select: {
          id: true,
          name: true,
          flow: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      events: {
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          nodeId: true,
          nodeType: true,
          status: true,
          message: true,
          path: true,
          createdAt: true,
        },
      },
    },
  })

  if (!run) {
    redirect(
      `/dashboard/${params.workspaceSlug}/automations/${params.automationId}/runs`,
    )
  }

  const statusColor =
    run.status === 'SUCCESS'
      ? 'green'
      : run.status === 'FAILED'
        ? 'red'
        : 'default'
  const automationHref = `/dashboard/${run.workspace.slug}/automations/${run.automation.id}`
  const workflowHref = `${automationHref}/builder`
  const runsHref = `${automationHref}/runs`
  const flowNodes = getFlowNodes(run.automation.flow)
  const failedEvent =
    run.events.find((event) => event.status === 'FAILED') ??
    run.events.find((event) =>
      /error|failed|exception|timeout/i.test(event.message ?? ''),
    )
  const failedNode = failedEvent
    ? flowNodes.find((node) => node.id === failedEvent.nodeId)
    : undefined
  const failedNodeName = getNodeLabel(failedNode)
  const timelineItems = run.events.length
    ? run.events
    : run.log
      ? run.log
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, index) => ({
            id: `${run.id}-log-${index}`,
            nodeId: '',
            nodeType: 'Log',
            status: 'INFO',
            message: line,
            path: null,
            createdAt: run.startedAt,
          }))
      : []

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="h2 flex items-center gap-3">
            Run Details
            <Badge variant={statusColor}>{run.status}</Badge>
          </h1>

          <p className="body text-neutral-text-secondary">
            Automation: <strong>{run.automation.name}</strong>
          </p>

          <p className="text-neutral-text-secondary text-sm">
            Workspace: <strong>{run.workspace.name}</strong>
          </p>

          {isGlobalAdmin ? (
            <p className="mt-2 inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-200">
              Opened from platform admin context
            </p>
          ) : null}

          <details className="text-neutral-text-secondary mt-2 text-xs">
            <summary className="cursor-pointer select-none">
              Technical details
            </summary>
            <div className="mt-1 space-y-0.5 font-mono">
              <div>Workspace: {run.workspace.id}</div>
              <div>Automation: {run.automation.id}</div>
              <div>Run: {run.id}</div>
            </div>
          </details>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={workflowHref}
            className="border-brand-primary/80 hover:bg-brand-primary/90 inline-flex h-8 items-center justify-center rounded-xl border bg-brand-primary px-3 text-xs font-medium text-white transition-colors"
          >
            Open workflow
          </Link>
          <Link
            href={automationHref}
            className="text-neutral-text-primary inline-flex h-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-medium transition-colors hover:bg-slate-800"
          >
            Back to automation
          </Link>
          <Link
            href={runsHref}
            className="text-neutral-text-primary inline-flex h-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-medium transition-colors hover:bg-slate-800"
          >
            Back to history
          </Link>
          {isGlobalAdmin ? (
            <Link
              href="/dashboard/admin/system"
              className="text-neutral-text-primary inline-flex h-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-medium transition-colors hover:bg-slate-800"
            >
              Back to system
            </Link>
          ) : null}
        </div>
      </div>

      {run.status === 'FAILED' ? (
        <div className="card space-y-4 border-rose-500/30 bg-rose-500/[0.04] p-5">
          <div>
            <h2 className="h4">Failure Summary</h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              Where Skillify could identify the failed step, it appears below.
            </p>
          </div>

          {failedEvent ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <p className="text-neutral-text-secondary text-xs">
                  Failed node
                </p>
                <p className="text-sm font-medium">
                  {failedNodeName ?? 'Node name not recorded'}
                </p>
                <p className="text-neutral-text-secondary mt-1 font-mono text-[11px]">
                  {failedEvent.nodeId}
                </p>
              </div>

              <div>
                <p className="text-neutral-text-secondary text-xs">Node type</p>
                <p className="text-sm font-medium">{failedEvent.nodeType}</p>
              </div>

              <div>
                <p className="text-neutral-text-secondary text-xs">
                  Step label
                </p>
                <p className="text-sm font-medium">
                  {failedNode?.data?.stepLabel ??
                    failedEvent.path ??
                    'Not recorded'}
                </p>
              </div>

              <div>
                <p className="text-neutral-text-secondary text-xs">Failed at</p>
                <p className="text-sm font-medium">
                  {formatDate(failedEvent.createdAt)}
                </p>
              </div>

              <div className="md:col-span-4">
                <p className="text-neutral-text-secondary text-xs">
                  Error message
                </p>
                <p className="mt-1 rounded-lg border border-rose-500/20 bg-slate-950/60 p-3 text-sm text-rose-100">
                  {failedEvent.message ?? summarizeLog(run.log)}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 md:col-span-4 md:grid-cols-3">
                <div>
                  <p className="text-neutral-text-secondary text-xs">
                    Node Name
                  </p>
                  <p className="text-sm font-medium">
                    {failedNodeName ?? 'Not available yet'}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-text-secondary text-xs">
                    Error Reason
                  </p>
                  <p className="text-sm font-medium">
                    {failedEvent.message
                      ? 'Recorded in event message'
                      : 'Not available yet'}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-text-secondary text-xs">
                    Jump To Node
                  </p>
                  <p className="text-sm font-medium">Not available yet</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-rose-500/20 bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-rose-100">
                This run failed, but node-level failure details are not recorded
                yet.
              </p>
              <p className="text-neutral-text-secondary mt-2 text-sm">
                The available execution log is shown below so you can inspect
                the failure manually.
              </p>
              {run.log ? (
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
                  {run.log}
                </pre>
              ) : null}
              <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 md:grid-cols-3">
                <div>
                  <p className="text-neutral-text-secondary text-xs">
                    Failure Source
                  </p>
                  <p className="text-sm font-medium">Not available yet</p>
                  <p className="text-neutral-text-secondary mt-1 text-[11px]">
                    When node-level execution tracking is added, failure details
                    will appear here.
                  </p>
                </div>
                <div>
                  <p className="text-neutral-text-secondary text-xs">
                    Node Name
                  </p>
                  <p className="text-sm font-medium">Not available yet</p>
                </div>
                <div>
                  <p className="text-neutral-text-secondary text-xs">
                    Jump To Node
                  </p>
                  <p className="text-sm font-medium">Not available yet</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* SUMMARY CARD */}
      <div className="card grid grid-cols-1 gap-6 md:grid-cols-4">
        <div>
          <p className="text-neutral-text-secondary text-sm">Status</p>
          <Badge variant={statusColor}>{run.status}</Badge>
        </div>

        <div>
          <p className="text-neutral-text-secondary text-sm">Started</p>
          <p className="font-medium">{formatDate(run.startedAt)}</p>
        </div>

        <div>
          <p className="text-neutral-text-secondary text-sm">Finished</p>
          <p className="font-medium">{formatDate(run.finishedAt)}</p>
        </div>

        <div>
          <p className="text-neutral-text-secondary text-sm">Duration</p>
          <p className="font-medium">{formatDuration(run)}</p>
        </div>
      </div>

      {/* LOG VIEWER */}
      <div className="card space-y-4 p-5">
        <div>
          <h2 className="h4">Execution Log</h2>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Raw runtime output for this run.
          </p>
        </div>

        {run.log ? (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            {run.log.split('\n').map((line, index) => (
              <div
                key={`${index}-${line}`}
                className="grid grid-cols-[3rem_1fr] border-b border-slate-900 last:border-b-0"
              >
                <div className="select-none border-r border-slate-900 bg-slate-900/70 px-3 py-1.5 text-right font-mono text-[11px] text-slate-500">
                  {index + 1}
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap px-3 py-1.5 font-mono text-xs leading-relaxed text-slate-300">
                  {line || ' '}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-text-secondary text-sm">
            No logs recorded.
          </p>
        )}
      </div>

      {/* TIMELINE CARD */}
      <div className="card space-y-4 p-5">
        <div>
          <h2 className="h4">Timeline</h2>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Ordered run events, with node context when available.
          </p>
        </div>

        <div className="space-y-3 border-l border-slate-700 pl-4">
          {timelineItems.map((item) => {
            const node = item.nodeId
              ? flowNodes.find((flowNode) => flowNode.id === item.nodeId)
              : undefined
            const nodeLabel = getNodeLabel(node)

            return (
              <div key={item.id} className="relative -ml-[21px] flex gap-3">
                <div
                  className={`mt-1.5 h-2.5 w-2.5 rounded-full border ${
                    item.status === 'FAILED'
                      ? 'border-rose-300 bg-rose-500'
                      : item.status === 'SUCCESS'
                        ? 'border-emerald-300 bg-emerald-500'
                        : 'border-sky-300 bg-sky-500'
                  }`}
                />
                <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      size="xs"
                      variant={
                        item.status === 'FAILED'
                          ? 'red'
                          : item.status === 'SUCCESS'
                            ? 'green'
                            : 'blue'
                      }
                    >
                      {item.status}
                    </Badge>
                    <span className="text-xs font-medium text-slate-200">
                      {nodeLabel ?? item.nodeType}
                    </span>
                    <span className="text-neutral-text-secondary text-[11px]">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  {item.message ? (
                    <p className="mt-2 text-xs leading-relaxed text-slate-300">
                      {item.message}
                    </p>
                  ) : null}

                  {(item.nodeId || item.path) && (
                    <details className="text-neutral-text-secondary mt-2 text-[11px]">
                      <summary className="cursor-pointer select-none">
                        Event details
                      </summary>
                      <div className="mt-1 space-y-0.5 font-mono">
                        {item.nodeId ? <div>Node: {item.nodeId}</div> : null}
                        {item.nodeType ? (
                          <div>Type: {item.nodeType}</div>
                        ) : null}
                        {item.path ? <div>Path: {item.path}</div> : null}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )
          })}

          {!timelineItems.length && (
            <p className="text-neutral-text-secondary text-sm">
              Timeline unavailable.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
