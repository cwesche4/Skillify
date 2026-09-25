'use server'

import { NextResponse } from 'next/server'
import type { CollaborationSnapshot } from '@/lib/collab/types'
import { authorizeAutomationAccess } from '@/lib/automations/authorization'

// Read-only collaboration snapshot; returns mocked data for now.
export async function GET(
  _req: Request,
  { params }: { params: { workspaceId: string; automationId: string } },
) {
  const access = await authorizeAutomationAccess({
    workspaceId: params.workspaceId,
    automationId: params.automationId,
    access: 'view',
  })
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    )
  }

  const snapshot: CollaborationSnapshot = {
    presence: [],
    locks: [],
    serverTime: Date.now(),
  }

  return NextResponse.json(snapshot)
}
