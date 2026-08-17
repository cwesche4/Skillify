'use server'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { getInspectorPresetHeatmap } from '@/lib/analytics/inspectorAggregates'

const QuerySchema = z.object({
  workspaceId: z.string(),
  bucket: z.enum(['day', 'hour']).optional(),
})

async function assertWorkspaceAccess(workspaceId: string, clerkId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId } },
    select: { workspaceId: true },
  })
  return !!membership
}

export async function GET(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ data: [] })

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    workspaceId: url.searchParams.get('workspaceId') ?? undefined,
    bucket: url.searchParams.get('bucket') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ data: [] })

  const { workspaceId, bucket } = parsed.data
  const allowed = await assertWorkspaceAccess(workspaceId, clerkId)
  if (!allowed) return NextResponse.json({ data: [] })

  const client = prisma as any // TODO: remove cast after regenerating Prisma client
  const events =
    (await client.inspectorTelemetryAggregate.findMany({
      where: { workspaceId, bucket: bucket ?? 'day', kind: 'presets' },
      select: { payload: true },
    })) || []

  const normalized = getInspectorPresetHeatmap(
    events.map((e: any) => e.payload ?? {}),
  )

  return NextResponse.json({ data: normalized })
}
