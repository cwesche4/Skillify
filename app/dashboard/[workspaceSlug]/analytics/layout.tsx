// app/dashboard/[workspaceSlug]/analytics/layout.tsx
import type { ReactNode } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/db'
import { canManageAutomations } from '@/lib/automations/policy'
import ProtectedLayout from '../protected-layout'

export default async function AnalyticsLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { workspaceSlug: string }
}) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')
  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: params.workspaceSlug,
      members: { some: { user: { clerkId: userId } } },
    },
    select: {
      businessModel: true,
      members: {
        where: { user: { clerkId: userId } },
        select: { role: true },
      },
    },
  })
  if (!workspace) redirect('/dashboard')
  if (!canManageAutomations(workspace.members[0]?.role)) {
    redirect(`/dashboard/${params.workspaceSlug}`)
  }
  if (workspace.businessModel === 'SIMPLE_SERVICE_BUSINESS') {
    redirect(`/dashboard/${params.workspaceSlug}`)
  }
  return (
    <ProtectedLayout params={params} rules={{ require: 'Pro' }}>
      {children}
    </ProtectedLayout>
  )
}
