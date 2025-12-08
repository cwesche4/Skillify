// components/dashboard/widgets/WorkspaceMembers.tsx

import { Card } from '@/components/ui/Card'

interface Props {
  data: {
    totalMembers: number
  }
  workspaceId: string
}

export default function WorkspaceMembers({ data }: Props) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium">Members</h3>
      <p className="mt-4 text-4xl font-semibold">{data.totalMembers}</p>
      <p className="text-neutral-text-secondary mt-1 text-xs">
        People with access
      </p>
    </Card>
  )
}
