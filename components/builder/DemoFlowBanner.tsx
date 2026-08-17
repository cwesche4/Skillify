import type { FC } from 'react'
import type { DemoFlow } from '@/lib/builder/demos/demoFlows'

type Props = {
  demo?: DemoFlow
  onDuplicate?: () => void
}

export const DemoFlowBanner: FC<Props> = ({ demo, onDuplicate }) => {
  if (!demo) return null
  return (
    <div className="mb-3 rounded border border-amber-600/70 bg-amber-600/10 px-3 py-2 text-sm text-amber-100">
      <div className="font-semibold">{demo.name}</div>
      <div className="text-[12px] text-amber-200/90">{demo.description}</div>
      <div className="text-[11px] text-amber-300/90">
        Demo flows are read-only. Must be duplicated to become production.
      </div>
      {onDuplicate ? (
        <button
          type="button"
          onClick={onDuplicate}
          className="mt-2 rounded border border-amber-600 px-2 py-1 text-[12px] text-amber-50 hover:border-amber-500"
        >
          Promote (duplicate) to workspace
        </button>
      ) : null}
    </div>
  )
}

export default DemoFlowBanner
