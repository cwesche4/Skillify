"use client"

import type { BuilderNodeType } from "../node-types"

import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"

export interface PaletteItem {
  type: BuilderNodeType
  label: string
  locked?: boolean
  lockReason?: string
}

interface NodePaletteProps {
  items: PaletteItem[]
  fullscreen: boolean
  onToggleFullscreen: () => void

  // Actions
  onAutoLayout: () => void
  onGroupSelected: () => void
  onUndo: () => void
  onRedo: () => void

  canGroup: boolean
  canUndo: boolean
  canRedo: boolean

  planLabel: string
}

export default function NodePalette({
  items,
  fullscreen,
  onToggleFullscreen,
  onAutoLayout,
  onGroupSelected,
  onUndo,
  onRedo,
  canGroup,
  canUndo,
  canRedo,
  planLabel,
}: NodePaletteProps) {
  return (
    <div className="w-64 space-y-4 border-r border-slate-800 bg-slate-950/95 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Nodes</h2>
          <p className="text-[10px] text-slate-500">Drag into canvas to build flows.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge size="xs" variant="blue">
            {planLabel}
          </Badge>
          <Button variant="subtle" size="sm" onClick={onToggleFullscreen}>
            {fullscreen ? "Exit" : "Full"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((node) => (
          <div
            key={node.type}
            draggable={!node.locked}
            onDragStart={(event) => {
              if (node.locked) {
                event.preventDefault()
                return
              }
              event.dataTransfer.setData("application/reactflow", node.type)
              event.dataTransfer.effectAllowed = "move"
            }}
            className={[
              "cursor-grab rounded-lg border px-3 py-2 text-sm transition-colors active:cursor-grabbing",
              node.locked
                ? "cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-600"
                : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{node.label}</span>
              {node.locked && (
                <span className="text-[9px] uppercase tracking-wide text-amber-500">
                  Upgrade
                </span>
              )}
            </div>
            {node.locked && node.lockReason && (
              <p className="mt-1 text-[9px] text-slate-500">{node.lockReason}</p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-slate-800 pt-4">
        <Button variant="subtle" size="sm" className="w-full" onClick={onAutoLayout}>
          Auto Layout
        </Button>
        <Button
          variant="subtle"
          size="sm"
          className="w-full"
          onClick={onGroupSelected}
          disabled={!canGroup}
        >
          Group Selected
        </Button>
        <div className="flex gap-2">
          <Button
            variant="subtle"
            size="sm"
            className="flex-1"
            onClick={onUndo}
            disabled={!canUndo}
          >
            Undo
          </Button>
          <Button
            variant="subtle"
            size="sm"
            className="flex-1"
            onClick={onRedo}
            disabled={!canRedo}
          >
            Redo
          </Button>
        </div>
      </div>
    </div>
  )
}
