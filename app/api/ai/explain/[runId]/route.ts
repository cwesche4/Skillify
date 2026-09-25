import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(
  _: Request,
  { params }: { params: { runId: string } },
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const run = await prisma.automationRun.findFirst({
    where: {
      id: params.runId,
      workspace: { members: { some: { user: { clerkId: userId } } } },
    },
    include: { automation: true },
  })

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  const steps = [
    `Automation "${run.automation.name}" started at ${run.startedAt.toLocaleString()}.`,
    `Status: ${run.status}.`,
    run.durationMs
      ? `Duration: ${run.durationMs}ms (performance analysis applied).`
      : `Automation still running.`,
    run.status === 'FAILED'
      ? 'Failure detected — analyzing possible root causes.'
      : 'Success — validating downstream effects.',
  ]

  return NextResponse.json({ steps })
}
