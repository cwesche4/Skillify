import BuilderClientShell from './BuilderClientShell'
import { auth } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

export default async function AutomationBuilderPage({
  params,
}: {
  params: { workspaceSlug: string; automationId: string }
}) {
  const { userId } = auth()
  if (!userId) notFound()

  const automation = await prisma.automation.findFirst({
    where: {
      id: params.automationId,
      workspace: {
        slug: params.workspaceSlug,
        members: { some: { user: { clerkId: userId } } },
      },
      simpleAutomationInstallation: null,
    },
    select: { id: true, workspaceId: true },
  })
  if (!automation) notFound()

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-slate-950">
      <BuilderClientShell
        automationId={automation.id}
        workspaceId={automation.workspaceId}
        workspaceSlug={params.workspaceSlug}
      />
    </div>
  )
}
