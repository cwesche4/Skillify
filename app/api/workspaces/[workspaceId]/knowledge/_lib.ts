import { NextResponse } from 'next/server'

import { requireWorkspaceRole } from '@/lib/auth/requireWorkspaceRole'
import type { WorkspaceKnowledgeActor } from '@/lib/intelligence/workspaceKnowledgeStore'

export async function requireKnowledgeActor(
  workspaceId: string,
  allowed: Array<'owner' | 'admin' | 'manager' | 'member'> = [
    'owner',
    'admin',
    'manager',
    'member',
  ],
): Promise<
  | { actor: WorkspaceKnowledgeActor; response: null }
  | { actor: null; response: NextResponse }
> {
  const result = await requireWorkspaceRole(workspaceId, allowed)

  if (!result.allowed || !result.userId || !result.role) {
    return {
      actor: null,
      response: NextResponse.json(
        { error: result.status === 401 ? 'Unauthorized' : 'Forbidden' },
        { status: result.status },
      ),
    }
  }

  return {
    actor: {
      workspaceId,
      userId: result.userId,
      role: result.role,
    } satisfies WorkspaceKnowledgeActor,
    response: null,
  }
}

export function knowledgeErrorResponse(error: unknown) {
  if (
    error instanceof Error &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: (error as { status: number }).status },
    )
  }

  console.error('[Workspace Knowledge API]', error)
  return NextResponse.json(
    { error: 'Workspace knowledge request failed.' },
    { status: 500 },
  )
}
