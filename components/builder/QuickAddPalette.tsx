'use client'

import type { FC } from 'react'
import QuickAddNode from './QuickAddNode'
import type { BuilderNodeType } from '@/lib/builder/node-types'

type Option = {
  type: BuilderNodeType
  label: string
  category?: string
}

type Props = {
  options: Option[]
  allowedTypes?: BuilderNodeType[]
  recentTypes?: BuilderNodeType[]
  onSelect: (type: BuilderNodeType) => void
  typeAhead?: string
  onTypeAheadConsumed?: () => void
  onClose?: () => void
  patterns?: { id: string; name: string; description?: string }[]
  onSelectPattern?: (id: string) => void
  favoriteTypes?: BuilderNodeType[]
}

// Lightweight wrapper for edge-first palette placement.
export const QuickAddPalette: FC<Props> = ({
  options,
  allowedTypes,
  recentTypes,
  onSelect,
  typeAhead,
  onTypeAheadConsumed,
  onClose,
  patterns,
  onSelectPattern,
  favoriteTypes,
}) => {
  return (
    // Builder-only UX.
    // QuickAddPalette must never infer compatibility,
    // trigger execution, or persist non-node state.
    <QuickAddNode
      options={options}
      allowedTypes={allowedTypes}
      recentTypes={recentTypes}
      onSelect={onSelect}
      typeAhead={typeAhead}
      onTypeAheadConsumed={onTypeAheadConsumed}
      onClose={onClose}
      patterns={patterns}
      onSelectPattern={onSelectPattern}
      favoriteTypes={favoriteTypes}
    />
  )
}

export default QuickAddPalette
