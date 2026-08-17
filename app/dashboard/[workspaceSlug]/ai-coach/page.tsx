import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { prisma } from '@/lib/db'
import { WorkspaceAiCoachChat } from '@/components/dashboard/ai-coach/WorkspaceAiCoachChat'
import { WorkspaceAIStatus } from '@/lib/prisma/enums'

type WorkspaceAiProfile = {
  businessName: string
  businessType: string
  primaryGoals: string[]
  servicesProducts: string
  targetCustomers: string
  currentBottlenecks: string[]
  preferredToneStyle: string
  importantNotes: string
}

type AiRecommendation = {
  title: string
  description: string
  impact: string
}

type SuggestedAutomation = {
  title: string
  description: string
  benefit: string
}

const defaultGoals = [
  'Save time with automation',
  'Improve follow-up',
  'Organize client work',
  'Track performance',
  'Build repeatable systems',
]

const recommendations: AiRecommendation[] = [
  {
    title: 'Create a lead follow-up workflow',
    description:
      'Capture new leads, send the first response, and create a follow-up task automatically.',
    impact: 'Faster response time',
  },
  {
    title: 'Add review request automation',
    description:
      'Trigger review requests after completed work or successful client milestones.',
    impact: 'More reputation signals',
  },
  {
    title: 'Build a weekly report',
    description:
      'Summarize new leads, active work, completed tasks, and automation performance.',
    impact: 'Better operating rhythm',
  },
  {
    title: 'Create task reminders for overdue work',
    description:
      'Notify owners when client tasks or operational follow-ups are falling behind.',
    impact: 'Fewer missed handoffs',
  },
  {
    title: 'Organize clients by status',
    description:
      'Segment clients into lead, active, waiting, completed, and follow-up stages.',
    impact: 'Clearer client pipeline',
  },
]

const suggestedAutomations: SuggestedAutomation[] = [
  {
    title: 'Missed call follow-up',
    description: 'Send a fast response and create a callback task.',
    benefit: 'Recover more inbound opportunities.',
  },
  {
    title: 'New lead intake',
    description: 'Collect lead details, assign ownership, and start follow-up.',
    benefit: 'Standardize every new opportunity.',
  },
  {
    title: 'Review request',
    description: 'Ask satisfied clients for reviews after key milestones.',
    benefit: 'Build trust without manual chasing.',
  },
  {
    title: 'Client onboarding',
    description:
      'Create tasks, reminders, and welcome messages for new clients.',
    benefit: 'Make delivery more repeatable.',
  },
  {
    title: 'Overdue task reminder',
    description: 'Alert the right person when important work is overdue.',
    benefit: 'Keep operations moving.',
  },
  {
    title: 'Weekly business summary',
    description: 'Compile activity, workflow health, and priorities each week.',
    benefit: 'Know what changed and what needs attention.',
  },
]

const contextSources = [
  'Clients',
  'Tasks',
  'Automations',
  'Executions',
  'Reports',
  'Analytics',
  'Team activity',
]

