import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { WorkspaceAnalyticsCharts } from '@/components/dashboard/command-center/WorkspaceCommandCenter'
import { Card } from '@/components/ui/Card'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'
import { UpsellEnterpriseConsult } from '@/components/upsell/UpsellEnterpriseConsult'
import { UpsellMicroCard } from '@/components/upsell/UpsellMicroCard'
import { buildWorkspaceCommandCenterData } from '@/lib/dashboard/workspaceCommandData'
import { prisma } from '@/lib/db'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

import AiHeatmapInsights from './components/AiHeatmapInsights'

type AnalyticsPageProps = {
  params: { workspaceSlug: string }
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { userId: clerkId } = auth()
  if (!clerkId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: true,
      automations: {
        include: {
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 100,
          },
        },
      },
    },
  })

  if (!workspace) return null

  const isMember = workspace.members.some(
    (member) => member.userId === profile.id,
  )
  if (!isMember) return null

  const planLabel = await getWorkspacePlan(workspace.id, clerkId)
  if (planLabel !== 'Elite' && planLabel !== 'Pro') {
    redirect(
      `/dashboard/${params.workspaceSlug}/upsell?need=Pro&feature=Analytics`,
    )
  }

  const runs = workspace.automations
    .flatMap((automation) =>
      automation.runs.map((run) => ({
        id: run.id,
        automationId: automation.id,
        automationName: automation.name,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.durationMs,
      })),
    )
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())

  const capabilities = getWorkspaceCapabilities({
    businessModel: workspace.businessModel,
    opportunitiesEnabled: workspace.opportunitiesEnabled,
    commerceEnabled: workspace.commerceEnabled,
    defaultLeadDestination: workspace.defaultLeadDestination,
    allowDirectLeadToSale: workspace.allowDirectLeadToSale,
    qualifiedLeadBehavior: workspace.qualifiedLeadBehavior,
    customerSingularLabel: workspace.customerSingularLabel,
    customerPluralLabel: workspace.customerPluralLabel,
    salesLabel: workspace.salesLabel,
  })
  const data = buildWorkspaceCommandCenterData({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      members: workspace.members,
      automations: workspace.automations.map((automation) => ({
        id: automation.id,
        name: automation.name,
        runs: runs.filter((run) => run.automationId === automation.id),
      })),
    },
    runs,
    capabilities,
  })

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description={
            capabilities.commerce.commerceEnabled
              ? 'Understand customers, products, orders, revenue, fulfillment, and automation performance across this workspace.'
              : capabilities.modules.opportunities
                ? 'Understand revenue, pipeline, leads, automations, service requests, and task performance across this workspace.'
                : 'Understand revenue, leads, automations, service requests, and task performance across this workspace.'
          }
        />

        <AiHeatmapInsights workspaceId={workspace.id} />

        <WorkspaceAnalyticsCharts data={data} />

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="text-app-primary mb-2 text-sm font-semibold">
              Need help improving automation performance?
            </h3>
            <p className="text-app-muted text-xs">
              Our team can identify bottlenecks, optimize prompts, and tighten
              the workflows behind these charts.
            </p>
            <UpsellMicroCard
              workspaceId={workspace.id}
              feature="analytics-optimization"
              title="Fix my performance"
              description="Quick turnaround performance fixes."
              priceHint="Most fixes $49-$149"
            />
          </Card>

          <Card className="p-4">
            <h3 className="text-app-primary mb-2 text-sm font-semibold">
              Need a full automation system?
            </h3>
            <p className="text-app-muted text-xs">
              Our team can architect and implement the workflows your business
              metrics are pointing toward.
            </p>
            <UpsellEnterpriseConsult workspaceId={workspace.id} />
          </Card>
        </section>

        <BuildRequestCallout workspaceId={workspace.id} />
      </div>
    </DashboardShell>
  )
}
