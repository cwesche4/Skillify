// components/dashboard/widgets/WorkspaceSuccessRate.tsx

import Link from 'next/link'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

interface AffectedAutomation {
  id: string
  name: string
  failedCount: number
  latestRunFailed: boolean
  latestFailedAt: string | null
  failureHref: string
  workflowHref: string
}

interface Props {
  data: {
    health: 'Healthy' | 'Attention Required'
    successRate: string
    failedRunCount: number
    failedAutomationCount: number
    automationsNeedingAttention: number
    affectedAutomations: AffectedAutomation[]
  }
  workspaceId: string
}

export default function WorkspaceSuccessRate({ data }: Props) {
  const {
    health,
    successRate,
    failedRunCount,
    automationsNeedingAttention,
    affectedAutomations,
  } = data
  const hasFailures = failedRunCount > 0

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Workspace Health</h3>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Last 20 runs across this workspace.
          </p>
        </div>
        <Badge variant={hasFailures ? 'yellow' : 'green'}>{health}</Badge>
      </div>

      <p
        className={`text-3xl font-semibold ${
          hasFailures ? 'text-amber-400' : 'text-emerald-400'
        }`}
      >
        {health}
      </p>

      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-border bg-slate-950/30 p-2">
          <p className="text-neutral-text-secondary">Success Rate</p>
          <p className="text-neutral-text-primary mt-1 font-semibold">
            {successRate}%
          </p>
        </div>
        <div className="rounded-lg border border-neutral-border bg-slate-950/30 p-2">
          <p className="text-neutral-text-secondary">Failed Runs</p>
          <p className="text-neutral-text-primary mt-1 font-semibold">
            {failedRunCount}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-border bg-slate-950/30 p-2">
          <p className="text-neutral-text-secondary">
            Automations Needing Attention
          </p>
          <p className="text-neutral-text-primary mt-1 font-semibold">
            {automationsNeedingAttention}
          </p>
        </div>
      </div>

      {hasFailures ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-amber-200">Needs Attention</p>
          {affectedAutomations.slice(0, 3).map((automation) => (
            <div
              key={automation.id}
              className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-neutral-text-primary truncate text-xs font-medium">
                    {automation.name}
                  </p>
                  <p className="text-neutral-text-secondary mt-0.5 text-[11px]">
                    Last Failure:{' '}
                    {automation.latestFailedAt
                      ? new Date(automation.latestFailedAt).toLocaleString()
                      : 'Not recorded'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={automation.failureHref}
                    className="text-[11px] font-medium text-amber-300 hover:text-amber-200 hover:underline"
                  >
                    View Failure
                  </Link>
                  <Link
                    href={automation.workflowHref}
                    className="text-[11px] font-medium text-brand-primary hover:underline"
                  >
                    Open Workflow
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  )
}
