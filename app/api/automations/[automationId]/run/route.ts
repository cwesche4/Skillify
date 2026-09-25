import { fail, ok } from '@/lib/api/responses'
import { authorizeAutomationAccess } from '@/lib/automations/authorization'
import { runAutomation } from '@/lib/automations/executor'
import { getAdvancedAutomationMutationError } from '@/lib/automations/policy'
import { runAutomationSchema } from '@/lib/validations/automation'

export async function POST(
  req: Request,
  { params }: { params: { automationId: string } },
) {
  const access = await authorizeAutomationAccess({
    automationId: params.automationId,
    access: 'manage',
  })
  if (!access.allowed) return fail(access.message, access.status)

  const ownershipError = getAdvancedAutomationMutationError(
    Boolean(access.automation.managedBySimple),
  )
  if (ownershipError) return fail(ownershipError, 409)

  const parsed = runAutomationSchema.safeParse(
    await req.json().catch(() => ({})),
  )
  if (!parsed.success) return fail('Invalid run request', 400)

  try {
    const runId = await runAutomation(params.automationId, {
      triggerPayload: parsed.data.payload ?? null,
      userProfileId: access.userProfileId,
      expectedWorkspaceId: access.automation.workspaceId,
    })
    return ok({ runId })
  } catch (err: any) {
    return fail(err?.message ?? 'Run failed', 400)
  }
}
