import type { FC } from 'react'
import { Slash } from 'lucide-react'

type Props = {
  visible: boolean
}

export const SkippedIndicator: FC<Props> = ({ visible }) => {
  if (!visible) return null
  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
      <Slash className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      Skipped
    </span>
  )
}

export default SkippedIndicator
