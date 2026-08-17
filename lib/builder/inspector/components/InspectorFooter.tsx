'use client'

import { UpsellMicroCard } from '@/components/upsell/UpsellMicroCard'
import React from 'react'

type Props = {
  workspaceId: string
  automationId: string
}

function InspectorFooterComponent({ workspaceId, automationId }: Props) {
  return (
    <details className="border-t border-slate-800/80 bg-slate-950/95 px-3 py-2">
      <summary className="cursor-pointer text-[11px] font-medium text-slate-400 hover:text-slate-200">
        Done-for-you help
      </summary>
      <div className="pt-2">
        <UpsellMicroCard
          workspaceId={workspaceId}
          automationId={automationId}
          feature="inspector-help"
          title="Want us to configure this step?"
          description="We'll tune this node, write prompts, and align it to your workflow."
          priceHint="Quick node setups usually cost $19–$49."
        />
      </div>
    </details>
  )
}

export const InspectorFooter = React.memo(InspectorFooterComponent)
