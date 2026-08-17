'use client'

import type { FC } from 'react'
import type { FlowSection } from '@/lib/builder/sections/sectionStore'

type Props = {
  sections: FlowSection[]
  activeId?: string
  onJump: (id: string) => void
}

// Section navigation.
// Visual-only affordances.
// Must not affect execution, routing, or selection state.
export const SectionNavigator: FC<Props> = ({ sections, activeId, onJump }) => {
  if (!sections.length) return null
  return (
    <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/80 px-2 py-1 text-xs text-slate-100">
      <span className="text-[11px] text-slate-400">Sections</span>
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onJump(section.id)}
          className={`rounded px-2 py-1 ${
            activeId === section.id
              ? 'bg-emerald-600/15 text-emerald-100'
              : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
          }`}
        >
          {section.name || 'Untitled'}
        </button>
      ))}
    </div>
  )
}

export default SectionNavigator
