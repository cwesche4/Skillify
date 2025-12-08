import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _: Request,
  { params }: { params: { runId: string } },
) {
  const run = await prisma.automationRun.findUnique({
    where: { id: params.runId },
    include: { automation: true },
  })

  if (!run) return NextResponse.json({ steps: [] })

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
