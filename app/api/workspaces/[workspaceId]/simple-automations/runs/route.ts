import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { listSimpleAutomationExecutionHistory } from '@/lib/automations/simpleAutomationHistory'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { workspaceId: string } },
) {
  const access = await authorizeWorkspaceAccess({
    workspaceId: params.workspaceId,
    access: 'manage',
  })
  if (!access.allowed) {
    return Response.json({ error: access.message }, { status: access.status })
  }
  return Response.json({
    runs: await listSimpleAutomationExecutionHistory({
      workspaceId: params.workspaceId,
    }),
  })
}
