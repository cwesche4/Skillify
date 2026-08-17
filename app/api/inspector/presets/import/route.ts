'use server'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'

const VersionSchema = z.object({
  version: z.number().int().positive(),
  data: z.any(),
  createdAt: z.string().datetime().optional(),
})

const PresetSchema = z.object({
  name: z.string(),
  nodeType: z.string(),
  data: z.any(),
  latestVersion: z.number().int().positive().optional(),
  versions: z.array(VersionSchema).optional(),
})

const BodySchema = z.object({
  workspaceId: z.string(),
  presets: z.array(PresetSchema),
})

async function assertWorkspaceAccess(workspaceId: string, clerkId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId } },
    select: { workspaceId: true },
  })
  return !!membership
}

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ ok: true })

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: true })

  const { workspaceId, presets } = parsed.data
  const allowed = await assertWorkspaceAccess(workspaceId, clerkId)
  if (!allowed) return NextResponse.json({ ok: true })

  const client = prisma as any // TODO: remove cast after regenerating Prisma client

  for (const preset of presets) {
    const latestVersion =
      preset.latestVersion ?? preset.versions?.at(-1)?.version ?? 1
    const versions = preset.versions?.length
      ? [...preset.versions].sort((a, b) => a.version - b.version)
      : [{ version: 1, data: preset.data }]

    try {
      const created = await client.inspectorPreset.create({
        data: {
          workspaceId,
          nodeType: preset.nodeType,
          name: preset.name,
          data: preset.data,
          latestVersion,
        },
      })

      for (const v of versions) {
        await client.inspectorPresetVersion.create({
          data: {
            presetId: created.id,
            version: v.version,
            data: v.data,
            createdAt: v.createdAt ? new Date(v.createdAt) : undefined,
          },
        })
      }
    } catch {
      // ignore invalid/duplicate imports
    }
  }

  return NextResponse.json({ ok: true })
}
