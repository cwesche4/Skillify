'use client'

import { ReactFlowProvider } from 'reactflow'
import BuilderInner from './BuilderInner'
import { BuilderShell } from '@/components/builder/BuilderShell'

interface PageProps {
  params: {
    workspaceSlug: string
    automationId: string
  }
}

export default function AutomationBuilderPage({ params }: PageProps) {
  return (
    <ReactFlowProvider>
      <BuilderShell
        automationId={params.automationId}
        workspaceId={params.workspaceSlug}
      >
        <BuilderInner
          automationId={params.automationId}
          workspaceId={params.workspaceSlug}
        />
      </BuilderShell>
    </ReactFlowProvider>
  )
}
