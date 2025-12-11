import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { getUserPlanByClerkId } from '@/lib/auth/getUserPlan'
import { runAutomation } from '@/lib/automations/executor'
import { hasFeature } from '@/lib/subscriptions/hasFeature'
import { normalizePlan } from '@/lib/subscriptions/normalizePlan'

export async function POST(
  req: Request,
  { params }: { params: { automationId: string } },
) {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  // Convert lowercase TierKey → capitalized Plan
  const tier = await getUserPlanByClerkId(userId)
  const plan = normalizePlan(tier)

  // Replay = Elite-only feature (FeatureMatrix key MUST match)
  if (!hasFeature(plan, 'builder.history')) {
    // 'builder.history' IS the "replay/history" premium feature gate
    // We allow running automations anyway, but restrict replay.
  }

  const body = await req.json().catch(() => ({}))
  const triggerPayload = (body && body.payload) ?? null

  try {
    const runId = await runAutomation(params.automationId, {
      triggerPayload,
      userProfileId: null,
    })
    return ok({ runId })
  } catch (err: any) {
    return fail(err?.message ?? 'Run failed', 400)
  }
}
