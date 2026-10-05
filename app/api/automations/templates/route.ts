import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { getWorkspaceAutomationCapabilities } from '@/lib/automations/capabilities'
import { AUTOMATION_TEMPLATES } from '@/lib/automations/templates'
import { prisma } from '@/lib/db'
import { getAdvancedAutomationLaunchRestrictionError } from '@/lib/automations/policy'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return fail('Unauthorized', 401)

  const workspaceSlug = new URL(req.url).searchParams.get('workspaceSlug')
  if (!workspaceSlug) return fail('workspaceSlug is required', 400)

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true },
  })
  if (!workspace) return fail('Workspace not found', 404)

  const access = await authorizeWorkspaceAccess({
    workspaceId: workspace.id,
    access: 'view',
  })
  if (!access.allowed) return fail(access.message, access.status)

  const launchError = getAdvancedAutomationLaunchRestrictionError()
  if (launchError) return fail(launchError, 409)

  const capabilities = await getWorkspaceAutomationCapabilities(workspace.id)

  if (!capabilities.canUsePremiumTemplates) {
    return fail('Templates are available on Pro and Elite plans.', 403)
  }

  return ok({ templates: AUTOMATION_TEMPLATES })
}
