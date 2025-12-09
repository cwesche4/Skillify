// app/api/command-center/onboarding/route.ts
import type {
  OnboardingItem,
  OnboardingResponse,
} from '@/lib/command-center/types'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspaceSlug = searchParams.get('workspace')

  if (!workspaceSlug) {
    const empty: OnboardingResponse = { checklist: [] }
    return NextResponse.json(empty)
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    include: {
      automations: {
        include: { runs: true },
      },
      members: true,
    },
  })

  if (!workspace) {
    const empty: OnboardingResponse = { checklist: [] }
    return NextResponse.json(empty)
  }

  const hasAutomation = workspace.automations.length > 0

  const hasRun = workspace.automations.some(
    (a: { runs: unknown[] }) => a.runs.length > 0,
  )

  const hasMembers = workspace.members.length > 1

  const checklist: OnboardingItem[] = [
    {
      id: 'create-automation',
      title: 'Create your first automation',
      description: 'Set up a basic trigger → AI node → output flow.',
      completed: hasAutomation,
      href: '/dashboard/automations',
      priority: 'high',
    },
    {
      id: 'run-automation',
      title: 'Run at least one automation',
      description:
        'Trigger a test run so Skillify can start learning your patterns.',
      completed: hasRun,
      href: '/dashboard/automations',
      priority: 'high',
    },
    {
      id: 'invite-member',
      title: 'Invite a teammate',
      description:
        'Share your workspace and collaborate on flows and analytics.',
      completed: hasMembers,
      href: '/dashboard/workspaces',
      priority: 'medium',
    },
    {
      id: 'view-analytics',
      title: 'Review analytics',
      description:
        'Check success rate, failure hotspots, and cost trends for your runs.',
      completed: hasRun,
      href: `/dashboard/analytics?workspace=${workspace.slug}`,
      priority: 'medium',
    },
  ]

  const payload: OnboardingResponse = { checklist }
  return NextResponse.json(payload)
}
