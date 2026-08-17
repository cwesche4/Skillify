'use client'

import type { FC, ReactNode } from 'react'
import GroupHeader from './GroupHeader'

type Props = {
  name?: string
  collapsed: boolean
  rect: { x: number; y: number; width: number; height: number }
  onToggle: () => void
  children?: ReactNode
}

// Visual grouping only.
// Groups must not affect execution, routing, compatibility, or persistence.
export const GroupContainer: FC<Props> = ({
  name,
  collapsed,
  rect,
  onToggle,
  children,
}) => {
  return (
    <div
      className="pointer-events-none absolute rounded border border-slate-700/70 bg-slate-900/40 backdrop-blur-sm"
      style={{
        left: rect.x - 12,
        top: rect.y - 12,
        width: rect.width + 24,
        height: rect.height + 24,
      }}
    >
      <div className="pointer-events-auto bg-slate-950/80 p-2">
        <GroupHeader name={name} collapsed={collapsed} onToggle={onToggle} />
        {!collapsed ? (
          <div className="mt-2 text-[11px] text-slate-400">{children}</div>
        ) : null}
      </div>
    </div>
  )
}

export default GroupContainer
