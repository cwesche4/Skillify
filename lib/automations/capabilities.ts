import type { Plan } from '@/lib/subscriptions/features'
import { hasFeature } from '@/lib/subscriptions/hasFeature'
import { planAtLeast } from '@/lib/subscriptions/features'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'

export function getAutomationCapabilities(plan: Plan) {
  return {
    canUseStarterAutomations: planAtLeast(plan, 'Basic'),
    canUseAdvancedBuilder: planAtLeast(plan, 'Pro'),
    canUsePremiumTemplates: hasFeature(plan, 'builder.templates-premium'),
  }
}

export async function getWorkspaceAutomationCapabilities(workspaceId: string) {
  const plan = await getWorkspacePlan(workspaceId)
  return { plan, ...getAutomationCapabilities(plan) }
}
