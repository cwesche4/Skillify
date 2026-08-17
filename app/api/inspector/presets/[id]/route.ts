'use server'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'

const BodySchema = z.object({
  workspaceId: z.string(),
  nodeType: z.string(),
  name: z.string(),
  data: z.any(),
})

const IdSchema = z.object({
  id: z.string(),
})

async function assertWorkspaceAccess(workspaceId: string, clerkId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId } },
    select: { workspaceId: true },
  })
  return !!membership
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ ok: true })

  const { id } = IdSchema.parse(params)
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: true })

  const { workspaceId, nodeType, name, data } = parsed.data
  const allowed = await assertWorkspaceAccess(workspaceId, clerkId)
  if (!allowed) return NextResponse.json({ ok: true })

  const client = prisma as any // TODO: remove cast after regenerating Prisma client
  try {
    await client.$transaction(async (tx: any) => {
      const existing = await tx.inspectorPreset.findFirst({
        where: { id, workspaceId, nodeType },
        select: { id: true, latestVersion: true },
      })
      if (!existing) return

      const nextVersion = (existing.latestVersion ?? 1) + 1

      await tx.inspectorPresetVersion.create({
        data: { presetId: existing.id, version: nextVersion, data },
      })

      await tx.inspectorPreset.update({
        where: { id },
        data: { name, data, latestVersion: nextVersion },
      })
    })
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ ok: true })

  const { id } = IdSchema.parse(params)
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')
  const nodeType = url.searchParams.get('nodeType')
  if (!workspaceId) return NextResponse.json({ ok: true })

  const allowed = await assertWorkspaceAccess(workspaceId, clerkId)
  if (!allowed) return NextResponse.json({ ok: true })

  const client = prisma as any // TODO: remove cast after regenerating Prisma client
  try {
    await client.$transaction(async (tx: any) => {
      const preset = await tx.inspectorPreset.findFirst({
        where: { id, workspaceId, nodeType: nodeType || undefined },
        select: { id: true },
      })
      if (!preset) return

      await tx.inspectorPresetVersion.deleteMany({
        where: { presetId: preset.id },
      })
      await tx.inspectorPreset.deleteMany({
        where: { id: preset.id },
      })
    })
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true })
}
