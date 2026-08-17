'use client'

import type { BuilderNodeType } from '../node-types'
import { INSPECTOR_LAYOUTS } from './layouts'

export type LayoutMatrixEntry = {
  type: BuilderNodeType | 'default'
  variant: string
  tabs: string[]
  badge?: string
}

export const INSPECTOR_LAYOUT_MATRIX: LayoutMatrixEntry[] = [
  {
    type: 'default',
    variant: 'standard',
    tabs: ['config', 'data', 'logs'],
    badge: 'Default',
  },
  ...Object.entries(INSPECTOR_LAYOUTS).map(([type, cfg]) => ({
    type: type as BuilderNodeType,
    variant: cfg?.variant ?? 'standard',
    tabs: cfg?.tabs ?? ['config', 'data', 'logs'],
    badge: cfg?.badge,
  })),
]
