import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { getUserPlanByClerkId } from '@/lib/auth/getUserPlan'
import { AUTOMATION_TEMPLATES } from '@/lib/automations/templates'
import { hasFeature } from '@/lib/subscriptions/hasFeature'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const plan = await getUserPlanByClerkId(userId)
  if (!hasFeature(plan, 'templates')) {
    return fail('Templates are available on Pro and Elite plans.', 403)
  }

  return ok({ templates: AUTOMATION_TEMPLATES })
}
