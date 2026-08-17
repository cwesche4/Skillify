'use server'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'

const QuerySchema = z.object({
  workspaceId: z.string(),
  nodeType: z.string().optional(),
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
  if (!clerkId) return NextResponse.json({ presets: [] })

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    workspaceId: url.searchParams.get('workspaceId') ?? undefined,
    nodeType: url.searchParams.get('nodeType') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ presets: [] })

  const { workspaceId, nodeType } = parsed.data
  const allowed = await assertWorkspaceAccess(workspaceId, clerkId)
  if (!allowed) return NextResponse.json({ presets: [] })

  const client = prisma as any // TODO: remove cast after regenerating Prisma client
  const presets = await client.inspectorPreset.findMany({
    where: { workspaceId, ...(nodeType ? { nodeType } : {}) },
    select: {
      id: true,
      name: true,
      nodeType: true,
      latestVersion: true,
      data: true,
      versions: {
        select: { version: true, data: true, createdAt: true },
        orderBy: { version: 'asc' },
      },
    },
    orderBy: [{ nodeType: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({ presets })
}
