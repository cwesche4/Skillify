import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'

export async function GET(req: Request) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required' },
      { status: 400 },
    )
  }

  const access = await authorizeWorkspaceAccess({
    workspaceId,
    access: 'view',
  })
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    )
  }

  const plan = await getWorkspacePlan(workspaceId)

  return NextResponse.json({
    plan,
  })
}
