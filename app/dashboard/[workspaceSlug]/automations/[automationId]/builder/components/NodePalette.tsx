'use client'

import type { BuilderNodeType } from '@/lib/builder/node-types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getWorkflowNodeIcon } from '@/lib/workflows/nodeIcons'
import { LayoutTemplate, Sparkles } from 'lucide-react'

export interface PaletteItem {
  id: string
  type: BuilderNodeType
  label: string
  category?: string
  locked?: boolean
  lockReason?: string
  description?: string
  favorite?: boolean
  iconKey?: string
  requiredPlan?: 'Pro' | 'Elite'
}

interface NodePaletteProps {
  items: PaletteItem[]
  fullscreen: boolean
  onToggleFullscreen: () => void

  onGroupSelected: () => void
  onUndo: () => void
  onRedo: () => void

  canGroup: boolean
  canUndo: boolean
  canRedo: boolean

  planLabel: string
  onAddNode?: (type: BuilderNodeType, registryNodeId?: string) => void

  onGenerateWithAi?: () => void
  onBrowseTemplates?: () => void
  onAutoLayout?: () => void
  templates?: {
    id: string
    name: string
    description: string
    requiredPlan: 'Pro' | 'Elite'
    blocked: boolean
    blockReason?: string
    onSelect: () => void
  }[]
}

export default function NodePalette({
  items,
  fullscreen,
  onToggleFullscreen,
  onGroupSelected,
  onUndo,
  onRedo,
  canGroup,
  canUndo,
  canRedo,
  planLabel,
  onAddNode,
  onGenerateWithAi,
  onBrowseTemplates,
  onAutoLayout,
  templates = [],
}: NodePaletteProps) {
  const grouped = items.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    const cat = item.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto overscroll-contain border-r border-slate-800 bg-slate-950/95 p-3"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Nodes</h2>
          <p className="text-[10px] text-slate-500">
            Drag nodes into your canvas.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Badge size="xs" variant="blue">
            {planLabel}
          </Badge>
          <Button variant="subtle" size="sm" onClick={onToggleFullscreen}>
            {fullscreen ? 'Exit' : 'Full'}
          </Button>
        </div>
      </div>

      {(onGenerateWithAi || onBrowseTemplates) && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800/70 bg-slate-900/45 p-2">
          {onGenerateWithAi && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Sparkles className="h-4 w-4" />}
              onClick={onGenerateWithAi}
            >
              Generate AI
            </Button>
          )}
          {onBrowseTemplates && (
            <Button
              variant="subtle"
              size="sm"
              leftIcon={<LayoutTemplate className="h-4 w-4" />}
              onClick={onBrowseTemplates}
            >
              Templates
            </Button>
          )}
        </div>
      )}

      {/* Node Groups */}
      <div className="space-y-3 pr-1">
        {templates.length > 0 && (
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                CRM Templates
              </span>
              <Badge size="xs" variant="purple">
                Beta
              </Badge>
            </div>
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-lg border border-slate-800/70 bg-slate-950/80 p-2 text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{tpl.name}</span>
                    <Badge size="xs" variant="blue">
                      {tpl.requiredPlan}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {tpl.description}
                  </p>
                  <Button
                    size="xs"
                    variant={tpl.blocked ? 'subtle' : 'primary'}
                    className="mt-2"
                    onClick={() => {
                      if (tpl.blocked) return
                      tpl.onSelect()
                    }}
                    title={tpl.blockReason}
                    disabled={tpl.blocked}
                  >
                    Use template
                  </Button>
                  {tpl.blocked && tpl.blockReason && (
                    <p className="mt-1 text-[10px] text-amber-400">
                      {tpl.blockReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.entries(grouped).map(([cat, nodes]) => (
          <div key={cat} className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {cat}
            </span>

            {nodes.map((node) =>
              (() => {
                const Icon = getWorkflowNodeIcon(node.iconKey)
                return (
                  <div
                    key={node.id}
                    draggable={!node.locked}
                    onDragStart={(e) => {
                      if (node.locked) return e.preventDefault()
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('application/reactflow', node.type)
                      e.dataTransfer.setData(
                        'application/workflow-node-id',
                        node.id,
                      )
                      // Fallback for browsers that ignore custom MIME keys
                      e.dataTransfer.setData('text/plain', node.type)
                    }}
                    onClick={() => {
                      if (node.locked) {
                        if (process.env.NODE_ENV !== 'production') {
                          console.warn(
                            `[Workflow Builder] Node "${node.label}" is locked and cannot be added: ${node.lockReason ?? 'plan gated'}`,
                          )
                        }
                        return
                      }
                      onAddNode?.(node.type, node.id)
                    }}
                    title={
                      node.locked
                        ? (node.lockReason ??
                          'This node is not available on your plan.')
                        : `Add ${node.label}`
                    }
                    className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                      node.locked
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-600'
                        : 'cursor-grab border-slate-700 bg-slate-900 text-slate-100 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800 active:cursor-grabbing'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-950/80 text-slate-300">
                          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </span>
                        <span className="min-w-0 truncate text-[11px]">
                          {node.label}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {node.locked && (
                          <span className="text-[9px] uppercase text-amber-500">
                            Locked
                          </span>
                        )}
                        {node.requiredPlan && !node.locked && (
                          <Badge size="xs" variant="blue">
                            {node.requiredPlan}
                          </Badge>
                        )}
                        {node.favorite && !node.locked && (
                          <span className="text-[9px] uppercase text-emerald-400">
                            Favorite
                          </span>
                        )}
                      </div>
                    </div>

                    {node.locked && node.lockReason && (
                      <p className="mt-1 text-[9px] text-slate-500">
                        {node.lockReason}
                      </p>
                    )}
                    {node.description ? (
                      <p className="mt-1 line-clamp-2 pl-9 text-[10px] text-slate-500">
                        {node.description}
                      </p>
                    ) : null}
                  </div>
                )
              })(),
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="shrink-0 space-y-2 border-t border-slate-800 pt-3">
        {onAutoLayout && (
          <Button
            variant="subtle"
            size="sm"
            className="w-full"
            onClick={onAutoLayout}
          >
            Auto Layout
          </Button>
        )}

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
