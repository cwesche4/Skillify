'use server'

import { NextResponse } from 'next/server'
import type { RunEvent } from '@/lib/runtime/types'

// READ-ONLY backend stub for run timelines; no mutations or side effects.
export async function GET(
  _req: Request,
  { params }: { params: { automationId: string } },
) {
  const { automationId } = params

  // Example deterministic data; replace with real persistence when available.
  const runs = [
    {
      id: 'run-1',
      automationId,
      startedAt: Date.now() - 60_000,
      finishedAt: Date.now() - 30_000,
    },
  ]

  const events: RunEvent[] = [
    {
      nodeId: 'trigger-1',
      status: 'SUCCESS',
      timestamp: runs[0].startedAt,
      duration: 1200,
    },
    {
      nodeId: 'action-1',
      status: 'SUCCESS',
      timestamp: runs[0].startedAt + 3000,
      duration: 1800,
    },
    {
      nodeId: 'action-2',
      status: 'FAILED',
      timestamp: runs[0].startedAt + 7000,
      duration: 900,
    },
  ]

  return NextResponse.json({
    runs,
    timeline: {
      runId: runs[0].id,
      startedAt: runs[0].startedAt,
      finishedAt: runs[0].finishedAt,
      events,
    },
  })
}
