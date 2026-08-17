'use client'

import { createContext, useContext } from 'react'

type WorkspaceCtx = {
  workspaceSlug: string
  plan: 'Free' | 'Basic' | 'Pro' | 'Elite'
  role: 'owner' | 'admin' | 'member'
}

const WorkspaceContext = createContext<WorkspaceCtx | null>(null)

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceCtx
  children: React.ReactNode
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceContext(): WorkspaceCtx {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error('Workspace context is not available')
  }
  return ctx
}
