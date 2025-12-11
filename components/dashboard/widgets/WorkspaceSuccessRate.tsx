// components/dashboard/widgets/WorkspaceSuccessRate.tsx

import { Card } from '@/components/ui/Card'

interface Props {
  data: {
    health: 'Excellent' | 'Good' | 'Needs Attention'
    successRate: string
  }
  workspaceId: string
}

export default function WorkspaceSuccessRate({ data }: Props) {
  const { health, successRate } = data

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium">Workspace Health</h3>
      <p
        className={`mt-4 text-3xl font-semibold ${
          health === 'Excellent'
            ? 'text-emerald-400'
            : health === 'Good'
              ? 'text-sky-400'
              : 'text-rose-400'
        }`}
      >
        {health}
      </p>
      <p className="text-neutral-text-secondary mt-1 text-xs">
        Last 20 runs: {successRate}% success rate
      </p>
    </Card>
  )
}
