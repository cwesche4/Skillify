// components/dashboard/ai-coach/AICoachModeSwitcher.tsx
'use client'

import { useState } from 'react'
import { ExplainPanel } from './ExplainPanel'
import { OptimizePanel } from './OptimizePanel'
import { InsightsPanel } from './InsightsPanel'

export function AICoachModeSwitcher({
  workspaceId,
  runId,
  automationId,
}: {
  workspaceId: string
  runId?: string | null
  automationId?: string | null
}) {
  const [mode, setMode] = useState<'explain' | 'optimize' | 'insights'>(
    'insights',
  )

  return (
    <div className="flex h-full flex-col">
      {/* Mode tabs */}
      <div className="flex border-b border-neutral-border">
        <button
          className={`flex-1 py-2 text-sm font-medium ${mode === 'explain' ? 'text-brand-primary' : 'opacity-70'}`}
          onClick={() => setMode('explain')}
        >
          Explain
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium ${mode === 'optimize' ? 'text-brand-primary' : 'opacity-70'}`}
          onClick={() => setMode('optimize')}
        >
          Optimize
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium ${mode === 'insights' ? 'text-brand-primary' : 'opacity-70'}`}
          onClick={() => setMode('insights')}
        >
          Insights
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {mode === 'explain' && (
          <ExplainPanel workspaceId={workspaceId} runId={runId} />
        )}
        {mode === 'optimize' && (
          <OptimizePanel
            workspaceId={workspaceId}
            automationId={automationId}
          />
        )}
        {mode === 'insights' && <InsightsPanel workspaceId={workspaceId} />}
      </div>
    </div>
  )
}
