import { ReactNode } from 'react'
import { protectRoute } from '@/lib/auth/protect'
import WorkspaceLayout from './layout'

/**
 * What a protected route rule looks like.
 * Ensures TypeScript enforces correct plan names + roles.
 */
type RouteRule = {
  require?: 'Free' | 'Basic' | 'Pro' | 'Elite'
  role?: ('owner' | 'admin' | 'member') | ('owner' | 'admin' | 'member')[]
}

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { workspaceSlug: string }
}) {
  const workspaceSlug = params.workspaceSlug

  // Build RULES based on pathname
  const path = params.workspaceSlug
  let rules: RouteRule = {}

  if (path.includes('analytics')) {
    rules = { require: 'Pro' }
  } else if (path.includes('ai')) {
    rules = { require: 'Pro' }
  } else if (path.includes('members')) {
    rules = { require: 'Basic', role: ['owner', 'admin'] }
  } else if (path.includes('admin')) {
    rules = { role: ['owner', 'admin'] }
  } else if (path.includes('billing')) {
    rules = { require: 'Basic' }
  }

  // Protect route
  const res = await protectRoute(workspaceSlug, rules)

  if (!res.allowed) {
    return <meta httpEquiv="refresh" content={`0; url=${res.redirect}`} />
  }

  return <WorkspaceLayout params={params}>{children}</WorkspaceLayout>
}
