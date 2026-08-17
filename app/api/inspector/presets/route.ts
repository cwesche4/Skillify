'use server'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'

const QuerySchema = z.object({
  workspaceId: z.string(),
  nodeType: z.string().optional(),
})

const BodySchema = z.object({
  workspaceId: z.string(),
  nodeType: z.string(),
  name: z.string(),
  data: z.any(),
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
    select: { id: true, name: true, data: true, nodeType: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ presets })
}

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ ok: true })

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: true })

  const { workspaceId, nodeType, name, data } = parsed.data
  const allowed = await assertWorkspaceAccess(workspaceId, clerkId)
  if (!allowed) return NextResponse.json({ ok: true })

  const client = prisma as any // TODO: remove cast after regenerating Prisma client
  try {
    await client.$transaction(async (tx: any) => {
      const existing = await tx.inspectorPreset.findUnique({
        where: { workspaceId_nodeType_name: { workspaceId, nodeType, name } },
        select: { id: true, latestVersion: true },
      })

      if (!existing) {
        const preset = await tx.inspectorPreset.create({
          data: { workspaceId, nodeType, name, data, latestVersion: 1 },
        })
        await tx.inspectorPresetVersion.create({
          data: { presetId: preset.id, version: 1, data },
        })
        return
      }

      const nextVersion = (existing.latestVersion ?? 1) + 1
      await tx.inspectorPresetVersion.create({
        data: { presetId: existing.id, version: nextVersion, data },
      })
      await tx.inspectorPreset.update({
        where: { workspaceId_nodeType_name: { workspaceId, nodeType, name } },
        data: { data, latestVersion: nextVersion },
      })
    })
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true })
}
