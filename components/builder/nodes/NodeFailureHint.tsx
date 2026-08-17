import type { FC } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = {
  message?: string
}

export const NodeFailureHint: FC<Props> = ({ message }) => {
  if (!message) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-rose-600/60 bg-rose-600/10 px-2 py-1 text-[11px] text-rose-100"
      title={message}
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      Failure
    </span>
  )
}

export default NodeFailureHint
