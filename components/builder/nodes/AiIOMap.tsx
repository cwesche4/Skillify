import type { FC } from 'react'
import { ArrowRight } from 'lucide-react'

type Mapping = {
  from: string
  to: string
}

type Props = {
  inputs: Mapping[]
  outputs: Mapping[]
}

export const AiIOMap: FC<Props> = ({ inputs, outputs }) => {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/80 p-2 text-[12px] text-slate-100">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Inputs
      </div>
      <div className="space-y-1">
        {inputs.length === 0 ? (
          <div className="text-[11px] text-slate-500">No inputs mapped.</div>
        ) : (
          inputs.map((m, idx) => (
            <div
              key={`in-${idx}-${m.from}-${m.to}`}
              className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1"
            >
              <span className="truncate text-slate-200">{m.from}</span>
              <ArrowRight className="h-3 w-3 text-slate-500" aria-hidden />
              <span className="truncate text-slate-300">{m.to}</span>
            </div>
          ))
        )}
      </div>

      <div className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Outputs
      </div>
      <div className="space-y-1">
        {outputs.length === 0 ? (
          <div className="text-[11px] text-slate-500">No outputs defined.</div>
        ) : (
          outputs.map((m, idx) => (
            <div
              key={`out-${idx}-${m.from}-${m.to}`}
              className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1"
            >
              <span className="truncate text-slate-200">{m.from}</span>
              <ArrowRight className="h-3 w-3 text-slate-500" aria-hidden />
              <span className="truncate text-slate-300">{m.to}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default AiIOMap
