'use client'

import { Card } from '@/components/ui/Card'
import type { FailureCluster } from '@/lib/analytics/types'

export default function FailureBreakdown({
  failures,
}: {
  failures: FailureCluster[]
}) {
  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-neutral-text-primary text-lg font-semibold">
        Failure Breakdown
      </h2>

      {failures.length === 0 && (
        <p className="text-neutral-text-secondary text-sm">
          No failures recorded.
        </p>
      )}

      {failures.length > 0 && (
        <ul className="space-y-3">
          {failures.map((f, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between border-b border-neutral-border pb-2 last:border-none"
            >
              <span className="text-neutral-text-primary text-sm">
                {f.reason}
              </span>
              <span className="text-sm font-semibold text-rose-400">
                {f.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
