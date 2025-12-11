// app/api/coach/live/route.ts
import { NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/auth/getUserPlan'

export async function GET() {
  // 🔒 Elite-only: AI Coach Live
  const plan = await getUserPlan()

  if (!plan) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (plan !== 'elite') {
    return NextResponse.json(
      {
        error:
          'AI Coach Live is available on the Elite plan. Upgrade to unlock live coaching.',
      },
      { status: 403 },
    )
  }

  // In real version: analyze latest runs, failures, costs, latency.
  const insights = [
    {
      id: '1',
      message: "Automation 'New Lead Welcome' is running slower than normal.",
      severity: 'warning',
    },
    {
      id: '2',
      message: "AI Node #3 in 'Content Pipeline' has high token usage.",
      severity: 'critical',
    },
  ]

  return NextResponse.json({ insights })
}
