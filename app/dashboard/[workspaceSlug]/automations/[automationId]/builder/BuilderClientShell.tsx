'use client'

import { ReactFlowProvider } from 'reactflow'
import BuilderInner from './BuilderInner'

export default function BuilderClientShell({
  automationId,
  workspaceId,
  workspaceSlug,
}: {
  automationId: string
  workspaceId: string
  workspaceSlug: string
}) {
  return (
    <ReactFlowProvider>
      <BuilderInner
        automationId={automationId}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
      />
    </ReactFlowProvider>
  )
}
