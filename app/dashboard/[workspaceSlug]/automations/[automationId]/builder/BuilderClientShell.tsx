'use client'

import { ReactFlowProvider } from 'reactflow'
import BuilderInner from './BuilderInner'

export default function BuilderClientShell({
  automationId,
  workspaceId,
}: {
  automationId: string
  workspaceId: string
}) {
  return (
    <ReactFlowProvider>
      <BuilderInner automationId={automationId} workspaceId={workspaceId} />
    </ReactFlowProvider>
  )
}
