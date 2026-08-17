// components/dashboard/widgets/RecentRunsWidget.tsx

import Link from 'next/link'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface RecentRunView {
  id: string
  automationId: string
  name: string
  timestamp: string
  duration: string
  status: string
  runHref: string
  workflowHref: string
}

interface Props {
  data: {
    runs: RecentRunView[]
  }
  workspaceId: string
}

export default function RecentRunsWidget({ data }: Props) {
  const { runs } = data

  return (
    <Card className="space-y-3 p-5">
      <h3 className="text-sm font-medium">Recent Activity</h3>

      {runs.length === 0 && (
        <p className="text-neutral-text-secondary text-sm">
          No recent activity.
        </p>
      )}

      <div className="space-y-1.5">
        {runs.map((r) => {
          const badgeVariant =
            r.status === 'SUCCESS'
              ? 'green'
              : r.status === 'FAILED'
                ? 'red'
                : 'yellow'

          return (
            <div
              key={r.id}
              className={`relative rounded-lg border px-3 py-2.5 transition-colors ${
                r.status === 'FAILED'
                  ? 'border-rose-500/30 bg-rose-500/[0.04] hover:bg-rose-500/[0.08]'
                  : r.status === 'SUCCESS'
                    ? 'border-emerald-500/20 hover:bg-emerald-500/[0.04]'
                    : 'border-amber-500/25 bg-amber-500/[0.03] hover:bg-amber-500/[0.07]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={r.runHref}
                  className="absolute inset-0 rounded-lg"
                  aria-label={`Open run details for ${r.name}`}
                />

                <div className="relative z-10 min-w-0 flex-1">
                  <Link
                    href={r.workflowHref}
                    className="text-neutral-text-primary block truncate text-sm font-medium hover:text-brand-primary hover:underline"
                  >
                    {r.name}
                  </Link>
                  <span className="text-neutral-text-secondary mt-1 block text-xs">
                    {new Date(r.timestamp).toLocaleString()} • {r.duration}
                  </span>
                </div>

                <Link
                  href={r.runHref}
                  className="relative z-10 rounded-full transition-opacity hover:opacity-80"
                  aria-label={`Open ${r.status.toLowerCase()} run details for ${r.name}`}
                >
                  <Badge variant={badgeVariant}>{r.status}</Badge>
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
