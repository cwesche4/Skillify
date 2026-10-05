import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { AutomationsSectionHeader } from '@/components/automations/AutomationsSectionHeader'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { planAtLeast, type Plan } from '@/lib/subscriptions/features'
import { TemplatesGrid } from '@/components/automations/TemplatesGrid'
import { prisma } from '@/lib/db'
import { ADVANCED_AUTOMATIONS_LAUNCH_ENABLED } from '@/lib/automations/policy'

const PLACEHOLDER_TEMPLATES: {
  id: string
  name: string
  requiredPlan: Plan
  description: string
  flow: unknown
}[] = [
  {
    id: 'contact-sync',
    name: 'Sync new contacts to CRM',
    requiredPlan: 'Pro',
    description:
      'Creates/updates contacts in your CRM when leads submit forms.',
    flow: { nodes: [], edges: [] },
  },
  {
    id: 'deal-stage',
    name: 'Update deal stage on success',
    requiredPlan: 'Pro',
    description: 'Moves deals forward when automations complete successfully.',
    flow: { nodes: [], edges: [] },
  },
  {
    id: 'lead-score',
    name: 'Lead scoring + outreach',
    requiredPlan: 'Elite',
    description: 'Scores leads and kicks off outreach sequences automatically.',
    flow: { nodes: [], edges: [] },
  },
]

export default async function AdvancedTemplatesPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  if (!ADVANCED_AUTOMATIONS_LAUNCH_ENABLED) {
    redirect(`/dashboard/${params.workspaceSlug}/automations/advanced`)
  }
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: params.workspaceSlug,
      members: { some: { user: { clerkId: userId } } },
    },
    select: { id: true, name: true },
  })
  if (!workspace) return null

  const plan = await getWorkspacePlan(workspace.id)

  return (
    <DashboardShell>
      <AutomationsSectionHeader
        workspaceSlug={params.workspaceSlug}
        activeMode="advanced"
        activeSection="templates"
        description={`Start a custom workflow from a template for ${workspace.name}.`}
      />

      {!planAtLeast(plan, 'Pro') ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          Templates marked Pro/Elite will redirect you to upgrade before use.
        </div>
      ) : null}

      <TemplatesGrid
        templates={PLACEHOLDER_TEMPLATES}
        plan={plan}
        workspaceId={workspace.id}
        workspaceSlug={params.workspaceSlug}
      />
    </DashboardShell>
  )
}
