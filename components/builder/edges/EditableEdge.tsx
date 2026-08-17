import type { FC } from 'react'
import type { EdgeProps } from 'reactflow'
import { BaseEdge, getSmoothStepPath } from 'reactflow'

export const EditableEdge: FC<EdgeProps> = (props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
  } = props
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} />
}

export default EditableEdge
