'use server'

import { NextResponse } from 'next/server'
import type { AutomationVersionSnapshot } from '@/lib/versioning/types'

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: { workspaceId: string; automationId: string; versionId: string }
  },
) {
  const snapshot: AutomationVersionSnapshot | null = null
  return NextResponse.json({ snapshot })
}
