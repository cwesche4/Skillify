"use client"

import { ReactFlowProvider } from "reactflow"

import BuilderInner from "./BuilderInner"

interface PageProps {
  params: {
    automationId: string
  }
}

export default function AutomationBuilderPage({ params }: PageProps) {
  return (
    <ReactFlowProvider>
      <BuilderInner automationId={params.automationId} />
    </ReactFlowProvider>
  )
}
