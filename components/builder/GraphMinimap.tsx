import type { FC } from 'react'
import { MiniMap } from 'reactflow'

type Props = {
  visible: boolean
}

export const GraphMinimap: FC<Props> = ({ visible }) => {
  if (!visible) return null
  return (
    <div className="absolute bottom-4 right-4 z-10 rounded border border-slate-800 bg-slate-950/90 shadow-lg">
      <MiniMap
        nodeStrokeColor="#94a3b8"
        nodeColor="#1e293b"
        maskColor="rgba(15,23,42,0.6)"
        className="h-32 w-48"
      />
    </div>
  )
}

export default GraphMinimap
