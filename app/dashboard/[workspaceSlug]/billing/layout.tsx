// app/dashboard/[workspaceSlug]/billing/layout.tsx
import type { ReactNode } from 'react'
import ProtectedLayout from '../protected-layout'

export default function BillingLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { workspaceSlug: string }
}) {
  return (
    <ProtectedLayout params={params} rules={{ require: 'Basic' }}>
      {children}
    </ProtectedLayout>
  )
}
