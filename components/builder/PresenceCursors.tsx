'use client'

import type { CSSProperties } from 'react'

type Cursor = {
  id: string
  name: string
  color: string
  cursor: { x: number; y: number }
}

interface PresenceCursorsProps {
  cursors: Cursor[]
}

export default function PresenceCursors({ cursors }: PresenceCursorsProps) {
  if (!cursors.length) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {cursors.map((c) => (
        <div
          key={c.id}
          className="absolute -translate-y-5 translate-x-2"
          style={
            {
              left: c.cursor.x,
              top: c.cursor.y,
            } as CSSProperties
          }
        >
          <div
            className="pointer-events-none flex items-center gap-2 rounded-lg border bg-slate-950/90 px-2 py-1 text-[11px] font-semibold text-slate-50 shadow-lg backdrop-blur"
            style={{
              borderColor: c.color,
              boxShadow: `0 0 0 1px ${c.color}55`,
            }}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: c.color }}
            />
            {c.name}
          </div>
        </div>
      ))}
    </div>
  )
}
