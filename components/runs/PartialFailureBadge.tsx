import type { FC } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = {
  label?: string
}

export const PartialFailureBadge: FC<Props> = ({
  label = 'Run completed with partial failures',
}) => {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-1 text-[12px] font-medium text-amber-100">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  )
}

export default PartialFailureBadge
