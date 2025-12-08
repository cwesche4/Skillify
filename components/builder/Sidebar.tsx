// ---------------------------------------------------------------
// FILE: components/builder/Sidebar.tsx
// ---------------------------------------------------------------

'use client'

import React from 'react'
import { useBuilderStore } from '@/lib/builder/useBuilderStore'
import NodePalette from '@/app/dashboard/[workspaceSlug]/automations/[automationId]/builder/components/NodePalette'
import type { BuilderNodeType } from '@/lib/builder/node-types'

export default function Sidebar() {
  const fullscreen = useBuilderStore((s) => s.fullscreen)
  const toggleFullscreen = useBuilderStore((s) => s.toggleFullscreen)

  return (
    <div className="bg-neutral-card-light dark:bg-neutral-card-dark w-64 overflow-y-auto border-r p-4">
      <h2 className="mb-4 text-lg font-semibold">Nodes</h2>

      <NodePalette
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        onAutoLayout={() => {}}
        onGroupSelected={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
        canGroup={false}
        canUndo={false}
        canRedo={false}
        planLabel="Basic"
        items={[
          {
            id: 'trigger',
            type: 'trigger' as BuilderNodeType,
            label: 'Trigger',
            category: 'Core',
          },
          {
            id: 'delay',
            type: 'delay' as BuilderNodeType,
            label: 'Delay',
            category: 'Core',
          },
          {
            id: 'webhook',
            type: 'webhook' as BuilderNodeType,
            label: 'Webhook',
            category: 'Core',
          },

          {
            id: 'ai-llm',
            type: 'ai-llm' as BuilderNodeType,
            label: 'AI LLM',
            category: 'AI',
          },
          {
            id: 'ai-classifier',
            type: 'ai-classifier' as BuilderNodeType,
            label: 'AI Classifier',
            category: 'AI',
          },
          {
            id: 'ai-splitter',
            type: 'ai-splitter' as BuilderNodeType,
            label: 'AI Splitter',
            category: 'AI',
          },

          {
            id: 'group',
            type: 'group' as BuilderNodeType,
            label: 'Group',
            category: 'Layout',
          },
          {
            id: 'or-path',
            type: 'or-path' as BuilderNodeType,
            label: 'OR Path',
            category: 'Routing',
          },
        ]}
      />
    </div>
  )
}
