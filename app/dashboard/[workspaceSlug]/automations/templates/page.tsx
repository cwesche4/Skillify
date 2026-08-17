import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { planAtLeast, type Plan } from '@/lib/subscriptions/features'
import { TemplatesGrid } from '@/components/automations/TemplatesGrid'
import { prisma } from '@/lib/db'

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

export default async function AutomationTemplatesPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    select: { id: true, name: true },
  })
  if (!workspace) return null

  const plan = await getWorkspacePlan(workspace.id)

  return (
    <DashboardShell>
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold">Automation Templates</h1>
        <p className="text-neutral-text-secondary text-sm">
          Browse starter flows for workspace <strong>{workspace.name}</strong>.
        </p>
        {!planAtLeast(plan, 'Pro') && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
            Templates marked Pro/Elite will redirect you to upgrade before use.
          </div>
        )}
      </div>

      <TemplatesGrid
        templates={PLACEHOLDER_TEMPLATES}
        plan={plan}
        workspaceId={workspace.id}
        workspaceSlug={params.workspaceSlug}
      />
    </DashboardShell>
  )
}
