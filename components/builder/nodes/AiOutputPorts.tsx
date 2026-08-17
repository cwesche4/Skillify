import type { FC } from 'react'
import type { AiOutputField } from '@/lib/builder/nodes/aiSchema'

type Props = {
  outputs: AiOutputField[]
}

export const AiOutputPorts: FC<Props> = ({ outputs }) => {
  if (!outputs.length) return null
  return (
    <div className="rounded border border-slate-800 bg-slate-950/80 p-2 text-[12px] text-slate-100">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Outputs
      </div>
      <div className="mt-1 space-y-1">
        {outputs.map((o) => (
          <div
            key={o.name}
            className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 px-2 py-1"
          >
            <span className="truncate font-semibold text-slate-100">
              {o.label}
            </span>
            <span className="text-[10px] text-slate-500">{o.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AiOutputPorts
