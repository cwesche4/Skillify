'use server'

import { NextResponse } from 'next/server'
import type { AutomationVersionMeta } from '@/lib/versioning/types'

export async function GET(
  _req: Request,
  { params }: { params: { workspaceId: string; automationId: string } },
) {
  const versions: AutomationVersionMeta[] = []
  return NextResponse.json({ versions })
}
