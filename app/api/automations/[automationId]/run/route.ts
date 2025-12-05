import { auth } from "@clerk/nextjs/server"

import { fail, ok } from "@/lib/api/responses"
import { getUserPlanByClerkId } from "@/lib/auth/getUserPlan"
import { runAutomation } from "@/lib/automations/executor"
import { hasFeature } from "@/lib/subscriptions/hasFeature"

export async function POST(
  req: Request,
  { params }: { params: { automationId: string } },
) {
  const { userId } = await auth()
  if (!userId) return fail("Unauthorized", 401)

  const plan = await getUserPlanByClerkId(userId)
  if (!hasFeature(plan, "replay")) {
    // you can relax this if you want Basic to be able to run
    // but only Elite to get replay. For now we'll allow run for all.
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
    return fail(err?.message ?? "Run failed", 400)
  }
}
