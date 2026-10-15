import { NextResponse } from 'next/server'
import type { FeatureKey } from '@/lib/subscriptions/features'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { hasFeature } from '@/lib/subscriptions/hasFeature'

const FEATURE_MESSAGES: Partial<Record<FeatureKey, string>> = {
  'coach.explain': 'AI Coach requires a Pro or Elite workspace plan.',
  'coach.optimize':
    'AI Coach optimization requires a Pro or Elite workspace plan.',
  'coach.live': 'AI Coach Live requires an Elite workspace plan.',
}

export async function requireWorkspaceFeature(
  workspaceId: string,
  feature: FeatureKey,
) {
  const plan = await getWorkspacePlan(workspaceId)
  if (hasFeature(plan, feature)) return null
  return NextResponse.json(
    { error: FEATURE_MESSAGES[feature] ?? 'This feature is not available.' },
    { status: 403 },
  )
}
