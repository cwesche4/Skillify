'use server'

import { NextResponse } from 'next/server'
import type { CollaborationSnapshot } from '@/lib/collab/types'

// Read-only collaboration snapshot; returns mocked data for now.
export async function GET(
  _req: Request,
  { params }: { params: { workspaceId: string; automationId: string } },
) {
  const snapshot: CollaborationSnapshot = {
    presence: [],
    locks: [],
    serverTime: Date.now(),
  }

  return NextResponse.json(snapshot)
}
