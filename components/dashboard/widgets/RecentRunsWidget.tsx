// components/dashboard/widgets/RecentRunsWidget.tsx

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface RecentRunView {
  id: string
  name: string
  timestamp: string
  duration: string
  status: string
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
    <Card className="space-y-4 p-6">
      <h3 className="text-sm font-medium">Recent Activity</h3>

      {runs.length === 0 && (
        <p className="text-neutral-text-secondary text-sm">
          No recent activity.
        </p>
      )}

      {runs.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between border-b border-neutral-border pb-3 last:border-none"
        >
          <div>
            <p className="text-sm font-medium">{r.name}</p>
            <p className="text-neutral-text-secondary mt-1 text-xs">
              {new Date(r.timestamp).toLocaleString()} • {r.duration}
            </p>
          </div>

          <Badge
            variant={
              r.status === 'SUCCESS'
                ? 'green'
                : r.status === 'FAILED'
                  ? 'red'
                  : 'blue'
            }
          >
            {r.status}
          </Badge>
        </div>
      ))}
    </Card>
  )
}
