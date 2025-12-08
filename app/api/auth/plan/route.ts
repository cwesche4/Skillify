import { auth } from '@clerk/nextjs/server'

import { ok, fail } from '@/lib/api/responses'
import { getUserPlanByClerkId } from '@/lib/auth/getUserPlan'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const plan = await getUserPlanByClerkId(userId)
  return ok({ plan })
}
