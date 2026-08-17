// app/dashboard/[workspaceSlug]/members/layout.tsx
import type { ReactNode } from 'react'
import ProtectedLayout from '../protected-layout'

export default function MembersLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { workspaceSlug: string }
}) {
  return (
    <ProtectedLayout
      params={params}
      rules={{ require: 'Basic', role: ['owner', 'admin'] }}
    >
      {children}
    </ProtectedLayout>
  )
}
