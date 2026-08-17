'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Node } from 'reactflow'

import InspectorPanel from '@/app/dashboard/[workspaceSlug]/automations/[automationId]/builder/components/InspectorPanel'
import {
  type BuilderNodeType,
  NODE_DEFINITIONS,
  type NodeData,
} from '@/lib/builder/node-types'

const workspaceId = 'ws-test'
const automationId = 'auto-test'

export default function InspectorE2EPage() {
  const [open, setOpen] = useState(true)
  const [pinned, setPinned] = useState(false)
  const [follow, setFollow] = useState(true)
  const [widthPreset, setWidthPreset] = useState<
    'compact' | 'standard' | 'wide'
  >('standard')

  const initialNode = useMemo(() => {
    const type =
      (Object.keys(NODE_DEFINITIONS)[0] as BuilderNodeType) ||
      ('webhook' as BuilderNodeType)
    const node: Node<NodeData> = {
      id: 'node-1',
      type,
      position: { x: 0, y: 0 },
      data: {},
    }
    return node
  }, [])

  const [node, setNode] = useState<Node<NodeData>>(initialNode)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ']') {
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <button
          data-testid="inspector-open-btn"
          className="rounded border border-slate-700 px-3 py-2"
          onClick={() => setOpen(true)}
        >
          Open Inspector
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100">
      <div
        className="flex-1 overflow-auto p-3"
        data-testid="e2e-inspector-page"
      >
        <div className="mb-3 flex gap-4 text-xs text-slate-300">
          <span data-testid="pin-state">pinned:{String(pinned)}</span>
          <span data-testid="follow-state">follow:{String(follow)}</span>
          <span data-testid="width-state">width:{widthPreset}</span>
        </div>
        <InspectorPanel
          data-testid="inspector-root"
          node={node}
          onChangeNode={(id, data) => {
            if (id === node.id) {
              setNode({ ...node, data: { ...(node.data as any), ...data } })
            }
          }}
          onAiImprove={() => {}}
          workspaceId={workspaceId}
          automationId={automationId}
          planLabel="Elite"
          logs={[{ ts: Date.now(), level: 'info', message: 'Replay hint' }]}
          layoutVariant="standard"
          widthPreset={widthPreset}
          pinned={pinned}
          onTogglePin={() => setPinned((v) => !v)}
          onPreset={(size) => {
            setWidthPreset(
              size <= 320 ? 'compact' : size >= 560 ? 'wide' : 'standard',
            )
          }}
          showLayoutBadge
          followsSelection={follow}
          onToggleFollowsSelection={() => setFollow((v) => !v)}
          dockSide="right"
        />
      </div>
    </div>
  )
}
