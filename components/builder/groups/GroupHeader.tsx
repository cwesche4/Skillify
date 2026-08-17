'use client'

import type { FC } from 'react'

type Props = {
  name?: string
  collapsed: boolean
  onToggle: () => void
}

export const GroupHeader: FC<Props> = ({ name, collapsed, onToggle }) => {
  return (
    <div className="flex items-center justify-between text-[12px] text-slate-100">
      <span className="font-semibold">{name || 'Group'}</span>
      <button
        type="button"
        onClick={onToggle}
        className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-100 hover:border-slate-500"
      >
        {collapsed ? 'Expand' : 'Collapse'}
      </button>
    </div>
  )
}

export default GroupHeader