export default async function WorkspaceAiCoachPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!profile) redirect('/onboarding/create-workspace')

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: true,
      automations: {
        select: {
          id: true,
          name: true,
          status: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      },
      automationRuns: {
        select: { status: true },
        orderBy: { startedAt: 'desc' },
        take: 50,
      },
      aiProfile: true,
    },
  })

  if (!workspace) return null

  const membership = workspace.members.find((m) => m.userId === profile.id)
  if (!membership) redirect('/dashboard')

  const successfulRuns = workspace.automationRuns.filter(
    (run) => run.status === 'SUCCESS',
  ).length
  const successRate =
    workspace.automationRuns.length > 0
      ? Math.round((successfulRuns / workspace.automationRuns.length) * 100)
      : null
  const profileHasContext = [
    workspace.aiProfile?.businessSummary,
    workspace.aiProfile?.productsAndServices,
    workspace.aiProfile?.operatingGuidelines,
    workspace.aiProfile?.brandVoice,
    workspace.aiProfile?.customerPolicies,
  ].some((value) => {
    if (value == null) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object') return Object.keys(value).length > 0
    return false
  })
  const showAiPersonalizationCard =
    !profileHasContext &&
    (!workspace.aiProfile ||
      workspace.aiProfile.status === WorkspaceAIStatus.NOT_CONFIGURED)

  const aiProfile: WorkspaceAiProfile = {
    businessName: workspace.name,
    businessType: 'Not configured yet',
    primaryGoals: defaultGoals,
    servicesProducts: 'Add services, products, offers, or departments here.',
    targetCustomers: 'Add customer segments, audiences, or account types here.',
    currentBottlenecks: [
      'Manual follow-up',
      'Unclear client status',
      'Reporting consistency',
    ],
    preferredToneStyle: 'Clear, practical, and direct',
    importantNotes:
      'Future saved context will store workspace-specific instructions, operating preferences, and business context here.',
  }

  const contextStats = [
    {
      label: 'Automations',
      value: workspace.automations.length.toString(),
      note: 'Connected now',
    },
    {
      label: 'Executions',
      value: workspace.automationRuns.length.toString(),
      note: successRate == null ? 'No recent runs' : `${successRate}% success`,
    },
    {
      label: 'Team members',
      value: workspace.members.length.toString(),
      note: 'Workspace-scoped',
    },
  ]

  return (
    <DashboardShell className="max-w-7xl">
      <PageHeader
        title="AI Coach"
        description="Your workspace-specific assistant for improving systems, automations, operations, and growth."
        actions={
          <Badge variant="blue">
            {membership.role === 'OWNER'
              ? 'Owner context'
              : 'Workspace context'}
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="space-y-6">
          {showAiPersonalizationCard ? (
            <Card className="border-cyan-300/20 bg-cyan-300/[0.045] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-100">
                    Personalize your workspace AI
                  </h2>
                  <p className="text-neutral-text-secondary mt-1 max-w-2xl text-sm leading-6">
                    Help Skillify understand your business to improve AI
                    responses and future automations.
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link
                    href={`/dashboard/${params.workspaceSlug}/settings#ai-configuration`}
                  >
                    Configure AI
                  </Link>
                </Button>
              </div>
            </Card>
          ) : null}

          <Card className="p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-100">
                  Workspace AI Profile
                </h2>
                <p className="text-neutral-text-secondary mt-1 text-sm">
                  The future memory layer for how Skillify should understand
                  this workspace.
                </p>
              </div>
              <Badge>Scaffold</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <ProfileField
                label="Business name"
                value={aiProfile.businessName}
              />
              <ProfileField
                label="Business type"
                value={aiProfile.businessType}
              />
              <ProfileField
                label="Services/products"
                value={aiProfile.servicesProducts}
              />
              <ProfileField
                label="Target customers"
                value={aiProfile.targetCustomers}
              />
              <ProfileField
                label="Preferred tone/style"
                value={aiProfile.preferredToneStyle}
              />
              <ProfileField
                label="Important notes"
                value={aiProfile.importantNotes}
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ListField
                label="Primary goals"
                values={aiProfile.primaryGoals}
              />
              <ListField
                label="Current bottlenecks"
                values={aiProfile.currentBottlenecks}
              />
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-neutral-100">
                Goals & Priorities
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                A placeholder structure for workspace-level priorities and AI
                planning.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {defaultGoals.map((goal) => (
                <div
                  key={goal}
                  className="rounded-xl border border-neutral-border bg-slate-950/35 p-3"
                >
                  <div className="bg-brand-primary/80 mb-3 h-1.5 w-10 rounded-full" />
                  <p className="text-sm font-medium text-neutral-100">{goal}</p>
                  <p className="text-neutral-text-secondary mt-2 text-xs leading-5">
                    Future persistence will let each workspace rank, update, and
                    track this priority.
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-neutral-100">
                Suggested Improvements
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Static recommendations today, structured for dynamic AI output
                later.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {recommendations.map((recommendation) => (
                <div
                  key={recommendation.title}
                  className="rounded-xl border border-neutral-border bg-slate-950/35 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-neutral-100">
                      {recommendation.title}
                    </h3>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                      {recommendation.impact}
                    </span>
                  </div>
                  <p className="text-neutral-text-secondary text-sm leading-6">
                    {recommendation.description}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-neutral-100">
                Suggested Automations
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Automation templates future AI features may suggest when
                workspace context is available.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {suggestedAutomations.map((automation) => (
                <div
                  key={automation.title}
                  className="flex min-h-48 flex-col rounded-xl border border-neutral-border bg-slate-950/35 p-4"
                >
                  <h3 className="text-sm font-semibold text-neutral-100">
                    {automation.title}
                  </h3>
                  <p className="text-neutral-text-secondary mt-2 text-sm leading-6">
                    {automation.description}
                  </p>
                  <p className="mt-3 text-xs font-medium text-cyan-200">
                    {automation.benefit}
                  </p>
                  <button
                    type="button"
                    disabled
                    className="text-neutral-text-secondary mt-auto inline-flex h-8 cursor-not-allowed items-center justify-center rounded-lg border border-neutral-border bg-white/[0.03] px-3 text-xs font-medium"
                  >
                    Build workflow
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <WorkspaceAiCoachChat workspaceId={workspace.id} />
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-neutral-100">
              Workspace Context Preview
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm leading-6">
              The AI Coach is scoped to this workspace and can use these
              workspace systems when future AI features are invoked.
            </p>

            <div className="mt-4 grid gap-3">
              {contextStats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between rounded-xl border border-neutral-border bg-slate-950/35 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-100">
                      {stat.label}
                    </p>
                    <p className="text-neutral-text-secondary text-xs">
                      {stat.note}
                    </p>
                  </div>
                  <span className="text-xl font-semibold text-neutral-100">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {contextSources.map((source) => (
                <span
                  key={source}
                  className="text-neutral-text-secondary rounded-full border border-neutral-border bg-white/[0.03] px-2.5 py-1 text-[11px]"
                >
                  {source}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-border bg-slate-950/35 p-3">
      <p className="text-neutral-text-secondary text-[11px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-neutral-100">{value}</p>
    </div>
  )
}

function ListField({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-xl border border-neutral-border bg-slate-950/35 p-3">
      <p className="text-neutral-text-secondary text-[11px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      <ul className="mt-3 space-y-2">
        {values.map((value) => (
          <li key={value} className="flex gap-2 text-sm text-neutral-100">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
