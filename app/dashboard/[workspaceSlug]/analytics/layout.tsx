// app/dashboard/[workspaceSlug]/analytics/layout.tsx
import type { ReactNode } from 'react'
import ProtectedLayout from '../protected-layout'

export default function AnalyticsLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { workspaceSlug: string }
}) {
  return (
    <ProtectedLayout params={params} rules={{ require: 'Pro' }}>
      {children}
    </ProtectedLayout>
  )
}
