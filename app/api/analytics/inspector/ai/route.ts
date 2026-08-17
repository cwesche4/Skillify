'use server'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { getInspectorAIHeatmap } from '@/lib/analytics/inspectorAggregates'
import { assertAiActionsEnabled } from '@/lib/builder/ai/server/assertAiActionsEnabled'

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
  const aiGuard = await assertAiActionsEnabled(workspaceId)
  if (aiGuard) return aiGuard

  const allowed = await assertWorkspaceAccess(workspaceId, clerkId)
  if (!allowed) return NextResponse.json({ data: [] })

  const client = prisma as any // TODO: remove cast after regenerating Prisma client
  const events =
    (await client.inspectorTelemetryAggregate.findMany({
      where: { workspaceId, bucket: bucket ?? 'day', kind: 'ai' },
      select: { payload: true },
    })) || []

  const normalized = getInspectorAIHeatmap(
    events.map((e: any) => e.payload ?? {}),
  )

  return NextResponse.json({ data: normalized })
}
