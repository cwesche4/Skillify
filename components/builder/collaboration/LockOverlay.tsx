'use client'

/* ============================================================================
   POINTER-EVENTS-NONE — UI-ONLY SOFT LOCKS
   Visual cues for collaborator intent. No enforcement or mutations.
============================================================================ */

import type { CollaborationSession } from '@/lib/collaboration/types'
import { assignCursorColor } from '@/lib/collaboration/colors'
import type { Node as RFNode } from 'reactflow'

interface LockOverlayProps {
  session: CollaborationSession | null
  nodes: RFNode[]
  visible: boolean
}

export default function LockOverlay({
  session,
  nodes,
  visible,
}: LockOverlayProps) {
  if (!visible || !session) return null
  if (!session.locks?.length) return null

  const collaboratorMap = new Map(
    session.collaborators.map((c) => [c.userId, c]),
  )
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div className="pointer-events-none absolute inset-0 z-[35]">
      {session.locks.map((lock) => {
        const node = lock.nodeId ? nodeMap.get(lock.nodeId) : null
        if (!node) return null

        const collaborator = collaboratorMap.get(lock.lockedBy)
        const name = collaborator?.name || 'Someone'
        const color = collaborator?.color || assignCursorColor(lock.lockedBy)

        // ReactFlow node coords are in canvas space; this is a UI-only overlay.
        const left = node.position.x
        const top = node.position.y

        // RF nodes may or may not have measured size; keep safe defaults.
        const width =
          (node as any)?.width ?? (node as any)?.measured?.width ?? 180
        const height =
          (node as any)?.height ?? (node as any)?.measured?.height ?? 84

        const isHard = lock.mode === 'hard'

        return (
          <div
            key={`${lock.nodeId}-${lock.lockedBy}-${lock.since}`}
            className="absolute"
            style={{ left, top, width, height }}
          >
            {/* Node outline */}
            <div
              className="h-full w-full rounded-lg border-2 border-dashed"
              style={{
                borderColor: isHard ? `${color}AA` : `${color}66`,
                boxShadow: `0 0 0 1px ${isHard ? `${color}55` : `${color}22`}`,
                background: isHard ? `${color}10` : 'transparent',
                opacity: isHard ? 0.95 : 0.75,
              }}
            />

            {/* Label pill */}
            <div
              className="absolute -left-2 -top-2 rounded-md border bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-slate-100 shadow-lg backdrop-blur"
              style={{
                borderColor: `${color}CC`,
                boxShadow: `0 0 0 1px ${color}55`,
              }}
            >
              <div className="flex items-center gap-1">
                <span className="opacity-80">{isHard ? '🔒' : '👀'}</span>
                <span>{name}</span>
                <span className="opacity-60">
                  {isHard ? 'locked' : 'viewing'}
                </span>
              </div>

              {/* Tooltip-like hint (still pointer-events-none) */}
              <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-slate-300/70">
                {isHard ? 'Hard lock (preview)' : 'Soft lock (advisory)'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
