'use client'

export type PresenceCursor = {
  id: string
  name: string
  color: string
  position: { x: number; y: number }
}

export type NodeLock = {
  id: string
  nodeId: string
  user: string
  color: string
}

interface CollaborationOverlayProps {
  cursors: PresenceCursor[]
  locks: NodeLock[]
  visible?: boolean
  className?: string
}

export default function CollaborationOverlay({
  cursors,
  locks,
  visible = true,
  className,
}: CollaborationOverlayProps) {
  if (!visible) return null

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 ${className ?? ''}`}
    >
      {/* Cursors */}
      {cursors.map((c) => (
        <div
          key={c.id}
          className="absolute -translate-y-2 translate-x-2"
          style={{ left: c.position.x, top: c.position.y }}
        >
          <div
            className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-slate-950/90 px-2 py-1 text-[11px] font-semibold text-slate-100 shadow-lg"
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

      {/* Locks */}
      {locks.map((lock) => (
        <div
          key={lock.id}
          className="absolute translate-y-[-10px]"
          style={{
            left: `calc(var(--node-${lock.nodeId}-x, 0px) + 12px)`,
            top: `calc(var(--node-${lock.nodeId}-y, 0px) - 12px)`,
          }}
        >
          <div
            className="pointer-events-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-900"
            style={{ background: lock.color, borderColor: lock.color }}
          >
            Editing: {lock.user}
          </div>
        </div>
      ))}
    </div>
  )
}
